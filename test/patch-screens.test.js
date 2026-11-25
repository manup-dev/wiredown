import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mockPatch, parseMock } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiremark', import.meta.url), 'utf8');
const J = (...l) => l.join('\n');
const ok = (r) => { assert.equal(r.ok, true, r.message); return r; };
const screenIds = (b) => parseMock(b).mock.screens.map((s) => s.id);

test('addScreen: id from the label, default body, at the end with the blank line style', () => {
  const r = ok(mockPatch(login, { addScreen: { label: 'Check your email' } }));
  assert.ok(r.body.endsWith(J('    button "Send link" primary w=fill', '', 'screen check-your-email "Check your email"', '  stack pad=16 gap=12', '')));
  assert.equal(r.id, 'check-your-email');
  assert.equal(r.body.slice(0, login.length - 1), login.slice(0, -1));
  const again = ok(mockPatch(r.body, { addScreen: { label: 'Check your email' } }));
  assert.equal(again.id, 'check-your-email-2');
  const digit = ok(mockPatch(login, { addScreen: { label: '2FA' } }));
  assert.equal(digit.id, 'screen-2fa');
  assert.equal(ok(mockPatch(login, { addScreen: { label: '' } })).id, 'screen');
});

test('addScreen after a screen goes after its variants; lines and id are kept', () => {
  const r = ok(mockPatch(login, { addScreen: { id: 'done', label: 'Done', after: 'login', lines: ['stack', '  h1 "Done"'] } }));
  assert.deepEqual(screenIds(r.body), ['login', 'login-error', 'done', 'reset']);
  assert.ok(r.body.includes(J('  #password error="That password is not right"', '', 'screen done "Done"', '  stack', '    h1 "Done"', '', 'screen reset')));
  assert.equal(mockPatch(login, { addScreen: { id: 'reset', label: 'X' } }).error, 'id_taken');
  assert.equal(mockPatch(login, { addScreen: { id: 'Bad', label: 'X' } }).error, 'bad_op');
  assert.equal(mockPatch(login, { addScreen: { label: 'X', after: 'nope' } }).error, 'not_found');
  assert.equal(mockPatch(login, { addScreen: { label: 'X', lines: ['item "x"'] } }).error, 'cannot_hold');
  assert.equal(mockPatch(login, { addScreen: { label: 'a\nb' } }).error, 'bad_op');
});

test('addScreen and renameScreen on an implicit screen write its screen line first', () => {
  const src = J('@device phone', 'text "A"', 'row', '  button "B"', '');
  const r = ok(mockPatch(src, { addScreen: { label: 'Next' } }));
  assert.equal(r.body, J('@device phone', 'screen main', '  text "A"', '  row', '    button "B"', '', 'screen next "Next"', '  stack pad=16 gap=12', ''));
  const n = ok(mockPatch(src, { renameScreen: 'main', label: 'Home' }));
  assert.equal(n.body, J('@device phone', 'screen main "Home"', '  text "A"', '  row', '    button "B"', ''));
  const def = J('text "A"', 'define x', '  text "x"', 'text "B"', '');
  assert.equal(mockPatch(def, { addScreen: { label: 'N' } }).error, 'bad_op');
});

test('renameScreen sets, replaces and removes a screen or variant label', () => {
  const r = ok(mockPatch(login, { renameScreen: 'reset', label: 'New "password"' }));
  assert.ok(r.body.includes('screen reset "New \\"password\\""\n'));
  const v = ok(mockPatch(login, { renameScreen: 'login-error', label: 'Error' }));
  assert.ok(v.body.includes('variant login-error of login "Error"\n'));
  const off = ok(mockPatch(login, { renameScreen: 'reset', label: null }));
  assert.ok(off.body.includes('\nscreen reset\n'));
  const on = ok(mockPatch('screen a pad=4 // c\n  text "x"\n', { renameScreen: 'a', label: 'A' }));
  assert.equal(on.body, 'screen a "A" pad=4 // c\n  text "x"\n');
  assert.equal(mockPatch(login, { renameScreen: 'nope', label: 'x' }).error, 'not_found');
  assert.equal(mockPatch(login, { renameScreen: 'submit', label: 'x' }).error, 'not_found');
});

