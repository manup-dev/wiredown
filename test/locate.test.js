import test from 'node:test';
import assert from 'node:assert/strict';
import { locateElement, elementAtLine, bodyLineSpan } from '../src/index.js';

const BODY = [
  'define field label',
  '  card',
  '    button "Go"',
  'screen a "A"',
  '  stack',
  '    field "X" // the field',
  '    button "Save"',
  '    input "Email" #email',
  'screen b "B"',
  '  button "Save"',
  'variant a2 of a "A two"',
  '  #email error="No"',
].join('\n');

test('locateElement: node, define use, variant base, frame, twin on another screen', () => {
  assert.deepEqual(locateElement(BODY, '', 'email', 'a'), { line: 8, elementId: 'email', screenId: 'a', label: 'input "Email"', pin: null, frame: false });
  assert.deepEqual(locateElement(BODY, '', 'button-go', 'a'), { line: 6, elementId: 'card', screenId: 'a', label: 'field "X"', pin: 'use', frame: false });
  assert.equal(locateElement(BODY, '', 'email', 'a2').screenId, 'a');
  assert.equal(locateElement(BODY, '', 'email', 'a2').line, 8);
  assert.deepEqual(locateElement(BODY, '', 'a', 'a'), { line: 4, elementId: 'a', screenId: 'a', label: 'screen "A"', pin: null, frame: true });
  assert.equal(locateElement(BODY, '', 'button-save', 'a').pin, 'patch');
  assert.deepEqual([locateElement(BODY, '', 'button-save', 'b').line, locateElement(BODY, '', 'button-save', 'b').pin], [10, null]);
  assert.equal(locateElement('button "Go"', '', 'main', 'main'), null);
  assert.equal(locateElement(BODY, '', 'Not An Id'), null);
  assert.equal(locateElement('screen (', '', 'x'), null);
});

test('elementAtLine: one element per line, null for others', () => {
  assert.equal(elementAtLine(BODY, '', 8).elementId, 'email');
  assert.equal(elementAtLine(BODY, '', 6).elementId, 'card');
  assert.equal(elementAtLine(BODY, '', 4).frame, true);
  assert.equal(elementAtLine(BODY, '', 1), null);
  assert.equal(elementAtLine(BODY, '', 3), null);
  assert.equal(elementAtLine(BODY, '', 12), null);
  assert.equal(elementAtLine(BODY, '', 0), null);
});

test('bodyLineSpan: trimmed, through a container prefix', () => {
  const text = '- item\n\n  ```wiremark\n  button "Go"  \n  ```\n';
  const s = bodyLineSpan(text, text.indexOf('  ```wiremark'), 'button "Go"  \n', 1);
  assert.equal(text.slice(s.from, s.to), 'button "Go"');
  assert.equal(s.at, text.indexOf('button'));
  assert.equal(bodyLineSpan(text, 0, 'other', 1), null);
});
