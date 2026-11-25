import test from 'node:test';
import assert from 'node:assert/strict';
import { mockPatch } from '../src/index.js';

const J = (...l) => l.join('\n');
const ok = (r) => { assert.equal(r.ok, true, r.message); return r; };
const SRC = J('screen a "A"', '  button "Save" primary icon=check #save // keep', '  list #l', '    item "Grace" "Editor" icon=user #g', '    item "Alan"', '  input "Email" placeholder=you #email', 'screen b "B"', '  text "B"', '');

test('set link to a screen, to back, and off', () => {
  assert.equal(ok(mockPatch(SRC, { set: 'save', link: 'b' })).body.split('\n')[1], '  button "Save" primary icon=check #save -> b // keep');
  const back = ok(mockPatch(SRC, { set: 'save', link: 'back' }));
  assert.equal(back.body.split('\n')[1], '  button "Save" primary icon=check #save -> back // keep');
  const off = ok(mockPatch(back.body, { set: 'save', link: null }));
  assert.equal(off.body, SRC);
  assert.equal(mockPatch(SRC, { set: 'save', link: 'nowhere' }).error, 'would_break');
  assert.equal(mockPatch(SRC, { set: 'save', link: 'Bad Id' }).error, 'bad_op');
  assert.equal(mockPatch(SRC, { set: 'save', link: 3 }).error, 'bad_op');
});

test('set kind between leaf kinds drops what the new kind does not take', () => {
  const r = ok(mockPatch(SRC, { set: 'save', kind: 'link' }));
  assert.equal(r.body.split('\n')[1], '  link "Save" icon=check #save // keep');
  assert.equal(r.id, 'save');
  const t = ok(mockPatch(SRC, { set: 'email', kind: 'text' }));
  assert.equal(t.body.split('\n')[5], '  text "Email" #email');
  assert.equal(mockPatch(SRC, { set: 'l', kind: 'text' }).error, 'bad_op'); // a list is not a leaf
  assert.equal(mockPatch(SRC, { set: 'save', kind: 'card' }).error, 'bad_op');
  assert.equal(mockPatch(SRC, { set: 'save', kind: 'divider' }).error, 'bad_op'); // takes no label
  assert.equal(mockPatch(SRC, { set: 'save', kind: 'gadget' }).error, 'bad_op');
  assert.equal(mockPatch(SRC, { set: 'save', kind: 'tab' }).error, 'cannot_hold');
});

test('a derived id follows its label and kind when pin is false', () => {
  const src = J('screen a', '  button "Save"', '');
  assert.equal(mockPatch(src, { set: 'button-save', label: 'Store' }).error, 'pin_first');
  const r = ok(mockPatch(src, { set: 'button-save', label: 'Store', pin: false }));
  assert.equal(r.body, J('screen a', '  button "Store"', ''));
  assert.equal(r.id, 'button-store');
  const k = ok(mockPatch(src, { set: 'button-save', kind: 'link', pin: false }));
  assert.equal(k.id, 'link-save');
  const p = ok(mockPatch(src, { set: 'button-save', label: 'Store', pin: true }));
  assert.equal(p.body, J('screen a', '  button "Store" #button-save', ''));
  assert.equal(p.id, 'button-save');
  assert.equal(mockPatch(src, { set: 'button-save', pin: false }).error, 'bad_op');
});

test('labelIndex edits an item\'s second label', () => {
  const r = ok(mockPatch(SRC, { set: 'g', label: 'Owner', labelIndex: 1 }));
  assert.equal(r.body.split('\n')[3], '    item "Grace" "Owner" icon=user #g');
  const add = ok(mockPatch(SRC, { set: 'item-alan', label: 'Viewer', labelIndex: 1, pin: false }));
  assert.equal(add.body.split('\n')[4], '    item "Alan" "Viewer"');
  const drop = ok(mockPatch(SRC, { set: 'g', label: null, labelIndex: 1 }));
  assert.equal(drop.body.split('\n')[3], '    item "Grace" icon=user #g');
  assert.equal(mockPatch(SRC, { set: 'g', label: null }).error, 'bad_op'); // the first label while a second exists
  assert.equal(mockPatch(SRC, { set: 'save', label: 'x', labelIndex: 1 }).error, 'bad_op'); // a button has one label
  assert.equal(mockPatch(SRC, { set: 'g', label: 'x', labelIndex: 2 }).error, 'bad_op');
  const bare = J('screen a', '  list', '    item', '');
  assert.equal(mockPatch(bare, { set: 'item', label: 'x', labelIndex: 1, pin: false }).error, 'bad_op');
});
