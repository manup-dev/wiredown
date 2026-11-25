import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { WM_LIMITS, wmError, lexLine, splitLines } from '../src/index.js';

test('limits are frozen with exact values', () => {
  assert.ok(Object.isFrozen(WM_LIMITS));
  assert.deepEqual({ ...WM_LIMITS }, { body: 65536, lines: 1500, lineLength: 500, tokensPerLine: 40, screens: 24, variants: 48, nodes: 2000, depth: 16, label: 200, defines: 50, notes: 99, deviceMax: 4000, output: 524288 });
  assert.deepEqual(wmError(1, 2, 'x', 'm'), { line: 1, column: 2, code: 'x', message: 'm' });
});

test('indent counting and blank/comment lines', () => {
  assert.equal(lexLine('    text', 3).indent, 4);
  assert.deepEqual(lexLine('', 1), { indent: 0, tokens: [], comment: null });
  assert.deepEqual(lexLine('  // hi there', 1), { indent: 2, tokens: [], comment: 'hi there' });
});

test('token kinds with columns', () => {
  const r = lexLine('input "Em\\"ail\\\\" k=v n="a b" #email -> reset @phone word', 1);
  assert.deepEqual(r.tokens, [
    { t: 'word', v: 'input', col: 1 },
    { t: 'label', v: 'Em"ail\\', col: 7 },
    { t: 'kv', k: 'k', v: 'v', quoted: false, col: 19 },
    { t: 'kv', k: 'n', v: 'a b', quoted: true, col: 23 },
    { t: 'id', v: 'email', col: 31 },
    { t: 'link', v: 'reset', col: 38 },
    { t: 'at', v: 'phone', col: 47 },
    { t: 'word', v: 'word', col: 54 },
  ]);
  assert.deepEqual(lexLine('link "x" ->   spaced', 1).tokens[2], { t: 'link', v: 'spaced', col: 10 });
  assert.deepEqual(lexLine('@device phone', 1).tokens, [{ t: 'at', v: 'device', col: 1 }, { t: 'word', v: 'phone', col: 9 }]);
  assert.deepEqual(lexLine('x w=#fff', 1).tokens[1], { t: 'kv', k: 'w', v: '#fff', quoted: false, col: 3 });
});

test('comments after tokens, not inside labels', () => {
  const r = lexLine('text "a // b" // real', 1);
  assert.deepEqual(r.tokens, [{ t: 'word', v: 'text', col: 1 }, { t: 'label', v: 'a // b', col: 6 }]);
  assert.equal(r.comment, 'real');
  assert.equal(lexLine('text note="x // y"', 1).comment, null);
});

test('errors', () => {
  assert.deepEqual(lexLine('text "oops', 4), { error: wmError(4, 6, 'bad_label', 'This label is missing its closing quote.') });
  assert.equal(lexLine('text k="oops', 4).error.code, 'bad_label');
  assert.equal(lexLine('text k="oops', 4).error.column, 8);
  const t = lexLine('  \ttext', 2).error;
  assert.equal(t.code, 'bad_indent');
  assert.equal(t.line, 2);
  assert.equal(t.column, 3);
  assert.equal(lexLine('a\tb', 1).tokens.length, 2);
  const many = lexLine(Array(41).fill('a').join(' '), 7);
  assert.equal(many.error.code, 'limit_tokens');
  assert.equal(many.error.line, 7);
  assert.equal(lexLine(Array(40).fill('a').join(' '), 7).tokens.length, 40);
});

test('splitLines', () => {
  assert.deepEqual(splitLines('a\r\nb\n\nc'), [{ lineNo: 1, text: 'a' }, { lineNo: 2, text: 'b' }, { lineNo: 3, text: '' }, { lineNo: 4, text: 'c' }]);
  const long = splitLines('ok\n' + 'x'.repeat(501));
  assert.equal(long.error.code, 'limit_line_length');
  assert.equal(long.error.line, 2);
  assert.equal(splitLines('x'.repeat(500)).length, 1);
  assert.equal(splitLines(('x'.repeat(100) + '\n').repeat(656)).error.code, 'limit_body');
  assert.equal(splitLines('\n'.repeat(1500)).error.code, 'limit_lines');
  assert.equal(splitLines('\n'.repeat(1499)).length, 1500);
});

test('adversarial lines are fast', () => {
  for (const s of ['x'.repeat(500), '"' + 'a'.repeat(498), 'k="' + '\\'.repeat(496), '-> '.repeat(160)]) {
    const t0 = performance.now();
    lexLine(s, 1);
    assert.ok(performance.now() - t0 < 20);
  }
});
