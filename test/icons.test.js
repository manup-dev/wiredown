import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, ICON_NAMES, ICON_ALIASES, iconPath, pathFromD, hasIcon, nearestIcon, lintMock, AI_CONTRACT } from '../src/index.js';

test('every icon draws only path characters', () => {
  for (const n of ICON_NAMES) assert.match(iconPath(n, 3, 4, 18), /^[MLHVCSQTAZmlhvcsqtaz0-9 .-]+$/, n);
});
test('ICON_NAMES sorted and unique; at most 12 icons were added to the 31', () => {
  assert.deepEqual([...ICON_NAMES], [...new Set(ICON_NAMES)].sort());
  assert.equal(ICON_NAMES.length, 43);
});
test('aliases resolve to built-in icons and never shadow one', () => {
  assert.equal(Object.isFrozen(ICON_ALIASES), true);
  for (const [a, t] of Object.entries(ICON_ALIASES)) { assert.ok(!(a in ICONS), a); assert.ok(t in ICONS, t); }
  assert.equal(iconPath('delete', 0, 0, 24), iconPath('trash-2', 0, 0, 24));
  assert.equal(iconPath('gear', 0, 0, 24), iconPath('settings', 0, 0, 24));
  assert.ok(hasIcon('logout'));
  assert.equal(hasIcon('__proto__'), false);
});
test('pathFromD matches iconPath', () => {
  assert.equal(pathFromD(ICONS.plus, 1, 2, 12), iconPath('plus', 1, 2, 12));
});
test('unknown_icon warning with a suggestion', () => {
  const r = lintMock('screen a\n  button "x" icon=serch\n  icon "zzzzqq"');
  assert.deepEqual(r.map((e) => [e.code, e.severity, e.line]), [['unknown_icon', 'warning', 2], ['unknown_icon', 'warning', 3]]);
  assert.equal(r[0].message, 'No icon named "serch". It draws as a placeholder. Did you mean "search"?');
  assert.match(r[1].message, /The icon list is at https:\/\/github\.com\/manup-dev\/wiredown#icons$/);
  assert.equal(lintMock('screen a\n  button "x" icon=search\n  icon "delete"').length, 0);
  assert.equal(nearestIcon('settingsx'), 'settings');
});
test('contract lists icons and aliases', () => {
  assert.match(AI_CONTRACT, /Icons \(icon=name or icon "name"\): .*trash-2.*\. Use one of these;/);
  assert.match(AI_CONTRACT, /\bdelete\b/);
});

test('pathFromD is total on hostile data', () => {
  const SAFE = /^[MLHVCSQTAZmlhvcsqtaz0-9 .-]*$/;
  assert.equal(pathFromD('M1 2e3 4', 0, 0, 24), 'M1 2000L4 0'); // the exponent is part of the number
  for (const d of ['M1 2e3 4', 'M1 x 2 3 e 4', 'M1e 2', 'M1e+ 2', 'xyz', 'Z', 'M-', 'M.']) {
    assert.match(pathFromD(d, 0, 0, 24), SAFE, d);
  }
  assert.equal(pathFromD('M1 2 x5 6 L3 4', 0, 0, 24), 'M1 2L3 4');
  for (const bad of [null, undefined, 5, {}, ['M1 2']]) assert.equal(pathFromD(bad, 0, 0, 24), '');
  const huge = 'M1 2L3 4'.repeat(100000);
  assert.ok(pathFromD(huge, 0, 0, 24).length < 100000);
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.match(pathFromD('M1 2 L3 4', bad, bad, bad), SAFE);
    assert.match(pathFromD('M1e999 -1e999 L3 4', 0, 0, 24), SAFE);
  }
});
test('pathFromD fuzz never throws', () => {
  const alpha = 'MmLlHhVvCcSsQqTtAaZzxe0123456789 .,-';
  let seed = 12345;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < 500; i++) {
    let d = '';
    const len = next() % 80;
    for (let j = 0; j < len; j++) d += alpha[next() % alpha.length];
    const out = pathFromD(d, 1, 2, 24);
    assert.match(out, /^[MLHVCSQTAZmlhvcsqtaz0-9 .-]*$/, d);
  }
});
test('docs/language.md lists exactly the icon names and aliases', () => {
  const md = readFileSync(new URL('../docs/language.md', import.meta.url), 'utf8');
  const row = (label) => md.split('\n').find((l) => l.startsWith(`| ${label} |`));
  const names = [...row('Icon names').matchAll(/`([^`]+)`/g)][0][1].split(' ').sort();
  assert.deepEqual(names, [...ICON_NAMES]);
  const aliasRow = row('Icon aliases').split('|')[2];
  const listed = [...aliasRow.split('. An unknown')[0].matchAll(/`([a-z-]+(?: [a-z-]+)*)` \(/g)].flatMap((m) => m[1].split(' ')).sort();
  assert.deepEqual(listed, Object.keys(ICON_ALIASES).sort());
});
