import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mockPatch, parseMock, lintMock } from '../src/index.js';

const login = readFileSync(new URL('./fixtures/login.wiremark', import.meta.url), 'utf8');
const J = (...l) => l.join('\n');
const ok = (r) => { assert.equal(r.ok, true, r.message); return r; };
const errorsOf = (b) => lintMock(b).filter((e) => e.severity === 'error');

const TWO = J(
  'screen a "A"',
  '  stack #s',
  '    text "One" #one',
  '    text "Two" #two',
  '    row #r',
  '      button "Go" #go',
  '  card "Box" #box',
  '    text "In box"',
  'screen b "B"',
  '  stack #t',
  '    button "Back" -> a',
  '',
);

test('move after / before a sibling keeps every other line', () => {
  const r = ok(mockPatch(TWO, { move: 'one', after: 'two' }));
  assert.equal(r.body, TWO.replace('    text "One" #one\n    text "Two" #two', '    text "Two" #two\n    text "One" #one'));
  assert.equal(r.id, 'one');
  const b = ok(mockPatch(TWO, { move: 'r', before: 'one' }));
  assert.equal(b.body.split('\n').slice(1, 6).join('\n'), J('  stack #s', '    row #r', '      button "Go" #go', '    text "One" #one', '    text "Two" #two'));
});

test('move into a container at start and end, re-indented for its depth', () => {
  const end = ok(mockPatch(TWO, { move: 'one', into: 'r' }));
  assert.ok(end.body.includes(J('    row #r', '      button "Go" #go', '      text "One" #one')));
  const start = ok(mockPatch(TWO, { move: 'one', into: 'r', at: 'start' }));
  assert.ok(start.body.includes(J('    row #r', '      text "One" #one', '      button "Go" #go')));
  // a subtree moves up two levels: the card and its child keep their relative indent
  const up = ok(mockPatch(TWO, { move: 'box', into: 'r' }));
  assert.ok(up.body.includes(J('    row #r', '      button "Go" #go', '      card "Box" #box', '        text "In box"')));
  const out = ok(mockPatch(up.body, { move: 'box', after: 's' }));
  assert.equal(out.body, TWO);
});

test('move between screens', () => {
  const r = ok(mockPatch(TWO, { move: 'go', into: 't', at: 'start' }));
  assert.ok(r.body.includes(J('  stack #t', '    button "Go" #go', '    button "Back" -> a')));
  assert.ok(r.body.includes(J('    row #r', '  card "Box" #box')));
  assert.equal(r.id, 'go');
  const root = ok(mockPatch(TWO, { move: 'box', into: 'b' }));
  assert.ok(root.body.endsWith(J('    button "Back" -> a', '  card "Box" #box', '    text "In box"', '')));
});

test('move refusals: into itself, into its own subtree, by canHold, define, screen', () => {
  assert.equal(mockPatch(TWO, { move: 's', into: 'r' }).error, 'bad_move');
  assert.equal(mockPatch(TWO, { move: 's', into: 's' }).error, 'bad_move');
  assert.equal(mockPatch(TWO, { move: 'r', before: 'go' }).error, 'bad_move');
  assert.equal(mockPatch(TWO, { move: 'one', into: 'go' }).error, 'cannot_hold');
  const list = J('screen a', '  list #l', '    item "x"', '  text "T" #t', '');
  assert.equal(mockPatch(list, { move: 't', into: 'l' }).error, 'cannot_hold');
  assert.equal(mockPatch(list, { move: 'item-x', after: 't' }).error, 'cannot_hold');
  assert.equal(mockPatch(TWO, { move: 'a', after: 'b' }).error, 'bad_op');
  assert.equal(mockPatch(TWO, { move: 'one', after: 'nope' }).error, 'not_found');
  assert.equal(mockPatch(TWO, { move: 'one', after: 'two', into: 'r' }).error, 'bad_op');
  const def = J('define pill label', '  badge "$label" #p', 'screen a', '  pill "x"', '  text "y" #y', '');
  assert.equal(mockPatch(def, { move: 'p', after: 'y' }).error, 'in_define');
  assert.equal(mockPatch(def, { move: 'y', before: 'p' }).error, 'in_define');
  const r = mockPatch(J('screen a', '  modal "M" #m', '  stack #s', '    text "x"', ''), { move: 'm', into: 's' });
  assert.equal(r.error, 'cannot_hold');
});

test('move onto its own place writes nothing and still says ok', () => {
  for (const op of [{ move: 'one', before: 'two' }, { move: 'one', after: 'one' }, { move: 'two', after: 'one' }, { move: 'go', into: 'r' }]) {
    const r = ok(mockPatch(TWO, op));
    assert.equal(r.body, TWO, JSON.stringify(op));
  }
});

