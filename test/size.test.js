import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_CONTRACT } from '../src/index.js';

// Gzip size of every src/ file reachable from src/index.js (relative imports and re-exports),
// in sorted path order. Measured at commit fb020e73 (before the icon work): 57440 bytes.
const BASELINE = 57440;
// The whole 0.2 budget, raised once by the owner: about 10% over fb020e73.
const BUDGET = BASELINE + 6000;

function reachable(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)) stack.push(resolve(dirname(f), m[1]));
  }
  return [...seen].filter((f) => f.endsWith('.js')).sort();
}

test('the pack checker (wiredown/icons) is not reachable from the core entry', () => {
  const entry = fileURLToPath(new URL('../src/index.js', import.meta.url));
  assert.ok(!reachable(entry).some((f) => f.endsWith('packs-define.js')));
});

test('library gzip size stays within budget', () => {
  const entry = fileURLToPath(new URL('../src/index.js', import.meta.url));
  const all = reachable(entry).map((f) => readFileSync(f, 'utf8')).join('\n');
  const size = gzipSync(all, { level: 9 }).length;
  assert.ok(size <= BUDGET, `gzip ${size} > budget ${BUDGET}`);
});

// 6400 = 5330 (the contract at fb020e73) + 1070 for all the 0.2 lines.
test('AI contract stays within its budget', () => {
  assert.ok(AI_CONTRACT.length <= 6400, `contract is ${AI_CONTRACT.length}`);
});
