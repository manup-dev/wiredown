import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  parseMock, renderMockBlock, renderMockHtml, renderErrorCard, mockDigest, fnv1a64, WM_RENDER_VERSION,
  storyboard, WIREDOWN_CSS, WM_LIMITS, infoAttrs, renderScreenSvg,
} from '../src/index.js';

const LOGIN = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8');
const GOLDEN = new URL('./fixtures/login.html', import.meta.url);

const screensOf = (html) => [...html.matchAll(/<div class="wm-screen[^"]*" id="([^"]+)" data-wm-screen="([^"]+)"/g)].map((m) => m[1]);

test('login: a figure with three screens in storyboard order', () => {
  const html = renderMockBlock(LOGIN, 'wiredown');
  assert.ok(html.startsWith('<figure class="wm wm-look-wire" data-wm-block="0" data-wm-digest="'), html.slice(0, 120));
  assert.ok(html.endsWith('</figure>'));
  assert.deepEqual(screensOf(html), ['wm-0-login', 'wm-0-login-error', 'wm-0-reset']);
  assert.equal(html.split('<svg').length - 1, 3);
  assert.ok(html.includes('<figcaption class="wm-title">Sign in</figcaption>'));
});

test('variants sit beside their screen in one wm-variants group', () => {
  const html = renderMockBlock(LOGIN);
  const g = html.indexOf('<div class="wm-variants">');
  assert.ok(g > 0);
  const login = html.indexOf('id="wm-0-login"');
  const err = html.indexOf('id="wm-0-login-error"');
  const reset = html.indexOf('id="wm-0-reset"');
  assert.ok(g < login && login < err && err < reset);
  assert.ok(html.includes('<div class="wm-cap">Sign in · Wrong password</div>'));
  assert.ok(html.includes('<div class="wm-cap">Reset password</div>'));
});

test('notes: one legend item per numbered note, in source order', () => {
  const html = renderMockBlock(LOGIN);
  const items = [...html.matchAll(/<li data-wm-el="([^"]*)">/g)].map((m) => m[1]);
  assert.deepEqual(items, ['submit']);
  assert.ok(html.includes('<ol class="wm-notes"><li data-wm-el="submit"><strong>Sign in</strong>: Disabled until both fields are filled</li></ol>'));
  const many = renderMockBlock('screen a\n  text "x" note="one" #x\n  button "y" note="two"\nscreen b\n  text "z" note="three"');
  assert.deepEqual([...many.matchAll(/<li data-wm-el="([^"]*)">/g)].map((m) => m[1]), ['x', 'button-y', 'text-z']);
  assert.ok(!renderMockBlock('text "a"').includes('wm-notes'));
});

test('outline: a details text alternative listing every element', () => {
  const html = renderMockBlock(LOGIN);
  const d = html.slice(html.indexOf('<details class="wm-outline">'));
  assert.ok(d.startsWith('<details class="wm-outline"><summary>Screen outline</summary>'));
  assert.ok(d.includes('<li>h1 &quot;Welcome back&quot;</li>'));
  assert.ok(d.includes('<li>link &quot;Forgot password?&quot; → Reset password</li>'));
  assert.ok(d.includes('<li>checkbox &quot;Remember me&quot; checked</li>'));
  assert.ok(d.includes('error &quot;That password is not right&quot;'));
  assert.ok(d.includes('<p><strong>Sign in · Wrong password</strong></p>'));
  assert.equal(d.split('<li>button &quot;Sign in&quot; primary (note 1)</li>').length - 1, 2);
  assert.equal(renderMockBlock('mystery "x"').includes('<li>mystery &quot;x&quot;'), true);
});

test('golden: login figure bytes', () => {
  const html = renderMockBlock(LOGIN, 'wiredown');
  if (process.env.UPDATE_GOLDEN === '1') writeFileSync(GOLDEN, html);
  assert.ok(existsSync(GOLDEN), 'run once with UPDATE_GOLDEN=1');
  assert.equal(html, readFileSync(GOLDEN, 'utf8'));
});

test('title: skipped when one screen carries the same label', () => {
  assert.ok(!renderMockBlock('@title "Home"\nscreen home "Home"\n  text "x"').includes('figcaption'));
  assert.ok(renderMockBlock('@title "App"\nscreen home "Home"\n  text "x"').includes('<figcaption class="wm-title">App</figcaption>'));
  assert.ok(renderMockBlock(LOGIN).includes('<figcaption class="wm-title">Sign in</figcaption>')); // three screens
});

test('root svg carries the constant max-width style, so a desktop mock fits a narrow column', () => {
  const m = parseMock('@device desktop\ntext "a"').mock;
  const svg = renderScreenSvg(m, 0, 0);
  assert.ok(/^<svg [^>]*width="1442" style="max-width:100%;height:auto"/.test(svg), svg.slice(0, 200));
});

test('block index numbers ids and hotspots', () => {
  const html = renderMockBlock(LOGIN, '', { blockIndex: 7 });
  assert.deepEqual(screensOf(html), ['wm-7-login', 'wm-7-login-error', 'wm-7-reset']);
  assert.ok(html.includes('data-wm-block="7"'));
  assert.ok(html.includes('href="#wm-7-reset"'));
  assert.ok(!html.includes('href="#wm-0-'));
  for (const bad of [-1, 1.5, NaN, 'x', 1e9]) assert.ok(renderMockBlock(LOGIN, '', { blockIndex: bad }).includes('data-wm-block="0"'));
});

test('@flow orders the storyboard; variants stay beside their target', () => {
  const src = '@flow reset login\n' + LOGIN.replace('@device phone\n', '');
  assert.deepEqual(screensOf(renderMockBlock(src)), ['wm-0-reset', 'wm-0-login', 'wm-0-login-error']);
  const r = parseMock('@flow b-err c\nscreen a\n  text "a"\nscreen b\n  text "#"\nscreen c\n  text "c"\nvariant b-err of b\n  #text-2 hide');
  assert.equal(r.ok, false); // #text-2 does not exist: variant_target
  const ok = parseMock('@flow b-err c\nscreen a\n  text "a"\nscreen b\n  text "b" #t\nscreen c\n  text "c"\nvariant b-err of b\n  #t hide');
  assert.equal(ok.ok, true);
  const order = storyboard(ok.mock);
  assert.deepEqual(order.groups.map((g) => g.map((i) => ok.mock.screens[i].id)), [['b', 'b-err'], ['c'], ['a']]);
  assert.equal(ok.mock.screens[order.start].id, 'b-err');
});

test('look= in the info string overrides @look; view=prototype marks the figure', () => {
  assert.ok(renderMockBlock(LOGIN, 'wiredown look=clean').startsWith('<figure class="wm wm-look-clean"'));
  assert.ok(renderMockBlock('@look clean\ntext "a"', 'screens look=wire').startsWith('<figure class="wm wm-look-wire"'));
  const proto = renderMockBlock(LOGIN, 'wiredown view=prototype');
  assert.ok(proto.startsWith('<figure class="wm wm-look-wire wm-proto"'));
  assert.ok(proto.includes('<div class="wm-screen wm-start" id="wm-0-login"'));
  assert.equal(proto.split('wm-start').length - 1, 1);
  assert.ok(!renderMockBlock(LOGIN).includes('wm-start'));
  assert.ok(renderMockBlock('text "a"', 'wiredown look=fancy').includes('wm-error'));
});

test('errors: an invalid body draws the error card, never partial screens', () => {
  const html = renderMockBlock('screen a\n  text "ok"\n  bogus= "x"\n');
  assert.ok(html.startsWith('<div class="wm wm-error" role="note"><strong>Screens: </strong>'), html);
  assert.ok(html.includes('line 3'));
  assert.ok(!html.includes('<svg'));
  const one = renderErrorCard([{ line: 3, column: 1, code: 'bad_value', message: 'Bad <b>' }]);
  assert.equal(one, '<div class="wm wm-error" role="note"><strong>Screens: </strong>line 3: Bad &lt;b&gt;</div>');
  const errs = Array.from({ length: 8 }, (_, i) => ({ line: i + 1, column: 1, code: 'x', message: `m${i}` }));
  const many = renderErrorCard(errs);
  assert.equal((many.match(/<li>/g) || []).length, 5);
  assert.ok(many.includes('8 problems; the first 5:'));
  assert.ok(many.includes('<li>line 5: m4</li>') && !many.includes('m5'));
  assert.equal(renderErrorCard([{ line: 0, column: 0, code: 'x', message: 'Plain.' }]), '<div class="wm wm-error" role="note"><strong>Screens: </strong>Plain.</div>');
  assert.ok(renderErrorCard([]).includes('wm-error'));
  assert.ok(renderErrorCard(null).includes('wm-error'));
});

test('rendering never throws', () => {
  for (const v of [undefined, null, 42, {}, '', '\n\n', '"', 'screen']) {
    const html = renderMockBlock(v, v);
    assert.equal(typeof html, 'string');
    assert.ok(html.startsWith('<figure') || html.startsWith('<div class="wm wm-error"'));
  }
  assert.equal(typeof renderMockHtml(null), 'string');
  assert.equal(typeof renderMockHtml({ screens: [{ id: 'a', root: null }] }), 'string');
});

test('output over 512 KB is the too-large card, never a truncated figure', () => {
  // 38 long texts, then 48 variants of the screen: a 10 KB body that draws about 1.3 MB
  const long = 'word '.repeat(39);
  const lines = ['screen a "A"'];
  for (let k = 0; k < 38; k++) lines.push(`  text "${long}${k}" #t${k}`);
  for (let v = 0; v < 48; v++) lines.push(`variant v${v} of a "V${v}"`, '  #t0 muted');
  const body = lines.join('\n');
  assert.ok(body.length < WM_LIMITS.body);
  assert.equal(parseMock(body).ok, true);
  const t = performance.now();
  const html = renderMockBlock(body);
  assert.ok(performance.now() - t < 1000);
  assert.equal(html, '<div class="wm wm-error" role="note"><strong>Screens: </strong>This mock is too large to draw (over 512 KB). Split it into smaller blocks.</div>');
  // the same screen with fewer variants fits and is a whole figure
  const fits = renderMockBlock(lines.slice(0, 39 + 20).join('\n'));
  assert.ok(fits.startsWith('<figure') && fits.endsWith('</figure>'));
  assert.ok(fits.length > 200000 && fits.length <= WM_LIMITS.output);
});

test('digest: 64-bit FNV-1a, keyed on version and body', () => {
  assert.equal(WM_RENDER_VERSION, 1);
  assert.equal(fnv1a64('hello'), '4f9f2cabf2b853b4');
  assert.equal(mockDigest('abc'), fnv1a64('1\0abc'));
  assert.equal(mockDigest('abc', 'wiredown'), mockDigest('abc'));
  assert.equal(mockDigest('abc', '  screens  '), mockDigest('abc'));
  assert.notEqual(mockDigest('abc', 'wiredown view=prototype'), mockDigest('abc'));
  assert.equal(mockDigest('abc', 'wiredown view=prototype'), mockDigest('abc', 'screens   view=prototype'));
  // only look= and view= count, in a fixed order; unknown words and order never change it
  assert.equal(mockDigest('abc', 'wiredown view=prototype look=clean'), mockDigest('abc', 'wiredown look=clean v1 foo=bar view=prototype'));
  assert.equal(mockDigest('abc', 'wiredown v1 x=y title'), mockDigest('abc'));
  assert.equal(mockDigest('abc', 'wiredown view=stack'), mockDigest('abc'));
  assert.equal(infoAttrs('screens view=prototype zzz look=clean'), 'look=clean view=prototype');
  assert.notEqual(mockDigest('abc', 'look=clean'), mockDigest('abc', 'look=wire'));
  assert.ok(renderMockBlock(LOGIN).includes(`data-wm-digest="${mockDigest(LOGIN)}"`));
});

test('WIREDOWN_CSS: layout and prototype rules only, all scoped to .wm', () => {
  assert.equal(typeof WIREDOWN_CSS, 'string');
  assert.ok(WIREDOWN_CSS.length < 2000);
  assert.ok(WIREDOWN_CSS.includes(':target'));
  assert.ok(WIREDOWN_CSS.includes('.wm.wm-proto .wm-strip,.wm.wm-proto .wm-variants{display:block}'));
  for (const rule of WIREDOWN_CSS.split('}').map((r) => r.trim()).filter(Boolean)) {
    const sel = rule.slice(0, rule.indexOf('{'));
    for (const part of sel.split(',')) assert.match(part.trim(), /^\.wm($|[\s.:-])/, part);
  }
  assert.ok(!/color|background|fill|stroke|url\(|@import|border/i.test(WIREDOWN_CSS));
});
