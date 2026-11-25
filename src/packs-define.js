// wiredown/icons: defineIconPack checks host icon data on the 24-unit grid and brands it, so the
// renderers of the same copy of wiredown draw it. Kept out of the core entry (src/index.js), so a
// host that loads no pack never carries the checker.
import { brand, PACK_ID } from './packs.js';

export { isIconPack, iconPacksKey } from './packs.js';

const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|[\s,]+|(.)/gs;
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const bad = (m) => { throw new TypeError(m); };
const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const on = (v) => v >= -4 && v <= 28;

// Commands and numbers only, arc flags written alone (0 or 1), arc radii 0..1000 and rotation
// -360..360. Every point, control points included, is followed as SVG draws it (a relative
// command adds to the current point, z returns to the subpath start) and must lie within -4..28.
function checkPath(d, who) {
  if (!text(d, 6000)) bad(`${who}: path data is not 1 to 6000 characters`);
  const it = [];
  for (const m of d.matchAll(TOKEN)) {
    if (m[3] !== undefined) bad(`${who}: bad path character`);
    if (m[1] || m[2] !== undefined) it.push(m[1] || Number(m[2]));
  }
  if (!/^[Mm]$/.test(it[0])) bad(`${who}: path starts without M`);
  let x = 0, y = 0, sx = 0, sy = 0;
  for (let i = 0; i < it.length;) {
    const cmd = it[i++];
    const C = typeof cmd === 'string' ? cmd.toUpperCase() : bad(`${who}: stray number`);
    const n = ARITY[C];
    let j = i;
    while (typeof it[j] === 'number') j++;
    if (n ? j === i || (j - i) % n : j > i) bad(`${who}: wrong value count for ${cmd}`);
    if (!n) { x = sx; y = sy; }
    for (let g = i; g < j; g += n) {
      const v = it.slice(g, g + n);
      const ox = cmd === C ? 0 : x, oy = cmd === C ? 0 : y;
      if (C === 'A' && !(v[0] >= 0 && v[0] <= 1000 && v[1] >= 0 && v[1] <= 1000 && Math.abs(v[2]) <= 360 && v[3] * v[3] === v[3] && v[4] * v[4] === v[4])) bad(`${who}: bad arc`);
      if (C === 'H') x = ox + v[0];
      else if (C === 'V') y = oy + v[0];
      else for (let k = C === 'A' ? 5 : 0; k < n; k += 2) {
        if (!on(ox + v[k]) || !on(oy + v[k + 1])) bad(`${who}: ${cmd} point off the 24 grid`);
        x = ox + v[k]; y = oy + v[k + 1];
      }
      if (!on(x) || !on(y)) bad(`${who}: ${cmd} point off the 24 grid`);
      if (C === 'M' && g === i) { sx = x; sy = y; }
    }
    i = j;
  }
}

/** Checks a pack and returns it frozen and branded. Throws a TypeError on a malformed pack. */
export function defineIconPack(spec) {
  const { id, name, version, license, url, icons, strokeWidth } = spec || bad('not a pack object');
  if (typeof id !== 'string' || !PACK_ID.test(id) || id === 'wiredown') bad('pack id must match [a-z][a-z0-9-]{0,23} and not be wiredown');
  const who = `pack "${id}"`;
  if (!text(name, 80) || !text(version, 32) || !/^[\w.+-]+$/.test(version)) bad(`${who}: name and version must be text`);
  if ((license !== undefined && !text(license, 200)) || (url !== undefined && !text(url, 200))) bad(`${who}: license and url must be text`);
  if (strokeWidth !== undefined && !(typeof strokeWidth === 'number' && strokeWidth >= 1 && strokeWidth <= 3)) bad(`${who}: strokeWidth must be 1 to 3`);
  if (!icons || typeof icons !== 'object' || Array.isArray(icons)) bad(`${who}: icons must map names to path data`);
  const keys = Object.keys(icons);
  if (keys.length > 10000) bad(`${who}: at most 10000 icons`);
  const own = Object.create(null);
  for (const k of keys) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(k)) bad(`${who}: bad icon name ${k.slice(0, 20)}`);
    const d = icons[k]; // read once, so a getter cannot swap the checked string
    checkPath(d, `${who}, icon ${k}`);
    own[k] = d;
  }
  return brand(Object.freeze({ id, name, version, license, url, strokeWidth, icons: Object.freeze(own) }));
}
