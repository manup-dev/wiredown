import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_CONTRACT, KINDS, lintMock } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8');

test('size and determinism', () => {
  assert.ok(AI_CONTRACT.length >= 3000 && AI_CONTRACT.length <= 7000, String(AI_CONTRACT.length));
});
test('names every kind', () => {
  for (const k of Object.keys(KINDS)) assert.ok(new RegExp(`\\b${k} \\(`).test(AI_CONTRACT), k);
});
test('its example is the login fixture and lints clean', () => {
  const m = /```wiredown\n([\s\S]*?)\n```/.exec(AI_CONTRACT);
  assert.ok(m);
  assert.equal(m[1].trim(), login.trim());
  assert.deepEqual(lintMock(m[1], 'wiredown v1'), []);
});
test('states the rules', () => {
  for (const s of ['#id', '-> screenId', 'one flow', 'lint_doc', '65536']) assert.ok(AI_CONTRACT.includes(s), s);
});
