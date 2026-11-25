import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mockPatch, parseMock } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8');
const diff = (a, b) => {
  const x = a.split('\n'), y = b.split('\n');
  return { x, y };
};

test('set changes only the target line, canonical order', () => {
  const r = mockPatch(login, { set: 'submit', attrs: { w: null }, flags: { disabled: true } });
  assert.equal(r.ok, true);
  const { x, y } = diff(login, r.body);
  assert.equal(x.length, y.length);
  const changed = x.map((l, i) => i).filter((i) => x[i] !== y[i]);
  assert.deepEqual(changed, [10]);
  assert.equal(y[10], '    button "Sign in" primary disabled #submit note="Disabled until both fields are filled"');
});
test('remove drops the line and its children only', () => {
  const r = mockPatch(login, { remove: 'email' });
  assert.equal(r.body.split('\n').length, login.split('\n').length - 1);
  assert.ok(!r.body.includes('"Email" placeholder'));
  const rr = mockPatch(login, { remove: 'row-2' });
  assert.equal(rr.ok, false); // no such id (the row is row)
  const row = mockPatch(login, { remove: 'row' });
  assert.equal(row.ok, true);
  assert.ok(!row.body.includes('Remember me') && !row.body.includes('Forgot'));
});
test('add after and into', () => {
  const a = mockPatch(login, { add: { after: 'password' }, line: 'input "Code" #code' });
  const ls = a.body.split('\n');
  assert.equal(ls[7], '    input "Code" #code');
  assert.equal(ls[6], '    input "Password" type=password #password');
  const i = mockPatch('screen a\n  stack #s\n    text "x"\nscreen b\n  text "y"', { add: { into: 's' }, line: 'button "Go"' });
  assert.equal(i.body, 'screen a\n  stack #s\n    text "x"\n    button "Go"\nscreen b\n  text "y"');
});
test('derived id needs pin', () => {
  const src = 'screen a\n  button "Save" primary\n';
  assert.equal(mockPatch(src, { set: 'button-save', flags: { disabled: true } }).error, 'pin_first');
  const r = mockPatch(src, { set: 'button-save', pin: true, flags: { disabled: true } });
  assert.equal(r.body, 'screen a\n  button "Save" primary disabled #button-save\n');
});
test('keeps indent, comment and CRLF', () => {
  const src = 'screen a\r\n  button "Save" #save // keep me\r\n  text "x"\r\n';
  const r = mockPatch(src, { set: 'save', attrs: { icon: 'check' }, label: 'Store' });
  assert.equal(r.body, 'screen a\r\n  button "Store" icon=check #save // keep me\r\n  text "x"\r\n');
});
test('refuses define-made nodes', () => {
  const src = 'define pill label\n  badge "$label" #p\nscreen a\n  pill "x"\n';
  const id = parseMock(src).mock.screens[0].root.children[0].id;
  assert.equal(mockPatch(src, { set: id, flags: { muted: true }, pin: true }).error, 'in_define');
  assert.equal(mockPatch(src, { remove: id }).error, 'in_define');
  assert.equal(mockPatch(src, { add: { after: id }, line: 'text "y"' }).error, 'in_define');
});
test('variant patch lines: base is edited, would_break guards', () => {
  const r = mockPatch(login, { set: 'password', attrs: { placeholder: 'secret' } });
  assert.ok(r.body.includes('input "Password" type=password placeholder=secret #password'));
  assert.ok(r.body.includes('  #password error="That password is not right"'));
  assert.equal(mockPatch(login, { remove: 'password' }).error, 'would_break'); // the variant patch needs it
  assert.equal(mockPatch(login, { set: 'submit', attrs: { w: 'wide' } }).error, 'would_break');
});
test('bad input', () => {
  assert.equal(mockPatch(login, { set: 'nope' }).error, 'not_found');
  assert.equal(mockPatch(login, {}).error, 'bad_op');
  assert.equal(mockPatch('button "x" w=bad', { set: 'button-x', pin: true }).error, 'invalid_body');
  assert.equal(mockPatch(login, { add: { after: 'email' }, line: 'a\nb' }).error, 'bad_op');
});

test('set refuses structure-changing or unknown input, body unchanged', () => {
  const src = 'screen a\n  button "Save" #save\n';
  const bad = [
    { attrs: { 'a b': '1' } }, { attrs: { 'a=b': '1' } }, { attrs: { id: 'q' } }, { attrs: { colour: 'red' } },
    { flags: { wibble: true } }, { flags: { '#x': true } }, { flags: { '->a': true } },
    { attrs: { icon: 'a\rb' } }, { attrs: { icon: 'a\nb' } }, { label: 'x\ry' }, { label: 'x\ny' }, {},
  ];
  for (const b of bad) {
    const r = mockPatch(src, { set: 'save', ...b });
    assert.equal(r.ok, false, JSON.stringify(b));
    assert.ok(['bad_op', 'would_break'].includes(r.error), JSON.stringify(b));
  }
});