test('move keeps comments: attached ones travel, a deeper trailing one stays in the subtree', () => {
  const src = J('screen a', '  stack #s', '    // the first one', '    text "One" #one // inline', '    card #c', '      text "x"', '      // end of card', '', '    text "Two" #two', '');
  const r = ok(mockPatch(src, { move: 'one', after: 'two' }));
  assert.equal(r.body, J('screen a', '  stack #s', '    card #c', '      text "x"', '      // end of card', '', '    text "Two" #two', '    // the first one', '    text "One" #one // inline', ''));
  const c = ok(mockPatch(src, { move: 'c', after: 'two' }));
  assert.equal(c.body, J('screen a', '  stack #s', '    // the first one', '    text "One" #one // inline', '', '    text "Two" #two', '    card #c', '      text "x"', '      // end of card', ''));
});

test('move keeps CRLF and the 4-space unit', () => {
  const src = 'screen a\r\n    stack #s\r\n        text "One" #one\r\n    row #r\r\n';
  const r = ok(mockPatch(src, { move: 'one', into: 'r' }));
  assert.equal(r.body, 'screen a\r\n    stack #s\r\n    row #r\r\n        text "One" #one\r\n');
  const noEnd = ok(mockPatch('screen a\r\n  text "x" #x\r\n  row #r', { move: 'x', into: 'r' }));
  assert.equal(noEnd.body, 'screen a\r\n  row #r\r\n    text "x" #x');
});

test('implicit screen: move, add and duplicate with bare elements', () => {
  const src = J('@device phone', 'text "A" #a', 'row #r', '  button "B" #b', '');
  const up = ok(mockPatch(src, { move: 'b', before: 'a' }));
  assert.equal(up.body, J('@device phone', 'button "B" #b', 'text "A" #a', 'row #r', ''));
  const into = ok(mockPatch(src, { add: { into: 'main' }, line: 'divider' }));
  assert.equal(into.body, J('@device phone', 'text "A" #a', 'row #r', '  button "B" #b', 'divider', ''));
  assert.equal(into.id, 'divider');
  const first = ok(mockPatch(src, { add: { into: 'main', at: 'start' }, line: 'h1 "Hi"' }));
  assert.equal(first.body, J('@device phone', 'h1 "Hi"', 'text "A" #a', 'row #r', '  button "B" #b', ''));
  const end = ok(mockPatch(src, { move: 'a', into: 'main' }));
  assert.equal(end.body, J('@device phone', 'row #r', '  button "B" #b', 'text "A" #a', ''));
  const dup = ok(mockPatch(src, { duplicate: 'r' }));
  assert.equal(dup.body, J('@device phone', 'text "A" #a', 'row #r', '  button "B" #b', 'row', '  button "B"', ''));
});

test('duplicate copies the subtree after itself without repeating an explicit id', () => {
  const r = ok(mockPatch(TWO, { duplicate: 'r' }));
  assert.ok(r.body.includes(J('    row #r', '      button "Go" #go', '    row', '      button "Go"', '  card "Box" #box')));
  assert.equal(r.id, 'row');
  const ids = [];
  for (const s of parseMock(r.body).mock.screens) {
    const st = [s.root];
    while (st.length) { const n = st.pop(); if (n !== s.root) ids.push(`${s.id}/${n.id}`); st.push(...n.children); }
  }
  assert.equal(new Set(ids).size, ids.length);
  const derived = ok(mockPatch(J('screen a', '  button "Save"', '  button "Save"', ''), { duplicate: 'button-save' }));
  assert.equal(derived.body, J('screen a', '  button "Save"', '  button "Save"', '  button "Save"', ''));
  assert.equal(derived.id, 'button-save-2');
  const keep = ok(mockPatch('screen a\r\n  text "x" #x // note\r\n', { duplicate: 'x' }));
  assert.equal(keep.body, 'screen a\r\n  text "x" #x // note\r\n  text "x" // note\r\n');
  assert.equal(mockPatch(TWO, { duplicate: 'a' }).error, 'bad_op');
  const def = J('define pill label', '  badge "$label" #p', 'screen a', '  pill "x"', '');
  assert.equal(mockPatch(def, { duplicate: 'p' }).error, 'in_define');
});

test('add before, after, into with several lines keeping relative indentation', () => {
  const card = ['card', '    h3 "Title"', '    text "Body"'];
  const r = ok(mockPatch(TWO, { add: { before: 'two' }, lines: card }));
  assert.ok(r.body.includes(J('    text "One" #one', '    card', '      h3 "Title"', '      text "Body"', '    text "Two" #two')));
  assert.equal(r.id, 'card');
  const four = ok(mockPatch('screen a\n    stack #s\n        text "x"\n', { add: { into: 's', at: 'start' }, lines: ['  row', '    button "A"', '    button "B"'] }));
  assert.equal(four.body, 'screen a\n    stack #s\n        row\n            button "A"\n            button "B"\n        text "x"\n');
  const two = ok(mockPatch(TWO, { add: { after: 'go' }, lines: ['button "A" #ba', 'button "B" #bb'] }));
  assert.ok(two.body.includes(J('      button "Go" #go', '      button "A" #ba', '      button "B" #bb')));
  assert.equal(two.id, 'ba');
  const crlf = ok(mockPatch('screen a\r\n  stack #s\r\n', { add: { into: 's' }, lines: ['card', '  text "x"'] }));
  assert.equal(crlf.body, 'screen a\r\n  stack #s\r\n    card\r\n      text "x"\r\n');
});

