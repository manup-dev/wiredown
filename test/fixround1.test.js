import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { parseMock } from '../src/index.js';

const timed = (src) => { const t = performance.now(); const r = parseMock(src); return { r, ms: performance.now() - t }; };
const codes = (r) => (r.ok ? r.warnings : r.errors).map((e) => e.code);

test('zero-node define fan-out is bounded', () => {
  let src = 'define d0\n  "x"\n';
  for (let i = 1; i <= 8; i++) src += `define d${i}\n${`  d${i - 1}\n`.repeat(10)}`;
  src += 'd8\n';
  const { r, ms } = timed(src);
  assert.ok(ms < 100, `${ms} ms`);
  assert.ok(codes(r).includes('limit_nodes'));
});

test('string amplification through $a is refused', () => {
  const arg = 'a'.repeat(180);
  const refs = '$a'.repeat(90);
  let src = '';
  for (let i = 1; i <= 3; i++) src += `define s${i} a\n  text "${refs}"\n`;
  src += `s1 "${arg}"\n`;
  const { r, ms } = timed(src);
  assert.ok(ms < 100, `${ms} ms`);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'limit_label'));
  const over = timed(`define s a\n  text "$a"\ns "${'b'.repeat(250)}"`);
  assert.ok(over.r.errors.some((e) => e.code === 'limit_label'));
});

test('64 KB of nested define uses stays fast', () => {
  let src = 'define a\n  text "x"\ndefine b\n  a\n  a\n';
  while (src.length < 60000) src += 'b\n';
  const { r, ms } = timed(src.slice(0, 65536));
  assert.ok(ms < 100, `${ms} ms`);
  assert.equal(typeof r.ok, 'boolean');
});

test('endCol with and without comments', () => {
  const end = (l) => parseMock(l).mock.screens[0].root.children[0].endCol;
  assert.equal(end('text "a"'), 9);
  assert.equal(end('text "a" // note'), 9);
  assert.equal(end('text "a"//note'), 9);
  assert.equal(end('text "a"   '), 9);
  assert.equal(end('button "a" #go -> x // c'), 20);
  assert.equal(end('input "a" placeholder="x y" // c'), 28);
});

test('define-expanded nodes carry the use site and fromDefine', () => {
  const src = 'define pair a\n  row\n    text "$a"\n    text "$a" #dup\ndefine two\n  pair "x"\nscreen s\n  text "plain"\n  two\n  pair "y"';
  const r = parseMock(src);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'duplicate_id');
  assert.equal(r.errors[0].line, 10);
  const ok = parseMock('define pair a\n  row\n    text "$a"\nscreen s\n  text "plain"\n  pair "y"  // c').mock.screens[0].root.children;
  assert.equal('fromDefine' in ok[0], false);
  assert.equal(ok[1].fromDefine, 'pair');
  assert.equal(ok[1].children[0].fromDefine, 'pair');
  assert.equal(ok[1].children[0].line, 6);
  assert.equal(ok[1].children[0].endCol, 11);
});

test('minor fixes', () => {
  assert.deepEqual(codes(parseMock('screen a\n  button "x" #b\nvariant v of a\n  #b -> nowhere')), ['dangling_link']);
  const w = parseMock('carousel "x" name=zzz\ncarousel "x"').mock.screens[0].root.children;
  assert.equal(w[0].typed, 'carousel');
  assert.deepEqual(w.map((n) => n.id), ['carousel-x', 'carousel-x-2']);
  assert.deepEqual(parseMock(`@title "${'a'.repeat(201)}"\ntext "a"`).errors.map((e) => e.code), ['limit_label']);
  assert.deepEqual(parseMock(`screen a\n  text "x"\nvariant v of a "${'a'.repeat(201)}"`).errors.map((e) => e.code), ['limit_label']);
  assert.equal(parseMock('screen a\n  text "x"\nvariant #v of a').errors[0].code, 'bad_value');
  const vv = parseMock('screen a\n  text "x" #t\nvariant v of a\n  #t muted\nvariant w of v\n  #t muted');
  assert.match(vv.errors[0].message, /not another variant/);
  assert.match(parseMock('define d a\n  text "$a"\nd "1" "2"').errors[0].message, /takes 1 label\./);
  // errors and warnings dedupe separately
  const mix = parseMock('carousel "x"\nstack pad=abc');
  assert.equal(mix.ok, false);
});
