import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mockTree, kindForm, PALETTE, ICON_NAMES, ICONS, KINDS, canHold, mockPatch, lintMock, parseMock } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8');
const J = (...l) => l.join('\n');

test('mockTree: screens, elements in source order with parent, index, depth, axis and accepts', () => {
  const t = mockTree(login, 'wiredown');
  assert.equal(t.ok, true);
  assert.deepEqual(t.screens.map((s) => [s.id, s.label, s.line, s.variantOf, s.implicit]), [
    ['login', 'Sign in', 3, null, false], ['login-error', 'Wrong password', 13, 'login', false], ['reset', 'Reset password', 16, null, false],
  ]);
  const els = t.screens[0].elements;
  assert.deepEqual(els.map((e) => e.id), ['login', 'stack', 'h1-welcome-back', 'email', 'password', 'row', 'checkbox-remember-me', 'link-forgot-password', 'submit']);
  const root = els[0];
  assert.deepEqual([root.kind, root.parent, root.index, root.depth, root.container, root.axis, root.accepts, root.editable, root.reason], ['screen', null, 0, 0, true, 'column', 'any', false, 'frame']);
  const row = els.find((e) => e.id === 'row');
  assert.deepEqual([row.parent, row.index, row.depth, row.axis, row.line, row.container], ['stack', 3, 2, 'row', 8, true]);
  const submit = els.find((e) => e.id === 'submit');
  assert.deepEqual([submit.kind, submit.labels, submit.flags, submit.attrs, submit.note, submit.explicitId, submit.link, submit.axis, submit.accepts, submit.editable, submit.reason], ['button', ['Sign in'], ['primary'], { w: 'fill' }, 'Disabled until both fields are filled', true, null, null, 'none', true, undefined]);
  assert.equal(els.find((e) => e.id === 'link-forgot-password').link, 'reset');
  const v = t.screens[1].elements;
  assert.equal(v.find((e) => e.id === 'password').attrs.error, 'That password is not right');
  assert.deepEqual(v.map((e) => [e.editable, e.reason]).slice(0, 2), [[false, 'frame'], [false, 'variant']]);
  assert.equal(Object.isFrozen(t.screens[0].elements[1]), true);
  assert.equal(mockTree(login, 'wiredown'), t); // memoised
});

test('mockTree: define elements, implicit screens, lists and grids, failures', () => {
  const src = J('define field label', '  input "$label"', 'grid cols=2 #g', '  field "Email"', 'list', '  item "a"', 'gadget "x"', '');
  const t = mockTree(src, '');
  const s = t.screens[0];
  assert.deepEqual([s.id, s.implicit, s.line], ['main', true, null]);
  const by = Object.fromEntries(s.elements.map((e) => [e.id, e]));
  assert.deepEqual([by.main.line, by.main.parent], [null, null]);
  assert.deepEqual([by.g.axis, by.g.depth, by.g.parent], ['grid', 1, 'main']);
  assert.deepEqual([by['input-email'].fromDefine, by['input-email'].editable, by['input-email'].reason, by['input-email'].line], ['field', false, 'define', 4]);
  assert.deepEqual(by.list.accepts, ['item']);
  assert.equal(by.list.axis, 'column');
  assert.deepEqual([by['gadget-x'].kind, by['gadget-x'].typed, by['gadget-x'].container, by['gadget-x'].accepts], ['unknown', 'gadget', false, 'none']);
  assert.equal(mockTree('screen (', '').ok, false);
  assert.equal(mockTree(42).ok, false);
});

