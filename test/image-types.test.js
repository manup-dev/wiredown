import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseMock, layoutScreen, renderMockBlock, lintMock, mockPatch, kindForm, AI_CONTRACT } from '../src/index.js';

const src = (attrs) => `screen a "A"\n  image "Hero" ${attrs} #hero\n`;
const imgBox = (attrs) => {
  const r = parseMock(src(attrs));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const l = layoutScreen(r.mock.screens[0], r.mock.device);
  const find = (b) => (b.node.kind === 'image' ? b : b.children.map(find).find(Boolean));
  return find(l.root);
};
const strip = (s) => s.replace(/ data-wm-digest="[^"]*"/g, '');

test('an image without type or ratio renders as it did before the feature', () => {
  const b = 'screen a "A"\n  image "Hero" #hero\n  row\n    image "A" w=100\n    image "B"\n';
  assert.equal(renderMockBlock(b, ''), readFileSync(new URL('./fixtures/image-plain.html', import.meta.url), 'utf8'));
  assert.equal(imgBox('').h, 160);
});

test('each type draws its own glyph', () => {
  const out = Object.fromEntries(['photo', 'chart', 'map', 'video', 'illustration', 'logo', 'avatar'].map((t) => [t, renderMockBlock(src(`type=${t}`), '')]));
  assert.equal(new Set(Object.values(out).map(strip)).size >= 5, true);
  assert.notEqual(out.chart, out.photo);
  assert.notEqual(out.map, out.chart);
  assert.notEqual(out.avatar, out.photo);
  assert.match(out.video, /<circle/);
});

test('ratio sets the height from the laid-out width, h= still wins', () => {
  const w = imgBox('ratio=1:1').w;
  assert.equal(imgBox('ratio=1:1').h, Math.round(w));
  assert.equal(imgBox('ratio=16:9').h, Math.round((w * 9) / 16));
  assert.equal(imgBox('ratio=9:16').h, Math.round((w * 16) / 9));
  assert.equal(imgBox('ratio=1:1 h=100').h, 100);
});

test('bad values are lint errors', () => {
  const codes = (a) => lintMock(src(a), '').map((p) => p.code);
  assert.deepEqual(codes('type=photo ratio=21:9'), []);
  assert.deepEqual(codes('type=gif'), ['bad_value']);
  assert.deepEqual(codes('ratio=5:5'), ['bad_value']);
});

test('kindForm, contract and mockPatch know the attributes', () => {
  const names = kindForm('image').attrs.map((a) => a.name);
  assert.ok(names.includes('type') && names.includes('ratio'));
  assert.match(AI_CONTRACT, /ratio/);
  const r = mockPatch(src(''), { set: 'hero', attrs: { type: 'video', ratio: '16:9' } });
  assert.equal(r.ok, true, r.message);
  assert.match(r.body, /type=video/);
  assert.match(r.body, /ratio=16:9/);
});

test('HTML export carries the ratio and type; OpenUI keeps mapping an image', async () => {
  const { toHTML } = await import('../src/export/html.js');
  const { toOpenUI } = await import('../src/export/openui.js');
  const html = toHTML(src('type=video ratio=16:9'), '');
  assert.match(JSON.stringify(html), /data-type=\\"video\\"/);
  assert.match(JSON.stringify(html), /aspect-ratio:16\/9/);
  assert.match(JSON.stringify(toOpenUI(src('type=video ratio=16:9'), '')), /Image\(\\"Hero\\"\)/);
});

test('chart, map and logo draw primitives, not icon paths', () => {
  const a = renderMockBlock(src('type=chart'), '');
  assert.match(a, /<rect[^>]*width="6"/);
  assert.match(renderMockBlock(src('type=map'), ''), /<path[^>]*d="M[^"]*l8 3/);
  assert.match(renderMockBlock(src('type=logo'), ''), /width="24" height="24" rx="7"/);
});

const boxes = (body, device = '') => {
  const r = parseMock(device + body);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const l = layoutScreen(r.mock.screens[0], r.mock.device);
  const out = [];
  const walk = (b) => { if (b.node.kind === 'image') out.push(b); b.children.forEach(walk); };
  walk(l.root);
  return out;
};

test('ratio inside a row and a grid follows each cell width', () => {
  const [a, b] = boxes('screen a "A"\n  row gap=8\n    image "A" ratio=1:1\n    image "B" ratio=1:1\n');
  assert.equal(a.h, Math.round(a.w));
  assert.equal(b.h, Math.round(b.w));
  const g = boxes('screen a "A"\n  grid cols=3\n    image "A" ratio=4:3\n    image "B" ratio=4:3\n    image "C" ratio=4:3\n');
  for (const x of g) assert.equal(x.h, Math.round((x.w * 3) / 4));
});

test('ratio at phone width and the 800 clamp', () => {
  const [p] = boxes('screen a "A"\n  image "A" ratio=16:9\n', '@device phone\n');
  assert.equal(p.w, 358);
  assert.equal(p.h, Math.round((358 * 9) / 16));
  const [t] = boxes('screen a "A"\n  image "A" ratio=9:16\n', '@device 1200x1400\n');
  assert.equal(t.h, 800);
});

test('h=fill and grow with a ratio', () => {
  const f = boxes('screen a "A"\n  stack grow=1\n    image "A" ratio=1:1 h=fill\n    text "x"\n');
  assert.ok(f[0].h > 0);
  const g = boxes('screen a "A"\n  image "A" ratio=1:1 grow=1\n');
  assert.ok(g[0].h > 0);
});

test('HTML export: hostile ratio or type never reaches the output; h= drops the ratio', async () => {
  const { toHTML } = await import('../src/export/html.js');
  const bad = JSON.stringify(toHTML('screen a "A"\n  image "x" ratio="1:1;background:url(x)" type="a\\"onload=1"\n', ''));
  assert.match(bad, /"ok":false/);
  assert.ok(!/<figure|style=/.test(bad.replace(/\\"/g, '"')));
  const ok = JSON.stringify(toHTML(src('ratio=4:3'), ''));
  assert.match(ok, /aspect-ratio:4\/3;max-height:800px/);
  assert.ok(!/aspect-ratio/.test(JSON.stringify(toHTML(src('ratio=4:3 h=90'), ''))));
});
