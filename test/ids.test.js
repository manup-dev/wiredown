import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMock, slug, deriveIds } from '../src/index.js';

const find = (n, id) => (n.id === id ? n : n.children.map((c) => find(c, id)).find(Boolean));

test('slug rules', () => {
  assert.equal(slug('Welcome back'), 'welcome-back');
  assert.equal(slug('  Hi!!  There '), 'hi-there');
  assert.equal(slug('日本語'), '');
  assert.equal(slug('a'.repeat(60)).length, 40);
  assert.equal(slug('ab-' + 'c'.repeat(37) + ' d'), 'ab-' + 'c'.repeat(37));
});

test('derived ids from the login fixture', () => {
  const m = parseMock('screen a\n  h1 "Welcome back"\n  checkbox "Remember me"\n  input "Email" #email\n  stack').mock;
  const r = m.screens[0].root;
  assert.ok(find(r, 'h1-welcome-back'));
  assert.ok(find(r, 'checkbox-remember-me'));
  assert.equal(find(r, 'email').explicitId, true);
  assert.ok(find(r, 'stack'));
});

test('repeats get -2, -3 in source order', () => {
  const m = parseMock('button "OK"\nbutton "OK"\nbutton "OK"').mock;
  assert.deepEqual(m.screens[0].root.children.map((c) => c.id), ['button-ok', 'button-ok-2', 'button-ok-3']);
});

test('derived ids avoid explicit ones', () => {
  const m = parseMock('button "OK" #button-ok-2\nbutton "OK"\nbutton "OK"').mock;
  assert.deepEqual(m.screens[0].root.children.map((c) => c.id), ['button-ok-2', 'button-ok', 'button-ok-3']);
});

test('duplicate explicit id is an error on the second line', () => {
  const r = parseMock('input "a" #x\ntext "b"\ninput "c" #x');
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'duplicate_id');
  assert.equal(r.errors[0].line, 3);
  assert.equal(parseMock('screen a\n  text "x" #t\nscreen a\n  text "y"').errors[0].code, 'duplicate_id');
});

test('bad explicit id and deriveIds export', () => {
  assert.equal(parseMock('text "a" #Bad').errors[0].code, 'bad_value');
  const s = { root: { kind: 'screen', id: 's', explicitId: true, labels: [], children: [{ kind: 'text', id: '', explicitId: false, labels: ['Hi'], children: [] }] } };
  deriveIds(s);
  assert.equal(s.root.children[0].id, 'text-hi');
});
