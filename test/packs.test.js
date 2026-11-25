import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as core from '../src/index.js';
import { defineIconPack } from '../src/packs-define.js';

const { isIconPack, iconPacksKey, renderMockBlock, renderMockHtml, renderScreenSvg, lintMock, parseMock, wiredownPlugin, pathFromD } = core;

const SQ = 'M4 4h16v16h-16z';
const mk = (id, icons, extra = {}) => defineIconPack({ id, name: id, version: '1.0.0', icons, ...extra });
const A = mk('aaa', { star: 'M12 2l2 7h7l-6 4 2 7-5-4-5 4 2-7-6-4h7z', square: SQ });
const B = mk('bbb', { square: 'M2 2h20v20h-20z', thin: SQ }, { strokeWidth: 1.5 });
const pathsOf = (html) => [...html.matchAll(/<path d="([^"]+)"[^>]*stroke-width="([^"]+)"/g)].map((m) => [m[1], m[2]]);
const one = (icon, head = '') => `${head}screen a "A"\n  icon ${icon}\n`;
const draw = (body, icons) => renderMockBlock(body, 'wiredown', { icons });

test('defineIconPack returns a frozen, branded pack', () => {
  assert.ok(isIconPack(A));
  assert.ok(Object.isFrozen(A) && Object.isFrozen(A.icons));
  assert.ok(!isIconPack({ ...A }));
  assert.ok(!isIconPack(null) && !isIconPack('x'));
});

test('defineIconPack throws a TypeError on a malformed pack', () => {
  const bad = (spec) => assert.throws(() => defineIconPack(spec), TypeError);
  bad(null); bad('x'); bad({});
  for (const id of ['', 'A', '1a', 'a b', 'wiredown', 'x'.repeat(25), 7, undefined]) bad({ id, name: 'n', version: '1', icons: { a: SQ } });
  bad({ id: 'ok', version: '1', icons: { a: SQ } });
  bad({ id: 'ok', name: 'n', version: 'a b', icons: { a: SQ } });
  bad({ id: 'ok', name: 'n', version: '1', icons: [] });
  bad({ id: 'ok', name: 'n', version: '1', icons: null });
  bad({ id: 'ok', name: 'n', version: '1', strokeWidth: 4, icons: { a: SQ } });
  bad({ id: 'ok', name: 'n', version: '1', strokeWidth: 0.5, icons: { a: SQ } });
  for (const name of ['', 'A', '-a', 'a_b', 'a b', 'x'.repeat(65), '__proto__']) bad({ id: 'ok', name: 'n', version: '1', icons: { [name]: SQ } });
  const many = {};
  for (let i = 0; i <= 10000; i++) many[`i${i}`] = SQ;
  bad({ id: 'ok', name: 'n', version: '1', icons: many });
  assert.ok(mk('ok', { a: SQ }, { strokeWidth: 3 }));
});

test('defineIconPack checks the path data', () => {
  const bad = (d) => assert.throws(() => mk('ok', { a: d }), TypeError, String(d));
  for (const d of ['', 7, null, undefined, 'x'.repeat(6001), 'M0 0h1' + ' 1'.repeat(3000), 'L1 1', '1 2', 'M1 2 3', 'M1', 'M1 2x', 'M1 2 <script>', 'M1 2 url(x)', 'M99 0', 'M-5 0', 'M0 29',
    'M1e3 0', 'M0 0h1e999', 'M0 0l40 0', 'M0 0z1', 'M0 0a1 1 0 2 0 1 1', 'M0 0a1 1 0 0 1.5 1 1', 'M0 0a2000 2000 0 0 0 1 1', 'M0 0a1 1 0 011 1']) bad(d);
  assert.ok(mk('ok', { a: 'M0 0a9 9 0 0 1 18 0z', b: 'm12 6v6h4.5m4.5 0', c: 'M-4 28L28 -4', d: 'M1 1c1 1 2 2 3 3 4 4 5 5 6 6', e: 'M1 1l1-1-1 1', f: 'M2 2h1e0' }));
});

