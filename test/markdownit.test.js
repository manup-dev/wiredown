import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wiredownPlugin, lintMock } from '../src/index.js';

// A minimal markdown-it stand-in: the plugin only touches md.renderer.rules.fence.
function fakeMd() {
  const md = { renderer: { rules: { fence: (tokens, idx) => `<pre>${tokens[idx].info}</pre>` } } };
  wiredownPlugin(md, { defer: (env, html) => { (env.out ??= []).push(html); return `[${env.out.length - 1}]`; } });
  return md;
}
const fence = (md, info, content, env) => md.renderer.rules.fence([{ info, content }], 0, {}, env, {});

test('wiredown and screens fences render through defer; others reach the previous rule', () => {
  const md = fakeMd();
  const env = {};
  assert.equal(fence(md, 'wiredown', 'text "a"', env), '[0]');
  assert.equal(fence(md, ' screens view=prototype', 'text "b"', env), '[1]');
  assert.ok(env.out[0].startsWith('<figure class="wm wm-look-wire" data-wm-block="0"'));
  assert.ok(env.out[1].startsWith('<figure class="wm wm-look-wire wm-proto" data-wm-block="1"'));
  assert.equal(fence(md, 'js', 'x', env), '<pre>js</pre>');
  assert.equal(fence(md, 'Wiredown', 'x', env), '<pre>Wiredown</pre>');
  assert.equal(fence(md, 'wiredowns', 'x', env), '<pre>wiredowns</pre>');
  assert.equal(env.wmCount, 2);
});

test('a fresh env starts numbering at 0 again', () => {
  const md = fakeMd();
  fence(md, 'wiredown', 'text "a"', {});
  const env = {};
  fence(md, 'wiredown', 'text "a"', env);
  assert.ok(env.out[0].includes('data-wm-block="0"'));
});

test('the 51st block in one document is the cap card', () => {
  const md = fakeMd();
  const env = {};
  for (let i = 0; i < 52; i++) fence(md, 'wiredown', 'text "a"', env);
  assert.ok(env.out[49].includes('data-wm-block="49"'));
  const cap = '<div class="wm wm-error" role="note"><strong>Screens: </strong>Too many screens blocks in one document (50 max).</div>';
  assert.equal(env.out[50], cap);
  assert.equal(env.out[51], cap);
});

test('without defer the HTML is returned as is; a missing previous rule falls back to renderToken', () => {
  const md = { renderer: { rules: {} } };
  wiredownPlugin(md);
  const env = {};
  assert.ok(md.renderer.rules.fence([{ info: 'wiredown', content: 'text "a"' }], 0, {}, env, {}).startsWith('<figure'));
  assert.equal(md.renderer.rules.fence([{ info: 'js', content: 'x' }], 0, {}, env, { renderToken: () => 'RT' }), 'RT');
});

// With the repo's markdown-it, when it can be found (the package itself has no dependencies).
test('real markdown-it, if available', async (t) => {
  let MarkdownIt;
  try { MarkdownIt = (await import('markdown-it')).default; } catch { t.skip('markdown-it not resolvable'); return; }
  const md = new MarkdownIt();
  wiredownPlugin(md, { defer: (env, html) => { (env.blocks ??= []).push(html); return `<div id="b${env.blocks.length - 1}"></div>\n`; } });
  const env = {};
  const reused = {};
  md.render('```wiredown\ntext "a"\n```\n', reused);
  md.render('```wiredown\ntext "a"\n```\n', reused);
  assert.ok(reused.blocks[1].includes('data-wm-block="0"'));
  const out = md.render('# T\n\n```wiredown\ntext "a"\n```\n\n```screens\ntext "b"\n```\n\n```js\nx\n```\n', env);
  assert.ok(out.includes('<div id="b0"></div>') && out.includes('<div id="b1"></div>'));
  assert.ok(out.includes('<code class="language-js">'));
  assert.ok(env.blocks[1].includes('data-wm-block="1"'));
});

test('the language is the first white-space word (NBSP counts), matched exactly', () => {
  const md = fakeMd();
  const env = {};
  assert.equal(fence(md, 'wiredown\u00a0view=prototype', 'text "a"', env), '[0]');
  assert.ok(env.out[0].includes('wm-proto'));
  assert.equal(fence(md, '\u00a0screens\tlook=clean', 'text "a"', env), '[1]');
  assert.ok(env.out[1].includes('wm-look-clean'));
  assert.equal(fence(md, 'wiredown{x}', 'x', env), '<pre>wiredown{x}</pre>');
});