test('removeScreen: variants go with it, links are refused unless unlink', () => {
  assert.equal(mockPatch(login, { removeScreen: 'reset' }).error, 'dangling_link');
  const r = ok(mockPatch(login, { removeScreen: 'reset', unlink: true }));
  assert.ok(r.body.includes('      link "Forgot password?"\n'));
  assert.ok(r.body.endsWith('  #password error="That password is not right"\n'));
  assert.deepEqual(screenIds(r.body), ['login', 'login-error']);
  const base = ok(mockPatch(login, { removeScreen: 'login', unlink: true }));
  assert.deepEqual(screenIds(base.body), ['reset']);
  assert.ok(base.body.startsWith(J('@device phone', '@title "Sign in"', 'screen reset "Reset password"', '  navbar "Reset password" back', '')));
  const v = ok(mockPatch(login, { removeScreen: 'login-error' }));
  assert.equal(v.body, login.replace('variant login-error of login "Wrong password"\n  #password error="That password is not right"\n\n', ''));
  assert.equal(v.id, null);
  assert.equal(mockPatch(J('screen a', '  text "x"', ''), { removeScreen: 'a' }).error, 'last_screen');
  assert.equal(mockPatch(J('text "x"', ''), { removeScreen: 'main' }).error, 'last_screen');
  const flow = J('@flow a b', 'screen a', '  button "Go" -> b', 'screen b', '  text "x"', '');
  assert.equal(ok(mockPatch(flow, { removeScreen: 'b', unlink: true })).body, J('@flow a', 'screen a', '  button "Go"', ''));
});

test('moveScreen before and after; a base carries its variants', () => {
  const r = ok(mockPatch(login, { moveScreen: 'reset', before: 'login' }));
  assert.deepEqual(screenIds(r.body), ['reset', 'login', 'login-error']);
  assert.ok(r.body.startsWith(J('@device phone', '@title "Sign in"', 'screen reset "Reset password"', '  navbar "Reset password" back -> login', '  stack pad=24 gap=16', '    input "Email" #reset-email', '    button "Send link" primary w=fill', '', 'screen login "Sign in"')));
  const back = ok(mockPatch(r.body, { moveScreen: 'reset', after: 'login' }));
  assert.equal(back.body, login);
  const v = ok(mockPatch(login, { moveScreen: 'login-error', after: 'reset' }));
  assert.ok(v.body.endsWith(J('    button "Send link" primary w=fill', '', 'variant login-error of login "Wrong password"', '  #password error="That password is not right"', '')));
  assert.equal(ok(mockPatch(login, { moveScreen: 'reset', after: 'reset' })).body, login);
  assert.equal(mockPatch(login, { moveScreen: 'login', after: 'login-error' }).error, 'bad_move');
  assert.equal(mockPatch(login, { moveScreen: 'nope', after: 'login' }).error, 'not_found');
  assert.equal(mockPatch(login, { moveScreen: 'reset' }).error, 'bad_op');
});

test('header sets, adds in order and removes device, look and title', () => {
  const d = ok(mockPatch(login, { header: 'device', value: 'tablet fit' }));
  assert.equal(d.body, login.replace('@device phone\n', '@device tablet fit\n'));
  const l = ok(mockPatch(login, { header: 'look', value: 'clean' }));
  assert.ok(l.body.startsWith('@device phone\n@look clean\n@title "Sign in"\n'));
  const t = ok(mockPatch(login, { header: 'title', value: null }));
  assert.equal(t.body, login.replace('@title "Sign in"\n', ''));
  const fresh = ok(mockPatch('screen a\r\n  text "x"\r\n', { header: 'title', value: 'Hi "there"' }));
  assert.equal(fresh.body, '@title "Hi \\"there\\""\r\nscreen a\r\n  text "x"\r\n');
  assert.equal(ok(mockPatch('@device phone // main\nscreen a\n', { header: 'device', value: 'laptop' })).body, '@device laptop // main\nscreen a\n');
  assert.equal(ok(mockPatch(login, { header: 'look', value: null })).body, login);
  assert.equal(mockPatch(login, { header: 'device', value: 'watch' }).error, 'would_break');
  assert.equal(mockPatch(login, { header: 'look', value: 'neon' }).error, 'bad_op');
  assert.equal(mockPatch(login, { header: 'flow', value: 'a' }).error, 'bad_op');
  assert.equal(mockPatch(login, { header: 'device', value: 'phone // x' }).error, 'bad_op');
});