test('defineIconPack follows the current point, so relative steps cannot leave the grid', () => {
  const bad = (d) => assert.throws(() => mk('ok', { a: d }), TypeError, d);
  const ok = (d) => assert.ok(mk('ok', { a: d }), d);
  bad('M0 0' + 'l3 0'.repeat(10)); // each step is small, the end is at x = 30
  bad('M20 20l5 5 5 5'); // implicit pairs after l stay relative
  bad('m20 20 5 5 5 5'); // the pairs after a leading m are relative linetos
  bad('M20 2h5h5');
  bad('M2 20v5v5');
  bad('M20 20c0 0 10 10 1 1'); // a control point off the grid
  bad('M2 2h20zm30 0'); // z returns to (2, 2); the next m adds to it
  bad('M0 0a1 1 1e999 0 1 1 1'); // rotation must be finite
  ok('m9 11 3 3L22 4');
  ok('M2 2h20v20zm1 1h1');
  ok('M24 24l-3-3-3-3-3-3-3-3-3-3-3-3');
  ok('M4 4h16v16h-16z');
});

test('defineIconPack lives in wiredown/icons, outside the core entry', async () => {
  assert.equal('defineIconPack' in core, false);
  assert.equal('brand' in core, false);
  const sub = await import('wiredown/icons');
  const P = sub.defineIconPack({ id: 'sub', name: 's', version: '1', icons: { sq: SQ } });
  assert.ok(core.isIconPack(P) && sub.isIconPack(P));
  assert.ok(draw(one('"sub:sq"'), [P]).includes('<path d="M'));
});

test('a pack icon draws with its own path and stroke width', () => {
  const [[d1, w1]] = pathsOf(draw(one('"aaa:star"'), [A]));
  assert.ok(d1.startsWith('M') && w1 === '2');
  const [[, w2]] = pathsOf(draw(one('"bbb:thin"'), [B]));
  assert.equal(w2, '1.5');
});

test('resolution: prefix, header order, built-ins, placeholders', () => {
  const both = [A, B];
  const sq = (icon, head) => pathsOf(draw(one(icon, head), both))[0][0];
  const dA = pathsOf(draw(one('"aaa:square"'), both))[0][0];
  const dB = pathsOf(draw(one('"bbb:square"'), both))[0][0];
  assert.notEqual(dA, dB);
  assert.equal(sq('"square"', '@icons aaa, bbb\n'), dA, 'header order: first pack wins');
  assert.equal(sq('"square"', '@icons bbb aaa\n'), dB);
  assert.equal(sq('"square"', '@icons bbb,aaa\n'), dB);
  // a bare name without the header never reads a pack
  assert.ok(!draw(one('"square"'), both).includes('<path d="M'), 'unknown bare name is the placeholder ring');
  // header pack lacks the name: later pack, then built-in
  assert.equal(sq('"thin"', '@icons aaa, bbb\n'), pathsOf(draw(one('"bbb:thin"'), both))[0][0]);
  const builtin = pathsOf(draw(one('"bell"'), []))[0][0];
  assert.equal(pathsOf(draw(one('"bell"', '@icons aaa\n'), [A]))[0][0], builtin);
  // prefix of a pack that is not loaded falls back to the built-in of that name
  assert.equal(pathsOf(draw(one('"lucide:bell"'), []))[0][0], builtin);
  assert.equal(pathsOf(draw(one('"aaa:bell"'), [A]))[0][0], builtin);
  assert.ok(!draw(one('"lucide:nope"'), []).includes('<path d="M'));
});

test('without packs or header the output is byte-identical to before', () => {
  const body = 'screen a "A"\n  icon "bell"\n  button "Go" icon=search primary\n  input "x"\n';
  const plain = renderMockBlock(body, 'wiredown');
  assert.equal(draw(body, [A, B]), plain);
  assert.equal(renderMockBlock(body, 'wiredown', { icons: 'garbage' }), plain);
  assert.equal(renderMockBlock(body, 'wiredown', { icons: [A, B], blockIndex: 0 }), plain);
});