test('add refusals', () => {
  assert.equal(mockPatch(TWO, { add: { into: 'go' }, line: 'text "x"' }).error, 'cannot_hold');
  assert.equal(mockPatch(TWO, { add: { into: 's' }, line: 'tab "x"' }).error, 'cannot_hold');
  assert.equal(mockPatch(TWO, { add: { into: 's' }, lines: [] }).error, 'bad_op');
  assert.equal(mockPatch(TWO, { add: { into: 's' }, lines: Array(41).fill('text "x"') }).error, 'bad_op');
  assert.equal(mockPatch(TWO, { add: { into: 's' }, lines: ['  text "x"', 'text "y"'] }).error, 'bad_op');
  assert.equal(mockPatch(TWO, { add: { into: 's' }, lines: ['card', '   text "x"', '  text "y"'] }).error, 'bad_op');
  assert.equal(mockPatch(TWO, { add: { into: 's' }, lines: ['text "x"', ''] }).error, 'bad_op');
  assert.equal(mockPatch(TWO, { add: { into: 's' }, line: 'text "x"', lines: ['text "y"'] }).error, 'bad_op');
  assert.equal(mockPatch(TWO, { add: { into: 's' }, line: 'text "x" #one' }).error, 'would_break');
  assert.equal(mockPatch(TWO, { add: { before: 'a' }, line: 'text "x"' }).error, 'bad_op');
});

test('every successful op leaves no new errors and a parseable block', () => {
  const ops = [{ move: 'go', into: 'box' }, { duplicate: 'box' }, { add: { after: 'box' }, lines: ['list', '  item "a"'] }];
  const r = ok(mockPatch(TWO, ops));
  assert.equal(errorsOf(r.body).length, 0);
  assert.equal(r.ids.length, 3);
  assert.equal(r.id, r.ids[2]);
  assert.equal(ok(mockPatch(login, { move: 'submit', before: 'email' })).id, 'submit');
});

test('screen scoping: derived ids repeat across screens, so ops can name the screen', () => {
  const src = J('screen a', '  stack', '    text "x"', 'screen b', '  stack', '    text "y"', 'variant c of b', '');
  const set = ok(mockPatch(src, { set: 'stack', screen: 'b', attrs: { gap: '4' }, pin: false }));
  assert.equal(set.body, src.replace('screen b\n  stack\n', 'screen b\n  stack gap=4\n'));
  assert.deepEqual([set.id, set.screen], ['stack', 'b']);
  const first = ok(mockPatch(src, { set: 'stack', attrs: { gap: '4' }, pin: false }));
  assert.equal(first.screen, 'a');
  // the target defaults to the moved element's own screen, toScreen picks another
  const own = ok(mockPatch(src, { move: 'text-y', screen: 'b', into: 'stack' }));
  assert.equal(own.body, src);
  const cross = ok(mockPatch(src, { move: 'text-y', screen: 'b', into: 'stack', toScreen: 'a' }));
  assert.equal(cross.body, J('screen a', '  stack', '    text "x"', '    text "y"', 'screen b', '  stack', 'variant c of b', ''));
  assert.deepEqual([cross.id, cross.screen], ['text-y', 'a']);
  const add = ok(mockPatch(src, { add: { into: 'stack', screen: 'b', at: 'start' }, line: 'h1 "Hi"' }));
  assert.ok(add.body.includes(J('screen b', '  stack', '    h1 "Hi"', '    text "y"')));
  assert.deepEqual([add.id, add.screen], ['h1-hi', 'b']);
  assert.equal(ok(mockPatch(src, { duplicate: 'stack', screen: 'b' })).screen, 'b');
  assert.equal(mockPatch(src, { remove: 'text-x', screen: 'b' }).error, 'not_found');
  assert.equal(mockPatch(src, { remove: 'stack', screen: 'c' }).error, 'not_found');
  assert.equal(mockPatch(src, { remove: 'stack', screen: 'z' }).error, 'not_found');
  assert.equal(mockPatch(src, { remove: 'stack', screen: 3 }).error, 'bad_op');
  assert.equal(ok(mockPatch(src, { variant: 'c', set: 'text-y', flags: { muted: true }, pin: false })).screen, 'c');
});
