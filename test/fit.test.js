import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMock, layoutScreen, renderMockBlock, lintMock, AI_CONTRACT } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8');
const SHORT = 'screen a "A"\n  stack pad=24 gap=16\n    h1 "Hi"\n    button "Go" primary w=fill\n';
const lay = (body) => {
  const r = parseMock(body);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return { r, l: layoutScreen(r.mock.screens[0], r.mock.device) };
};

test('@device phone fit parses to device.fit; the plain header has no fit key', () => {
  assert.deepEqual(lay('@device phone fit\n' + SHORT).r.mock.device, { name: 'phone', w: 390, h: 844, fit: true });
  assert.deepEqual(lay('@device 390x844 fit\n' + SHORT).r.mock.device, { name: '390x844', w: 390, h: 844, fit: true });
  assert.deepEqual(lay('@device phone\n' + SHORT).r.mock.device, { name: 'phone', w: 390, h: 844 });
  assert.deepEqual(lintMock('@device phone fit\n' + SHORT), []);
});

test('any other word after the device stays a bad_header', () => {
  for (const h of ['@device phone tall', '@device phone fit fit', '@device fit', '@device phone "fit"']) {
    const r = parseMock(h + '\n' + SHORT);
    assert.equal(r.ok, false, h);
    assert.equal(r.errors[0].code, 'bad_header', h);
  }
});

test('fit ends a short screen at its content, never below 240', () => {
  const plain = lay(SHORT).l;
  const fit = lay('@device phone fit\n' + SHORT).l;
  assert.equal(plain.height, 844);
  assert.ok(fit.height < 844, String(fit.height));
  assert.equal(fit.height, 240);
  const r = lay('@device phone fit\n' + login.replace('@device phone\n', '')).l;
  assert.ok(r.height > 240 && r.height < 844, String(r.height));
  assert.equal(r.fold, null);
  // the content's bottom edge plus the screen's own padding
  const bottom = (b) => Math.max(b.y + b.h, ...b.children.map(bottom));
  assert.equal(r.height, Math.max(...r.root.children.map(bottom)) + 16);
});

test('a tall screen keeps the device fold line with fit', () => {
  const tall = 'screen a "A"\n  stack gap=16\n' + '    button "B" w=fill\n'.repeat(30);
  const plain = lay(tall).l;
  const fit = lay('@device phone fit\n' + tall).l;
  assert.equal(fit.height, plain.height);
  assert.equal(fit.fold, 844);
  assert.equal(plain.fold, 844);
});

test('a screen with an overlay ignores fit (overlays sit against the device height)', () => {
  for (const o of ['modal "M"\n    text "x"', 'sheet "S"\n    text "x"', 'toast "Saved"']) {
    const body = SHORT + '  ' + o + '\n';
    assert.equal(lay('@device phone fit\n' + body).l.height, 844, o);
  }
});

test('fit output is deterministic, and the default output is unchanged', () => {
  const a = renderMockBlock('@device phone fit\n' + SHORT, 'wiredown', { blockIndex: 0 });
  assert.equal(a, renderMockBlock('@device phone fit\n' + SHORT, 'wiredown', { blockIndex: 0 }));
  assert.match(a, /<rect x=".5" y=".5" width="389" height="239" rx="24"/);
  const golden = readFileSync(new URL('./fixtures/login.html', import.meta.url), 'utf8');
  assert.equal(renderMockBlock(login, 'wiredown'), golden);
});

test('the AI contract and README name fit', () => {
  assert.match(AI_CONTRACT, /fit/);
  assert.match(readFileSync(new URL('../README.md', import.meta.url), 'utf8'), /fit/);
});