test('@icons header: parse and errors', () => {
  const ok = parseMock('@icons aaa, bbb\nscreen a "A"\n  text "x"\n', 'wiredown');
  assert.ok(ok.ok && ok.mock.icons.join() === 'aaa,bbb');
  for (const h of ['@icons', '@icons A', '@icons "aaa"', '@icons a/b', '@icons a b c d e f g h i']) {
    const r = parseMock(`${h}\nscreen a "A"\n  text "x"\n`, 'wiredown');
    assert.ok(!r.ok && r.errors[0].code === 'bad_header', h);
  }
});

test('lint: missing packs once per block, unknown icons check the loaded packs', () => {
  const body = '@icons lucide\nscreen a "A"\n  icon "lucide:rocket"\n  icon "tabler:brand-figma"\n  icon "tabler:x"\n  icon "star"\n  icon "nope"\n';
  const out = lintMock(body, 'wiredown');
  const missing = out.filter((p) => p.code === 'icon_pack_missing');
  assert.deepEqual(missing.map((p) => p.message.match(/"(\w+)"/)[1]).sort(), ['lucide', 'tabler']);
  assert.equal(missing[0].severity, 'warning');
  assert.match(missing[0].message, /^This block uses the "\w+" icon pack, which is not loaded here\. Built-in icons are drawn where the names match\.$/);
  const loaded = lintMock('@icons aaa\nscreen a "A"\n  icon "aaa:star"\n  icon "star"\n  icon "square"\n  icon "aaa:missing"\n', 'wiredown', { icons: [A] });
  assert.deepEqual(loaded.map((p) => [p.code, p.line]), [['unknown_icon', 6]]);
  assert.deepEqual(lintMock('screen a "A"\n  icon "aaa:star"\n', 'wiredown', { icons: [A] }), []);
  assert.deepEqual(lintMock('screen a "A"\n  icon "square"\n', 'wiredown', { icons: [A] }).map((p) => p.code), ['unknown_icon']);
});

test('lint: an unknown icon in a screen with variants warns once', () => {
  const body = 'screen a "A"\n  icon "nope"\nvariant b of a "B"\nvariant c of a "C"\n';
  assert.deepEqual(lintMock(body, 'wiredown').map((p) => [p.code, p.line]), [['unknown_icon', 2]]);
  const pack = '@icons lucide\nscreen a "A"\n  icon "tabler:x"\nvariant b of a "B"\n';
  assert.deepEqual(lintMock(pack, 'wiredown').map((p) => p.code).sort(), ['icon_pack_missing', 'icon_pack_missing']);
});

test('render, lint and the plugin never throw on garbage opts.icons', () => {
  const hostile = new Proxy([], { get() { throw new Error('boom'); }, has() { throw new Error('boom'); } });
  const getter = { get icons() { throw new Error('boom'); } };
  const fake = { id: 'x', icons: { a: 'M0 0' }, version: '1' };
  const junk = [undefined, null, 0, 'a', {}, [], [null, undefined, 3, 'x', {}, fake, Object.create(null), () => 1], hostile, new Array(100).fill(A)];
  const body = '@icons x, aaa\nscreen a "A"\n  icon "x:a"\n  icon "a"\n';
  const mock = parseMock(body, 'wiredown').mock;
  for (const icons of junk) {
    assert.doesNotThrow(() => { renderMockBlock(body, 'wiredown', { icons }); lintMock(body, 'wiredown', { icons }); });
    assert.doesNotThrow(() => { renderMockHtml(mock, { icons }); renderScreenSvg(mock, 0, 0, icons); });
    assert.ok(renderMockBlock(body, 'wiredown', { icons }).startsWith('<figure'));
  }
  assert.doesNotThrow(() => { renderMockBlock(body, 'wiredown', getter); lintMock(body, 'wiredown', getter); });
  assert.doesNotThrow(() => { renderMockBlock(body, 'wiredown', null); lintMock(body, 'wiredown', null); lintMock(body, 'wiredown', 5); });
});

