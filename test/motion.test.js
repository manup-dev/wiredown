import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMockBlock, lintMock, mockDigest, WIREDOWN_CSS } from '../src/index.js';

const BODY = (head, line = '') => `${head}screen a "A"${line}\n  button "Go" -> b\nscreen b "B"\n  text "Hi"`;
const classes = (html) => [...html.matchAll(/<div class="(wm-screen[^"]*)"/g)].map((m) => m[1]);

test('@motion adds wm-in-<motion> to every screen of a prototype figure', () => {
  const html = renderMockBlock(BODY('@motion slide\n'), 'wiredown view=prototype');
  assert.deepEqual(classes(html), ['wm-screen wm-start wm-in-slide', 'wm-screen wm-in-slide']);
});

test('screen motion= overrides the header, and none turns it off for that screen', () => {
  const html = renderMockBlock(BODY('@motion fade\n').replace('screen b "B"', 'screen b "B" motion=sheet'), 'wiredown view=prototype');
  assert.deepEqual(classes(html), ['wm-screen wm-start wm-in-fade', 'wm-screen wm-in-sheet']);
  const off = renderMockBlock(BODY('@motion fade\n', ' motion=none'), 'wiredown view=prototype');
  assert.deepEqual(classes(off), ['wm-screen wm-start', 'wm-screen wm-in-fade']);
});

test('no motion class outside the prototype view, and output is the same as without motion', () => {
  const plain = renderMockBlock(BODY(''), 'wiredown');
  const withMotion = renderMockBlock(BODY('@motion zoom\n', ' motion=push'), 'wiredown');
  assert.ok(!withMotion.includes('wm-in-'));
  assert.equal(withMotion.replace(/ data-wm-digest="[^"]+"/, ''), plain.replace(/ data-wm-digest="[^"]+"/, ''));
  const proto = renderMockBlock(BODY(''), 'wiredown view=prototype');
  assert.ok(!proto.includes('wm-in-'));
});

test('a bad @motion or motion= value is an error', () => {
  assert.ok(lintMock(BODY('@motion wobble\n'), 'wiredown').some((p) => p.severity === 'error' && p.line === 1));
  assert.ok(lintMock(BODY('', ' motion=wobble'), 'wiredown').some((p) => p.severity === 'error'));
  assert.ok(!lintMock(BODY('@motion push\n', ' motion=none'), 'wiredown view=prototype').some((p) => p.severity === 'error'));
});

test('the digest changes with motion', () => {
  assert.notEqual(mockDigest(BODY('@motion slide\n'), 'wiredown'), mockDigest(BODY(''), 'wiredown'));
});

test('the stylesheet fires on :target and .wm-current, scoped to the prototype, with a reduced-motion guard', () => {
  assert.ok(WIREDOWN_CSS.includes('.wm.wm-proto{overflow-x:clip}'));
  for (const m of ['slide', 'fade', 'push', 'sheet', 'zoom']) {
    assert.ok(WIREDOWN_CSS.includes(`.wm.wm-proto .wm-in-${m}:is(:target,.wm-current){animation:wm-${m} `));
    assert.ok(WIREDOWN_CSS.includes(`@keyframes wm-${m}{`));
  }
  assert.ok(WIREDOWN_CSS.includes('@media (prefers-reduced-motion:reduce){.wm.wm-proto [class*=wm-in-]{animation:none!important}}'));
});

test('motion= on a kind that is not a screen is an error', () => {
  assert.ok(lintMock('screen a "A"\n  button "Go" motion=slide', 'wiredown').some((p) => p.severity === 'error'));
});
