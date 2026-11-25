import test from 'node:test';
import assert from 'node:assert/strict';
import { textWidth, wrapText, resolveDevice, DEVICES } from '../src/index.js';

test('narrow, wide, marks, bold', () => {
  assert.ok(textWidth('iii', 10) < textWidth('mmm', 10));
  assert.equal(textWidth('́', 10), 0);
  assert.equal(textWidth('日本', 10), 20);
  assert.ok(textWidth('abc', 10, 'bold') > textWidth('abc', 10));
  assert.ok(Math.abs(textWidth('1', 10) - 5.6) < 1e-9);
});

test('wrapText wraps at spaces within the width', () => {
  const lines = wrapText('hello world foo', 15, 60);
  assert.ok(lines.length >= 2);
  for (const l of lines) assert.ok(textWidth(l, 15) <= 60, l);
  assert.equal(lines.join(' '), 'hello world foo');
});

test('unspaced runs and CJK break per grapheme', () => {
  const long = 'x'.repeat(300);
  const lines = wrapText(long, 15, 100);
  assert.ok(lines.length > 10);
  assert.equal(lines.join(''), long);
  const cjk = wrapText('日本語のテキストです', 15, 45);
  assert.equal(cjk.join(''), '日本語のテキストです');
  assert.ok(cjk.length >= 3);
  for (const l of cjk) assert.ok(textWidth(l, 15) <= 45);
});

test('marks stay with their base character', () => {
  const s = 'é'.repeat(40);
  for (const l of wrapText(s, 15, 50)) assert.ok(!l.startsWith('́'));
});

test('empty text is one empty line', () => assert.deepEqual(wrapText('', 15, 100), ['']));

test('devices', () => {
  assert.deepEqual(resolveDevice('phone'), { name: 'phone', w: 390, h: 844 });
  assert.deepEqual(resolveDevice('600x900'), { name: '600x900', w: 600, h: 900 });
  assert.equal(resolveDevice('50x900'), null);
  assert.equal(resolveDevice('toString'), null);
  assert.equal(DEVICES.desktop.w, 1440);
});

test('CJK glues without fake spaces, astral included', () => {
  assert.deepEqual(wrapText('ab中cd ef', 15, 400), ['ab中cd ef']);
  assert.deepEqual(wrapText('𠀀𠀁𠀂', 15, 400), ['𠀀𠀁𠀂']);
  assert.deepEqual(wrapText('中 文', 15, 400), ['中 文']);
  const l = wrapText('中文中文中文', 15, 40);
  assert.ok(l.length > 1);
  assert.equal(l.join(''), '中文中文中文');
});