test('wiredownPlugin passes icons to every block', () => {
  const rules = {};
  const md = { renderer: { rules }, core: { ruler: { push() {} } } };
  wiredownPlugin(md, { icons: [A] });
  const html = rules.fence([{ info: 'wiredown', content: one('"aaa:square"') }], 0, {}, {}, {});
  assert.ok(html.includes('<path d="M'));
  const none = {};
  wiredownPlugin({ renderer: { rules: none }, core: { ruler: { push() {} } } }, { icons: 'junk' });
  assert.ok(!none.fence([{ info: 'wiredown', content: one('"aaa:square"') }], 0, {}, {}, {}).includes('<path d="M'));
});

test('iconPacksKey sorts ids and ignores what is not a pack', () => {
  assert.equal(iconPacksKey([B, A, {}, null]), 'aaa@1.0.0,bbb@1.0.0');
  assert.equal(iconPacksKey([]), '');
  assert.equal(iconPacksKey('x'), '');
});

test('pathFromD reads a leading lowercase m as absolute, and the pairs after it as relative', () => {
  assert.equal(pathFromD('m1 2l1 1', 10, 20, 24), 'M11 22l1 1');
  assert.equal(pathFromD('m1 2 3 4', 10, 20, 24), 'M11 22l3 4');
  assert.equal(pathFromD('m1 2 3 4 5 6M1 1 2 2', 0, 0, 24), 'M1 2l3 4l5 6M1 1L2 2');
  assert.equal(pathFromD('M1 2m1 1 1 1', 0, 0, 24), 'M1 2m1 1l1 1');
});

test('the command line takes --icons', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wd-icons-'));
  const src = new URL('../src/packs-define.js', import.meta.url).href;
  writeFileSync(join(dir, 'pack.mjs'), `import { defineIconPack } from '${src}';\nexport default defineIconPack({ id: 'aaa', name: 'a', version: '1', icons: { zzz: 'M12 2l2 7h7z' } });\n`);
  writeFileSync(join(dir, 'bad.mjs'), 'export default { id: "x" };\n');
  writeFileSync(join(dir, 'f.wiredown'), '@icons aaa\nscreen a "A"\n  icon "zzz"\n');
  const cli = new URL('../bin/wiredown.js', import.meta.url).pathname;
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8' });
  assert.match(run('lint', 'f.wiredown').stdout, /icon_pack_missing/);
  assert.equal(run('lint', 'f.wiredown', '--icons', './pack.mjs').stdout, '');
  assert.equal(run('lint', 'f.wiredown', '--icons', join(dir, 'pack.mjs')).stdout, '', 'an absolute path');
  const r = run('render', 'f.wiredown', '--icons', './pack.mjs', '--out', 'o', '--format', 'html');
  assert.equal(r.status, 0, r.stderr);
  const html = spawnSync('cat', [join(dir, 'o/f.html')], { encoding: 'utf8' }).stdout;
  assert.ok(html.includes('<path d="M'));
  run('render', 'f.wiredown', '--out', 'p', '--format', 'html');
  assert.ok(!spawnSync('cat', [join(dir, 'p/f.html')], { encoding: 'utf8' }).stdout.includes('<path d="M'));
  const e = run('lint', 'f.wiredown', '--icons', './bad.mjs');
  assert.equal(e.status, 2);
  assert.match(e.stderr, /does not export an icon pack/);
  assert.match(run('lint', 'f.wiredown', '--icons', './missing.mjs').stderr, /cannot load the icon pack/);
  assert.match(run('lint', 'f.wiredown', '--icons').stderr, /needs a value/);
});
