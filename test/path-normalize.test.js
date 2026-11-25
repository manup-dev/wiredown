import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitPath } from '../scripts/path-normalize.mjs';

test('explicitPath writes arc flags as their own numbers', () => {
  assert.equal(explicitPath('M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'), 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z');
  assert.equal(explicitPath('M3 16v-5.5a2.5 2.5 0 0 1 5 0'), 'M3 16v-5.5a2.5 2.5 0 0 1 5 0');
});

test('explicitPath keeps repeated groups and rejects bad data', () => {
  assert.equal(explicitPath('m1 2 3 4'), 'm1 2 3 4');
  assert.throws(() => explicitPath('M1 2 x'), /bad path command/);
  assert.throws(() => explicitPath('a1 1 0 2 0 1 1'), /arc flag/);
});