test('with md.core the counter resets at the start of every render, even for a reused env', () => {
  const rules = [];
  const md = { core: { ruler: { push: (name, fn) => rules.push({ name, fn }) } }, renderer: { rules: { fence: () => 'P' } } };
  wiredownPlugin(md, { defer: (env, html) => { (env.out ??= []).push(html); return 'D'; } });
  assert.equal(rules.length, 1);
  const env = {};
  const render = () => { for (const r of rules) r.fn({ env }); md.renderer.rules.fence([{ info: 'wiredown', content: 'text "a"' }], 0, {}, env, {}); };
  render(); render();
  assert.ok(env.out[0].includes('data-wm-block="0"'));
  assert.ok(env.out[1].includes('data-wm-block="0"'));
});

test('env.wmBase offsets the block index (hosts that join separately rendered pages)', () => {
  const md = fakeMd();
  const env = { wmBase: 100 };
  fence(md, 'wiredown', 'screen a\n  text "x"', env);
  fence(md, 'wiredown', 'screen a\n  text "x"', env);
  assert.ok(env.out[0].includes('data-wm-block="100"') && env.out[0].includes('id="wm-100-a"'));
  assert.ok(env.out[1].includes('data-wm-block="101"') && env.out[1].includes('id="wm-101-a"'));
  assert.equal(env.wmCount, 2, 'the cap still counts blocks of this parse, not the base');
  // Not a non-negative integer: no base. Past 9999 the base is 9999 and the index never wraps to 0.
  for (const bad of [-1, 1.5, '7', null, NaN, Infinity]) {
    const e = { wmBase: bad };
    fence(md, 'wiredown', 'text "a"', e);
    assert.ok(e.out[0].includes('data-wm-block="0"'), String(bad));
  }
  const top = { wmBase: 99999 };
  fence(md, 'wiredown', 'text "a"', top);
  fence(md, 'wiredown', 'text "a"', top);
  assert.ok(top.out[0].includes('data-wm-block="9999"') && top.out[1].includes('data-wm-block="9999"'));
});

test('the cap is per parse even with a base', () => {
  const md = fakeMd();
  const env = { wmBase: 50 };
  for (let i = 0; i < 51; i++) fence(md, 'wiredown', 'text "a"', env);
  assert.ok(env.out[49].includes('data-wm-block="99"'));
  assert.ok(env.out[50].includes('Too many screens blocks'));
});

test("env.wmMode === 'digest' emits only an empty figure carrying the block digest", async () => {
  const { mockDigest } = await import('../src/index.js');
  const md = fakeMd();
  const env = { wmMode: 'digest' };
  fence(md, 'wiredown look=clean', 'text "a"', env);
  fence(md, 'screens', 'text "b"', env);
  assert.deepEqual(env.out, [
    `<figure class="wm" data-wm-digest="${mockDigest('text "a"', 'wiredown look=clean')}"></figure>`,
    `<figure class="wm" data-wm-digest="${mockDigest('text "b"', 'screens')}"></figure>`,
  ]);
  // A changed mock changes its digest; any other mode is the full render.
  const other = { wmMode: 'digest' };
  fence(md, 'wiredown look=clean', 'text "c"', other);
  assert.notEqual(other.out[0], env.out[0]);
  const full = { wmMode: 'full' };
  fence(md, 'wiredown', 'text "a"', full);
  assert.ok(full.out[0].startsWith('<figure class="wm wm-look-wire" data-wm-block="0"'));
  assert.equal(env.wmCount, 2);
});

test('MSG and messageCard are exported: the 51st block is messageCard(MSG.tooMany)', async () => {
  const { MSG, messageCard } = await import('../src/index.js');
  const md = fakeMd();
  const env = {};
  for (let i = 0; i < 51; i++) fence(md, 'wiredown', 'text "a"', env);
  assert.equal(env.out[50], messageCard(MSG.tooMany));
  assert.ok(Object.isFrozen(MSG));
});

test('the first name, wiremark, still draws and lints', () => {
  const md = fakeMd(), env = {};
  assert.equal(fence(md, 'wiremark', 'text "a"', env), '[0]');
  assert.deepEqual(lintMock('text "a"', 'wiremark look=clean'), []);
});
