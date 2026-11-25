// Icon geometry: every built-in icon and every icon of the three packs, read the way SVG reads path
// data, stays on the 24-unit grid, and pathFromD draws the same points as the data says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, pathFromD } from '../src/index.js';
import { explicitPath } from '../scripts/path-normalize.mjs';
import lucide from '../integrations/icons-lucide/icons.js';
import tabler from '../integrations/icons-tabler/icons.js';
import heroicons from '../integrations/icons-heroicons/icons.js';

const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const TOKENS = /[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

// The absolute end point of every segment. SVG rules: a relative command adds to the current
// point (which starts at 0 0, so a leading m is absolute), the pairs after a moveto are linetos of
// the same case, and z returns to the start of the subpath.
function endpoints(d) {
  const tk = explicitPath(d).match(TOKENS);
  const out = [];
  let x = 0, y = 0, sx = 0, sy = 0, i = 0;
  while (i < tk.length) {
    let c = tk[i++];
    let C = c.toUpperCase();
    const n = ARGS[C];
    assert.ok(n !== undefined, `command ${c}`);
    if (!n) { x = sx; y = sy; continue; }
    let first = true;
    while (i < tk.length && !/[a-zA-Z]/.test(tk[i])) {
      const v = tk.slice(i, i + n).map(Number);
      i += n;
      const ox = c === C ? 0 : x, oy = c === C ? 0 : y;
      if (C === 'H') x = ox + v[0];
      else if (C === 'V') y = oy + v[0];
      else { x = ox + v[n - 2]; y = oy + v[n - 1]; }
      if (C === 'M' && first) { sx = x; sy = y; }
      out.push([x, y]);
      if (C === 'M') { c = c === 'm' ? 'l' : 'L'; C = 'L'; }
      first = false;
    }
  }
  return out;
}

const SETS = { 'built-in': ICONS, lucide, tabler, heroicons };
const SCALE = 100; // pathFromD at size 2400: one decimal there is 0.001 of the grid

for (const [set, icons] of Object.entries(SETS)) {
  test(`${set}: every icon stays on the 24 grid, and pathFromD draws the same points`, () => {
    const off = [];
    const moved = [];
    for (const [name, d] of Object.entries(icons)) {
      const pts = endpoints(d);
      if (pts.some(([x, y]) => !(x >= -1 && x <= 25 && y >= -1 && y <= 25))) off.push(name);
      let drawn = [];
      try { drawn = endpoints(pathFromD(d, 0, 0, 24 * SCALE)); } catch { /* unreadable output: counted below */ }
      if (drawn.length !== pts.length || drawn.some(([x, y], k) => Math.abs(x / SCALE - pts[k][0]) > 0.05 || Math.abs(y / SCALE - pts[k][1]) > 0.05)) moved.push(name);
    }
    assert.ok(Object.keys(icons).length > 10);
    assert.ok(!off.length && !moved.length, `${off.length} icons leave the grid (${off.slice(0, 8).join(' ')}); ` +
      `${moved.length} draw other points than their data (${moved.slice(0, 8).join(' ')})`);
  });
}

// Each expected string was checked by hand against the upstream lucide-static 1.72.0 SVG: every
// child element starts at its own absolute point, and the pairs after an `m` are relative linetos.
test('exact output of icons whose upstream paths start with m or join several elements', () => {
  const at0 = (d) => pathFromD(d, 0, 0, 24);
  const want = {
    'check-circle': 'M21.8 10A10 10 0 1 1 17 3.3M9 11l3 3L22 4',
    'x-circle': 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M15 9l-6 6M9 9l6 6',
    'eye-off': 'M10.7 5.1a10.7 10.7 0 0 1 11.2 6.6a1 1 0 0 1 0 0.7a10.7 10.7 0 0 1 -1.4 2.5M14.1 14.2a3 3 0 0 1 -4.2 -4.2' +
      'M17.5 17.5a10.8 10.8 0 0 1 -15.4 -5.2a1 1 0 0 1 0 -0.7a10.8 10.8 0 0 1 4.4 -5.1M2 2l20 20',
    'log-in': 'M10 17l5 -5l-5 -5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-4',
    'log-out': 'M16 17l5 -5l-5 -5M21 12H9M9 21H5a2 2 0 0 1 -2 -2V5a2 2 0 0 1 2 -2h4',
    'shopping-cart': 'M2.1 2.1l1.1 0a1 1 0 0 1 1 0.8l2.7 14.3A1 1 0 0 0 7.8 18H18M4.6 5h16.4a1 1 0 0 1 1 1.2l-1 6.2A2 2 0 0 1 19 14H6.3' +
      'M16 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  };
  for (const [name, d] of Object.entries(want)) assert.equal(at0(ICONS[name]), d, name);
  assert.equal(at0(lucide['a-arrow-down']), 'M14 12l4 4l4 -4M18 16V7M2 16l4 -9.7a0.5 0.5 0 0 1 0.9 0L11 16M3.3 13h6.4');
  // the raw built-in data, as rebuilt by scripts/build-icons.mjs
  assert.equal(ICONS['check-circle'], 'M21.801 10A10 10 0 1 1 17 3.335M9 11l3 3L22 4');
  assert.equal(lucide['a-arrow-down'], 'M14 12l4 4 4-4M18 16V7M2 16l4.039-9.69a.5 .5 0 0 1 .923 0L11 16M3.304 13h6.392');
  assert.equal(heroicons['chevron-double-up'], 'M4.5 18.75l7.5-7.5 7.5 7.5M4.5 12.75l7.5-7.5 7.5 7.5');
});