test('kindForm: groups, flags, typed attrs with box attributes last', () => {
  const b = kindForm('button');
  assert.deepEqual([b.kind, b.group, b.container, b.accepts, b.flags], ['button', 'control', false, 'none', ['primary', 'disabled', 'loading', 'selected', 'back']]);
  assert.deepEqual(b.labels, [{ name: 'label', type: 'string' }]);
  assert.deepEqual(b.attrs[0], { name: 'icon', type: 'icon' });
  assert.deepEqual(b.attrs.map((a) => a.name), ['icon', 'w', 'h', 'pad', 'gap', 'grow', 'align', 'justify', 'span', 'note']);
  assert.deepEqual(b.attrs.find((a) => a.name === 'align'), { name: 'align', type: 'enum', options: ['start', 'center', 'end', 'stretch'] });
  assert.deepEqual(b.attrs.find((a) => a.name === 'w'), { name: 'w', type: 'size' });
  assert.deepEqual(kindForm('grid').attrs[0], { name: 'cols', type: 'number', min: 1, max: 12 });
  assert.deepEqual(kindForm('icon').labels, [{ name: 'label', type: 'icon' }]);
  assert.deepEqual(kindForm('item').labels.map((l) => l.name), ['label', 'detail']);
  assert.deepEqual(kindForm('list').accepts, ['item']);
  assert.equal(kindForm('divider').labels.length, 0);
  assert.equal(kindForm('nope'), null);
  for (const k of Object.keys(KINDS)) assert.equal(kindForm(k).attrs.length, Object.keys(KINDS[k].attrs).length);
});

test('canHold mirrors the placement rules', () => {
  assert.equal(canHold('stack', 'button'), true);
  assert.equal(canHold('list', 'item'), true);
  assert.equal(canHold('tabbar', 'item'), true);
  assert.equal(canHold('stack', 'item'), false);
  assert.equal(canHold('list', 'text'), false);
  assert.equal(canHold('tabs', 'tab'), true);
  assert.equal(canHold('row', 'tab'), false);
  assert.equal(canHold('button', 'text'), false);
  assert.equal(canHold('screen', 'modal'), true);
  assert.equal(canHold('stack', 'modal'), false);
  assert.equal(canHold('stack', 'screen'), false);
  assert.equal(canHold('nope', 'text'), false);
  assert.equal(canHold('card', 'unknown'), true);
});

test('every PALETTE item adds into a screen and lints clean', () => {
  const ids = new Set();
  const kinds = new Set();
  for (const g of PALETTE) {
    assert.ok(g.group && g.items.length);
    for (const it of g.items) {
      assert.ok(!ids.has(it.id), it.id);
      ids.add(it.id);
      kinds.add(it.kind);
      const r = mockPatch('screen a\n  stack\n', { add: { into: 'a' }, lines: it.lines });
      assert.equal(r.ok, true, `${it.id}: ${r.message}`);
      assert.deepEqual(lintMock(r.body), [], it.id);
      assert.equal(parseMock(r.body).mock.screens[0].root.children[1].kind, it.kind, it.id);
      const crlf = mockPatch('screen a\r\n    stack\r\n', { add: { into: 'a' }, lines: it.lines });
      assert.equal(crlf.ok, true, it.id);
    }
  }
  for (const k of Object.keys(KINDS)) if (!['screen', 'item', 'tab'].includes(k)) assert.ok(kinds.has(k), `palette lacks ${k}`);
  assert.equal(Object.isFrozen(PALETTE) && Object.isFrozen(PALETTE[0].items[0].lines), true);
});

test('ICON_NAMES is the sorted key list of ICONS', () => {
  assert.deepEqual([...ICON_NAMES], Object.keys(ICONS).sort());
  assert.deepEqual([...ICON_NAMES].sort(), [...ICON_NAMES]);
  assert.equal(Object.isFrozen(ICON_NAMES), true);
});

test('mockTree: referenced marks an element a variant patch names (fix round #2)', () => {
  const src = J('screen home', '  button "Go"', '  text "Hi"', 'variant off of home', '  #button-go disabled', '');
  const t = mockTree(src, '');
  const home = Object.fromEntries(t.screens[0].elements.map((e) => [e.id, e]));
  assert.equal(home['button-go'].referenced, true);
  assert.equal(home['text-hi'].referenced, false);
  assert.equal(home.home.referenced, false);
  const off = Object.fromEntries(t.screens[1].elements.map((e) => [e.id, e]));
  assert.equal(off['button-go'].referenced, true);
  // Relabelling a referenced derived id must pin it, or the patch is orphaned.
  assert.equal(mockPatch(src, { set: 'button-go', screen: 'home', label: 'Continue', pin: false }).error, 'would_break');
  const pinned = mockPatch(src, { set: 'button-go', screen: 'home', label: 'Continue', pin: true });
  assert.equal(pinned.ok, true);
  assert.match(pinned.body, /button "Continue" #button-go/);
});
