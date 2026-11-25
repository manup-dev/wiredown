import test from 'node:test';
import assert from 'node:assert/strict';
import { mockPatch, mockTree, kindForm, canHold } from '../src/index.js';

function median(fn) {
  fn();
  const t = [];
  for (let i = 0; i < 5; i++) { const s = performance.now(); fn(); t.push(performance.now() - s); }
  return t.sort((a, b) => a - b)[2];
}
const cap = (s) => s.slice(0, 65536 - 200).replace(/[^\n]*$/, '');

// Bare elements (an implicit screen) up to the body limit.
const flat = cap(Array.from({ length: 1400 }, (_, i) => `button "${'a'.repeat(30)}" primary #b${i}\n`).join(''));
// 24 screens with nested stacks, links between them, one variant each.
const screens = cap(Array.from({ length: 24 }, (_, s) => [
  `screen s${s} "Screen ${s}"`,
  '  stack pad=16 gap=12',
  ...Array.from({ length: 18 }, (_, i) => `    row\n      button "Go ${i} ${'g'.repeat(40)}" #b${s}-${i} -> s${(s + 1) % 24}\n      // ${'c'.repeat(40)} -> s${s}`),
  `variant v${s} of s${s} "V"`,
  `  #b${s}-0 disabled`,
  '',
].join('\n')).join('\n'));
// Adversarial: deep nesting, unterminated quotes, and links in comments everywhere.
const deep = Array.from({ length: 4000 }, (_, i) => ' '.repeat(2 * Math.min(i, 30)) + 'stack\n').join('').slice(0, 65536);
const quotes = ('"""' + 'x'.repeat(60) + '\n').repeat(1000).slice(0, 65536);
const arrows = cap(`screen a\n  stack #s\n    button "x" #x\nscreen b\n${`  // ${'-> a '.repeat(9)}\n`.repeat(1400)}  text "y"\n`);

const ops = {
  move: { move: 'b0', into: 'main' },
  'move up': { move: 'b1200', before: 'b0' },
  duplicate: { duplicate: 'b5' },
  add: { add: { after: 'b700' }, lines: ['card', '  h3 "Title"', '  text "Body"'] },
  'set kind': { set: 'b3', kind: 'link' },
  addScreen: { addScreen: { label: 'Another screen' } },
  'screens: moveScreen': { moveScreen: 's0', after: 's23' },
  'screens: removeScreen unlink': { removeScreen: 's5', unlink: true },
  'screens: renameScreen': { renameScreen: 's7', label: 'Renamed' },
  'screens: header': { header: 'device', value: 'tablet' },
  'screens: variant patch': { variant: 'v3', set: 'b3-1', attrs: { w: 'fill' } },
  'screens: move between screens': { move: 'b2-3', into: 's20' },
  'arrows: removeScreen': { removeScreen: 'a', unlink: true },
};

for (const [name, op] of Object.entries(ops)) {
  const body = name.startsWith('screens') ? screens : name.startsWith('arrows') ? arrows : flat;
  test(`perf: ${name} on a 64 KB body in under 100 ms`, () => {
    let r;
    const ms = median(() => { r = mockPatch(body, op); });
    assert.equal(typeof r.ok, 'boolean');
    assert.ok(ms < 100, `${ms.toFixed(1)} ms`);
  });
}

test('perf: the large bodies are near the limit and edit cleanly', () => {
  for (const b of [flat, screens, arrows]) assert.ok(b.length > 60000, String(b.length));
  assert.equal(mockPatch(flat, ops.move).ok, true);
  assert.equal(mockPatch(screens, ops['screens: moveScreen']).ok, true);
  assert.equal(mockPatch(screens, ops['screens: removeScreen unlink']).ok, true);
  // addScreen on the flat body indents every element, which takes it past the size limit: refused.
  assert.equal(mockPatch(flat, ops.addScreen).error, 'would_break');
  for (const k of Object.keys(ops)) if (k !== 'addScreen') assert.equal(mockPatch(k.startsWith('screens') ? screens : k.startsWith('arrows') ? arrows : flat, ops[k]).ok, true, k);
  assert.equal(mockPatch(arrows, ops['arrows: removeScreen']).ok, true);
});

for (const [name, body] of Object.entries({ flat, screens, deep, quotes, arrows })) {
  test(`perf: mockTree and refused edits on ${name} in under 100 ms`, () => {
    const ms = median(() => {
      mockTree(`${body} `, 'wiremark');
      mockPatch(body, [{ move: 'x', after: 'y' }]);
      mockPatch(body, { addScreen: { label: 'x' } });
      kindForm('button');
      canHold('stack', 'button');
    });
    assert.ok(ms < 100, `${ms.toFixed(1)} ms`);
  });
}
