import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMock, layoutScreen } from '../src/index.js';

// A label never breaks inside a word while the word fits the room its row could give it
// (seen in a browser: `button "Archive" icon=check` in a phone row drew "Archiv" / "e").
const lay = (body) => {
  const r = parseMock(body);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return layoutScreen(r.mock.screens[0], r.mock.device);
};
const leaves = (b, out = []) => { if (!b.children.length) out.push(b); for (const c of b.children) leaves(c, out); return out; };
const words = (lines) => lines.join(' ').split(/\s+/).filter(Boolean);
const labelOf = (b) => b.node.labels[0] || '';

function assertNoMidWord(l) {
  for (const b of leaves(l.root)) {
    if (!b.lines || !labelOf(b)) continue;
    assert.deepEqual(words(b.lines), words([labelOf(b)]), `${b.node.kind} "${labelOf(b)}" drew ${JSON.stringify(b.lines)}`);
  }
}

test('a row of icon buttons on a phone keeps every word whole', () => {
  const l = lay('@device phone\nscreen inbox "Inbox"\n  row gap=8\n    button "Archive" icon=check\n    button "Delete" icon=trash\n    button "Mark as read"\n');
  assertNoMidWord(l);
});

test('a long text beside a button gives way; the button label stays whole', () => {
  const l = lay('@device phone\nscreen inbox "Inbox"\n  row gap=8\n    text "Message from Alice about the meeting"\n    button "Archive" icon=check\n');
  assertNoMidWord(l);
  const btn = leaves(l.root).find((b) => b.node.kind === 'button');
  assert.deepEqual(btn.lines, ['Archive']);
});

test('nested rows and checkboxes keep words whole when they can', () => {
  const l = lay('@device phone\nscreen s\n  row gap=8\n    checkbox "Remember everything"\n    row gap=4\n      button "Continue" icon=check\n      button "Cancel"\n');
  assertNoMidWord(l);
});

test('a word wider than the whole line still breaks (nothing overflows)', () => {
  const l = lay('@device 200x400\nscreen s\n  row\n    button "Supercalifragilisticexpialidocious"\n');
  const btn = leaves(l.root).find((b) => b.node.kind === 'button');
  assert.ok(btn.lines.length > 1);
  assert.ok(btn.x + btn.w <= 200);
});

test('a row that fits is laid out as before (hug widths)', () => {
  const l = lay('row\n  button "A" #a\n  button "B" #b\n');
  const a = leaves(l.root).find((b) => b.node.id === 'a');
  assert.deepEqual(a.lines, ['A']);
});