test('variant patch: writes a new patch line, updates an existing one, removes an emptied one', () => {
  const add = ok(mockPatch(login, { variant: 'login-error', set: 'submit', flags: { disabled: true } }));
  assert.ok(add.body.includes(J('  #password error="That password is not right"', '  #submit disabled', '')));
  assert.equal(add.id, 'submit');
  const upd = ok(mockPatch(login, { variant: 'login-error', set: 'password', attrs: { placeholder: 'Try again' }, hide: false }));
  assert.ok(upd.body.includes('  #password error="That password is not right" placeholder="Try again"\n'));
  const hide = ok(mockPatch(login, { variant: 'login-error', set: 'email', hide: true }));
  assert.ok(hide.body.includes('  #email hide\n'));
  const gone = ok(mockPatch(login, { variant: 'login-error', set: 'password', attrs: { error: null } }));
  assert.equal(gone.body, login.replace('  #password error="That password is not right"\n', ''));
  const derived = J('screen a', '  button "Go"', 'variant b of a', '');
  assert.equal(mockPatch(derived, { variant: 'b', set: 'button-go', flags: { primary: true } }).error, 'pin_first');
  assert.equal(ok(mockPatch(derived, { variant: 'b', set: 'button-go', flags: { primary: true }, pin: true })).body, J('screen a', '  button "Go" #button-go', 'variant b of a', '  #button-go primary', ''));
  assert.equal(mockPatch(login, { variant: 'login', set: 'submit', hide: true }).error, 'not_found');
  assert.equal(mockPatch(login, { variant: 'login-error', set: 'reset-email', hide: true }).error, 'not_found');
  assert.equal(mockPatch(login, { variant: 'login-error', set: 'submit', flags: { hide: true } }).error, 'bad_op');
  assert.equal(mockPatch(login, { variant: 'login-error', set: 'submit', attrs: { tone: 'bad' } }).error, 'would_break');
  assert.equal(mockPatch(login, { variant: 'login-error', set: 'submit' }).error, 'bad_op');
  const def = J('define pill label', '  badge "$label" #p', 'screen a', '  pill "x"', 'variant b of a', '');
  assert.equal(mockPatch(def, { variant: 'b', set: 'p', hide: true }).error, 'in_define');
});

test('screen ops keep CRLF, attached comments travel, and an empty body can grow a screen', () => {
  const crlf = login.split('\n').join('\r\n');
  const r = ok(mockPatch(crlf, [{ moveScreen: 'reset', before: 'login' }, { addScreen: { label: 'End' } }, { removeScreen: 'login-error' }]));
  assert.ok(!r.body.replace(/\r\n/g, '').includes('\n'));
  assert.deepEqual(screenIds(r.body), ['reset', 'login', 'end']);
  assert.deepEqual(r.ids, ['reset', 'end', null]);
  const src = J('screen a', '  text "a"', '', '// about b', 'screen b', '  text "b"', '');
  const m = ok(mockPatch(src, { moveScreen: 'b', before: 'a' }));
  assert.equal(m.body, J('// about b', 'screen b', '  text "b"', '', 'screen a', '  text "a"', ''));
  const gone = ok(mockPatch(src, { removeScreen: 'b' }));
  assert.equal(gone.body, J('screen a', '  text "a"', ''));
  const empty = ok(mockPatch('', { addScreen: { label: 'First' } }));
  assert.equal(empty.body, J('screen first "First"', '  stack pad=16 gap=12', ''));
});
