import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMock, WM_LIMITS } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8');
const codes = (r) => (r.ok ? r.warnings : r.errors).map((e) => e.code);

test('login fixture parses with three screens and a variant', () => {
  const r = parseMock(login, 'wiredown v1');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const m = r.mock;
  assert.deepEqual(m.device, { name: 'phone', w: 390, h: 844 });
  assert.equal(m.title, 'Sign in');
  assert.deepEqual(m.screens.map((s) => s.id), ['login', 'login-error', 'reset']);
  assert.equal(m.screens[1].variantOf, 'login');
  assert.equal(m.screens[0].variantOf, null);
  const find = (n, id) => (n.id === id ? n : n.children.map((c) => find(c, id)).find(Boolean));
  assert.equal(find(m.screens[1].root, 'password').attrs.error, 'That password is not right');
  assert.equal(find(m.screens[0].root, 'password').attrs.error, undefined);
  const pw = find(m.screens[0].root, 'password');
  assert.equal(pw.line, 7);
  assert.equal(find(m.screens[0].root, 'submit').note, 'Disabled until both fields are filled');
  assert.equal(r.warnings.length, 0);
});

test('info string: version and view', () => {
  assert.equal(parseMock('text "a"', 'wiredown v1 view=prototype').mock.view, 'prototype');
  assert.equal(parseMock('text "a"', 'screens').mock.view, 'stack');
  assert.deepEqual(codes(parseMock('text "a"', 'wiredown v2')), ['bad_header']);
});

test('headers', () => {
  assert.equal(parseMock('@device 600x800\n@look clean\ntext "a"').mock.device.w, 600);
  assert.equal(parseMock('@look clean\ntext "a"').mock.look, 'clean');
  assert.deepEqual(codes(parseMock('@device 50x800\ntext "a"')), ['bad_header']);
  assert.equal(parseMock('@requires 1.0\ntext "a"').ok, true);
  assert.deepEqual(codes(parseMock('@requires 2\ntext "a"')), ['bad_header']);
  assert.deepEqual(codes(parseMock('text "a"\n@look clean')), ['bad_header']);
  assert.deepEqual(codes(parseMock('@flow nope\nscreen a\n  text "x"')), ['bad_header']);
  assert.deepEqual(parseMock('@flow a -> b\nscreen a\n  text "x"\nscreen b\n  text "y"').mock.flow, ['a', 'b']);
});

test('indentation errors', () => {
  assert.deepEqual(codes(parseMock('stack\n  text "a"\n   text "b"')), ['bad_indent']);
  assert.deepEqual(codes(parseMock('stack\n\ttext "a"')), ['bad_indent']);
  assert.deepEqual(codes(parseMock('stack\n      text "a"')), ['bad_indent']);
  assert.equal(parseMock('stack\n    text "a"\n    text "b"').ok, true);
});

test('implicit main screen and dangling links', () => {
  const r = parseMock('stack\n  button "Go" -> nowhere\n  link "Back" -> back');
  assert.equal(r.mock.screens.length, 1);
  assert.equal(r.mock.screens[0].id, 'main');
  assert.deepEqual(codes(r), ['dangling_link']);
});

test('validation: attrs, enums, children, placement', () => {
  assert.deepEqual(codes(parseMock('button "a" wibble=3')), ['unknown_attr']);
  assert.deepEqual(codes(parseMock('stack pad=abc')), ['bad_value']);
  assert.deepEqual(codes(parseMock('stack align=top')), ['bad_value']);
  assert.deepEqual(codes(parseMock('grid cols=13')), ['bad_value']);
  assert.deepEqual(codes(parseMock('badge "x" tone=purple')), ['bad_value']);
  assert.deepEqual(codes(parseMock('button "a"\n  text "b"')), ['bad_value']);
  assert.deepEqual(codes(parseMock('stack\n  tab "t"')), ['bad_value']);
  assert.deepEqual(codes(parseMock('stack\n  item "t"')), ['bad_value']);
  assert.equal(parseMock('tabs\n  tab "t" selected\nlist\n  item "x"').warnings.length, 0);
  assert.equal(parseMock('stack w=fill h=hug').ok, true);
});

test('unknown kind is a warning', () => {
  const r = parseMock('carousel "x"');
  assert.equal(r.ok, true);
  assert.equal(r.mock.screens[0].root.children[0].kind, 'unknown');
  assert.equal(r.mock.screens[0].root.children[0].typed, 'carousel');
  assert.deepEqual(codes(r), ['unknown_kind']);
});

test('limits', () => {
  let deep = 'screen a\n';
  for (let i = 1; i <= 17; i++) deep += `${'  '.repeat(i)}stack\n`;
  assert.deepEqual(codes(parseMock(deep)), ['limit_depth']);
  let ok = 'screen a\n';
  for (let i = 1; i <= 16; i++) ok += `${'  '.repeat(i)}stack\n`;
  assert.equal(parseMock(ok).ok, true);
  assert.deepEqual(codes(parseMock(`text "${'a'.repeat(201)}"`)), ['limit_label']);
  assert.deepEqual(codes(parseMock('x'.repeat(WM_LIMITS.body + 1))), ['limit_body']);
  const many = Array.from({ length: 25 }, (_, i) => `screen s${i}\n  text "a"`).join('\n');
  assert.deepEqual(codes(parseMock(many)), ['limit_screens']);
  const notes = 'stack\n' + Array.from({ length: 100 }, () => '  text "a" note="n"').join('\n');
  assert.deepEqual(codes(parseMock(notes)), ['limit_notes']);
});

test('non-strings and fuzz never throw', () => {
  for (const v of [undefined, null, 5, {}, [], Symbol('x')]) {
    const r = parseMock(v);
    assert.equal(r.ok, false);
    assert.equal(r.errors[0].code, 'bad_value');
  }
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const bits = ['screen', 'variant', 'define', 'of', 'button', 'stack', '"', '\\', ' ', '  ', '\n', '#id', '->', '@device', '//', 'a=b', 'x="y"', '$p', 'hide', 'primary', '\t', '\r'];
  for (let i = 0; i < 200; i++) {
    let str = '';
    const n = Math.floor(rnd() * 60);
    for (let j = 0; j < n; j++) str += bits[Math.floor(rnd() * bits.length)];
    const r = parseMock(str, rnd() < 0.3 ? 'wiredown v1' : undefined);
    assert.equal(typeof r.ok, 'boolean');
  }
});

test('info string: look= overrides @look; any white space separates words', () => {
  assert.equal(parseMock('@look clean\ntext "a"', 'wiredown look=wire').mock.look, 'wire');
  assert.equal(parseMock('text "a"', 'screens\tlook=clean').mock.look, 'clean');
  assert.equal(parseMock('text "a"', 'wiredown  view=prototype').mock.view, 'prototype');
  assert.deepEqual(parseMock('text "a"', 'wiredown look=fancy').errors.map((e) => e.code), ['bad_header']);
});

test('info-string errors carry line 0 (message only)', () => {
  for (const info of ['wiredown look=fancy', 'wiredown view=grid', 'wiredown v2']) {
    const r = parseMock('text "a"', info);
    assert.equal(r.ok, false);
    assert.equal(r.errors[0].line, 0, info);
  }
});
