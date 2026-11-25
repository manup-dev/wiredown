import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMock, layoutScreen } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiremark', import.meta.url), 'utf8');
const lay = (body) => {
  const r = parseMock(body);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return layoutScreen(r.mock.screens[0], r.mock.device);
};
const find = (b, id) => (b.node.id === id ? b : b.children.map((c) => find(c, id)).find(Boolean));

test('login: the fill button is the stack width', () => {
  const r = parseMock(login);
  const l = layoutScreen(r.mock.screens[0], r.mock.device);
  assert.equal(l.width, 390);
  assert.equal(find(l.root, 'submit').w, 390 - 2 * 16 - 2 * 24);
  assert.equal(find(l.root, 'submit').x, 16 + 24);
  assert.equal(l.fold, null);
  assert.equal(l.height, 844);
  const email = find(l.root, 'email');
  assert.equal(email.fieldY, email.y + 18);
  assert.deepEqual(email.lines, ['Email']);
});

test('row with two grow=1 children splits leftover equally', () => {
  const l = lay('row\n  text "a" grow=1 #a\n  text "bbbbbbbb" grow=1 #b\n');
  const a = find(l.root, 'a');
  const b = find(l.root, 'b');
  assert.equal(a.w, b.w);
  assert.equal(a.w * 2 + 8, 390 - 32 - 0);
  assert.equal(b.x, a.x + a.w + 8);
});

test('justify between and spacer', () => {
  const l = lay('row justify=between\n  button "A" #a\n  button "B" #b\n');
  assert.equal(find(l.root, 'b').x + find(l.root, 'b').w, 390 - 16);
  const s = lay('row\n  button "A" #a\n  spacer\n  button "B" #b\n');
  assert.equal(find(s.root, 'b').x + find(s.root, 'b').w, 390 - 16);
});

test('content beyond the device height sets the fold', () => {
  const body = 'stack\n' + '  text "line"\n'.repeat(80);
  const l = lay(body);
  assert.equal(l.fold, 844);
  assert.ok(l.height > 844);
});

test('overlays are centred or bottom-anchored over the screen', () => {
  const l = lay('screen s\n  text "hi"\n  modal "Sure?" #m\n    text "x"\n  toast "Saved" #t\n  sheet #sh\n    text "pick"\n');
  const m = find(l.root, 'm');
  assert.equal(m.x * 2 + m.w, 390);
  assert.equal(r2(m.y * 2 + m.h), 844);
  const sh = find(l.root, 'sh');
  assert.equal(sh.y + sh.h, 844);
  assert.equal(find(l.root, 't').y + find(l.root, 't').h, 844 - 24);
  assert.ok(l.root.children.at(-1).node.kind === 'sheet');
});
const r2 = (v) => Math.round(v * 2) / 2;

test('grid spans and numbers clamp', () => {
  const l = lay('grid cols=2 gap=0 pad=0\n  card #a\n  card #b\n  card span=2 #c\n  button "x" w=9999 #d\n');
  assert.equal(find(l.root, 'a').w, 179);
  assert.equal(find(l.root, 'c').w, 358);
  assert.equal(find(l.root, 'd').w, 179);
  const n = lay('stack\n  button "x" w=9999 #d\n');
  assert.equal(find(n.root, 'd').w, 358);
});

test('unknown kinds are placeholders, long text wraps', () => {
  const l = lay('stack\n  wibble "Thing" #u\n  text "' + 'word '.repeat(30) + '" #t\n');
  assert.equal(find(l.root, 'u').h, 44);
  assert.ok(find(l.root, 't').lines.length > 1);
});

test('coordinates are rounded to 0.5 and layout is deterministic', () => {
  const body = 'stack\n  row\n    text "a" grow=1\n    text "b" grow=1\n    text "c" grow=1\n';
  const a = lay(body);
  assert.deepEqual(a, lay(body));
  const walk = (b) => { for (const v of [b.x, b.y, b.w, b.h]) assert.equal(v * 2, Math.round(v * 2)); b.children.forEach(walk); };
  walk(a.root);
});

test('2,000 nodes lay out quickly', () => {
  const r = parseMock('stack\n' + '  row\n    text "item"\n    button "go"\n'.repeat(400));
  assert.equal(r.ok, true, JSON.stringify(r.errors && r.errors[0]));
  const stack = r.mock.screens[0].root.children[0];
  const rows = stack.children;
  while (stack.children.length < 666) stack.children.push(structuredClone(rows[0]));
  const t = performance.now();
  const l = layoutScreen(r.mock.screens[0], r.mock.device);
  assert.ok(performance.now() - t < 100);
  assert.equal(l.root.children[0].children.length, 666);
});

test('oversized padding never yields negative sizes', () => {
  for (const body of ['stack w=1000 pad=500\n  button "x" #b\n', 'stack pad=99999\n  text "hi" #b\n', 'grid pad=500\n  text "a" #b\n', 'row pad=500\n  text "a" #b\n']) {
    const walk = (b) => { for (const v of [b.x, b.y, b.w, b.h]) assert.ok(v >= 0, body); b.children.forEach(walk); };
    walk(lay(body).root);
  }
});

test('fixed-width row children that overflow shrink to fit', () => {
  const l = lay('row\n  button "a" w=300 #a\n  button "b" w=300 #b\n');
  const a = find(l.root, 'a');
  const b = find(l.root, 'b');
  assert.ok(b.x + b.w <= 390 - 16 + 0.5);
  assert.ok(a.w > 0 && a.x + a.w <= b.x);
});
