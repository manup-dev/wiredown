// svg-to-path: turn the drawable children of one SVG into a single path-data string. Dev tool for
// building icon data (never shipped, never imported by src/). Throws on anything it cannot convert
// exactly: a transform, or a drawable element other than path, circle, ellipse, rect, line,
// polyline and polygon.
const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const CONTAINERS = new Set(['svg', 'g', 'title', 'desc', 'metadata']);

const fmt = (n) => String(Math.round(n * 10000) / 10000);

function attrsOf(text) {
  const out = {};
  for (const m of text.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]] = m[2] ?? m[3];
  return out;
}

function num(a, key, dflt = 0) {
  if (a[key] === undefined) return dflt;
  const v = Number(a[key]);
  if (!Number.isFinite(v) || !/^\s*-?[\d.]+(e-?\d+)?\s*$/i.test(a[key])) throw new Error(`bad number for ${key}: ${a[key]}`);
  return v;
}

function points(a) {
  const nums = String(a.points ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.length < 4 || nums.length % 2 || nums.some((n) => !Number.isFinite(n))) throw new Error('bad points');
  const pts = [];
  for (let i = 0; i < nums.length; i += 2) pts.push(`${fmt(nums[i])} ${fmt(nums[i + 1])}`);
  return pts;
}

function ellipse(cx, cy, rx, ry) {
  return `M${fmt(cx - rx)} ${fmt(cy)}a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(2 * rx)} 0a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-2 * rx)} 0`;
}

function rect(a) {
  const x = num(a, 'x'), y = num(a, 'y'), w = num(a, 'width'), h = num(a, 'height');
  let rx = a.rx === undefined ? (a.ry === undefined ? 0 : num(a, 'ry')) : num(a, 'rx');
  let ry = a.ry === undefined ? rx : num(a, 'ry');
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);
  if (!rx || !ry) return `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`;
  const R = `${fmt(rx)} ${fmt(ry)}`;
  return `M${fmt(x + rx)} ${fmt(y)}h${fmt(w - 2 * rx)}a${R} 0 0 1 ${fmt(rx)} ${fmt(ry)}v${fmt(h - 2 * ry)}` +
    `a${R} 0 0 1 ${fmt(-rx)} ${fmt(ry)}h${fmt(-(w - 2 * rx))}a${R} 0 0 1 ${fmt(-rx)} ${fmt(-ry)}` +
    `v${fmt(-(h - 2 * ry))}a${R} 0 0 1 ${fmt(rx)} ${fmt(-ry)}z`;
}

// A path's first moveto is absolute even when written `m`, and the pairs after it stay relative
// linetos: `m9 11 3 3` is `M9 11l3 3`. Joined after another shape, a leading `m` would read as
// relative to that shape's end, so every part starts with an absolute M.
const NUM = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';
const LEAD = new RegExp(`^m[\\s,]*${NUM}[\\s,]*${NUM}[\\s,]*`);
export function absoluteStart(d) {
  const m = LEAD.exec(d);
  if (!m) return d;
  const rest = d.slice(m[0].length);
  return `M${m[1]} ${m[2]}${/^[+\-.\d]/.test(rest) ? 'l' : ''}${rest}`;
}

function shape(name, a) {
  if (name === 'path') {
    if (typeof a.d !== 'string' || !a.d.trim()) throw new Error('path without d');
    return absoluteStart(a.d.trim());
  }
  if (name === 'circle') return ellipse(num(a, 'cx'), num(a, 'cy'), num(a, 'r'), num(a, 'r'));
  if (name === 'ellipse') return ellipse(num(a, 'cx'), num(a, 'cy'), num(a, 'rx'), num(a, 'ry'));
  if (name === 'rect') return rect(a);
  if (name === 'line') return `M${fmt(num(a, 'x1'))} ${fmt(num(a, 'y1'))}L${fmt(num(a, 'x2'))} ${fmt(num(a, 'y2'))}`;
  const pts = points(a);
  return `M${pts[0]}${pts.slice(1).map((p) => `L${p}`).join('')}${name === 'polygon' ? 'z' : ''}`;
}

/** One `d` string for every shape child of the SVG, in document order. */
export function svgToPath(svgText) {
  const text = String(svgText).replace(/<!--[\s\S]*?-->/g, '');
  const parts = [];
  for (const m of text.matchAll(/<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    const name = m[1];
    const a = attrsOf(m[2]);
    if ('transform' in a) throw new Error(`transform on <${name}> is not supported`);
    if (CONTAINERS.has(name)) continue;
    if (!SHAPES.has(name)) throw new Error(`<${name}> is not supported`);
    parts.push(shape(name, a));
  }
  if (!parts.length) throw new Error('no drawable elements');
  return parts.join('');
}
