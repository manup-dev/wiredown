import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lintMock } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8');

test('login lints clean', () => assert.deepEqual(lintMock(login, 'wiredown v1'), []));
test('unknown attribute is an error', () => {
  const r = lintMock('button "x" colour=red');
  assert.equal(r.length, 1);
  assert.equal(r[0].code, 'unknown_attr');
  assert.equal(r[0].severity, 'error');
});
test('unknown kind and dangling link are errors', () => {
  const r = lintMock('screen a\n  blob "x"\n  button "y" -> nowhere');
  assert.deepEqual(r.map((e) => [e.code, e.severity]).sort(), [['dangling_link', 'error'], ['unknown_kind', 'error']]);
});
test('parse errors carry severity error; placement stays a warning', () => {
  assert.equal(lintMock('button "x"\n  text "y"')[0].severity, 'error');
  const w = lintMock('screen a\n  stack\n    item "x"');
  assert.equal(w[0].severity, 'warning');
});
test('unknown info word is a warning at line 0', () => {
  const r = lintMock('button "x"', 'wiredown lookk=clean');
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].code, r[0].severity, r[0].line], ['unknown_info', 'warning', 0]);
  assert.deepEqual(lintMock('button "x"', 'screens v1 look=clean view=prototype'), []);
});
test('at most 50 entries, never throws', () => {
  const body = Array.from({ length: 200 }, () => 'button "x" zz=1').join('\n');
  assert.equal(lintMock(body).length, 50);
  assert.doesNotThrow(() => lintMock(null, 5));
});
