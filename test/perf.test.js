import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMockBlock } from '../src/index.js';

function median(fn) {
  fn();
  const t = [];
  for (let i = 0; i < 5; i++) { const s = performance.now(); fn(); t.push(performance.now() - s); }
  return t.sort((a, b) => a - b)[2];
}
const cases = {
  'many wide buttons': Array.from({ length: 1400 }, () => 'button "' + 'a'.repeat(30) + '" primary\n').join('').slice(0, 65536),
  'deep chain': Array.from({ length: 4000 }, (_, i) => ' '.repeat(2 * Math.min(i, 30)) + 'stack\n').join('').slice(0, 65536),
  'quotes': ('"""' + 'x'.repeat(60) + '\n').repeat(1000).slice(0, 65536),
};
cases['wide labels'] = Array.from({ length: 300 }, () => 'button "' + 'a'.repeat(190) + '" primary\n').join('').slice(0, 65536);

for (const [name, body] of Object.entries(cases)) {
  test(`perf: ${name} parses and renders in under 100 ms`, () => {
    let out = '';
    const ms = median(() => { out = renderMockBlock(body, 'wiremark'); });
    assert.equal(typeof out, 'string');
    assert.ok(ms < 100, `${ms.toFixed(1)} ms`);
  });
}
