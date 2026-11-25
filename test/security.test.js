// The renderer is trusted code: its SVG is spliced into pages after the HTML sanitizer.
// Every output here must satisfy the allowlist rules of spec section 5 by construction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMock, renderScreenSvg, renderMockBlock, renderMockHtml, renderErrorCard } from '../src/index.js';

const TAGS = new Set('svg g rect circle ellipse line path polyline text tspan title a'.split(' '));
const ATTRS = new Set([
  'xmlns', 'viewBox', 'width', 'height', 'role', 'aria-label', 'font-family', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'fill-opacity', 'stroke-opacity', 'stroke-width',
  'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-size', 'font-weight', 'text-anchor', 'dy',
  'opacity', 'style', 'href', 'data-wm-el', 'letter-spacing',
]);
// Approved style parts, one or two joined by ';' (a fill part, then a stroke part).
const STYLE = /^(fill:var\(--wm-(accent,#[0-9a-f]{6}|bg,Canvas)\)|stroke:var\(--wm-accent,#[0-9a-f]{6}\)|fill:var\(--wm-(accent,#[0-9a-f]{6}|bg,Canvas)\);stroke:var\(--wm-accent,#[0-9a-f]{6}\))$/;
// Attributes whose value is author text (escaped); every other value is core-built.
const AUTHOR_VALUES = new Set(['aria-label', 'data-wm-el']);
// The root <svg> carries exactly this constant style (and nothing else may).
const ROOT_STYLE = 'max-width:100%;height:auto';

function assertSafe(svg, what) {
  const msg = (m) => `${what}: ${m}`;
  assert.equal(svg.split('<svg').length - 1, 1, msg('one <svg'));
  assert.ok(new RegExp(`^<svg [^>]*\\sstyle="${ROOT_STYLE}"[^>]*>`).test(svg), msg('root svg has the max-width style'));
  assert.ok(!svg.slice(svg.indexOf('>')).includes(`style="${ROOT_STYLE}"`), msg('only the root svg has it'));
  for (const bad of ['<script', '<foreignObject', '<image', '<use', '<style', '<iframe']) {
    assert.ok(!svg.toLowerCase().includes(bad.toLowerCase()), msg(bad));
  }
  for (const m of svg.matchAll(/<\/?([a-zA-Z][\w:-]*)/g)) assert.ok(TAGS.has(m[1]), msg(`tag ${m[1]}`));
  // every & starts one of the five entities
  assert.ok(!/&(?!(amp|lt|gt|quot|#39);)/.test(svg), msg('bare &'));
  // walk every tag's attributes: names allowlisted, values safe
  for (const tag of svg.matchAll(/<([a-zA-Z][\w:-]*)((?:\s+[^\s=>]+="[^"]*")*)\s*\/?>/g)) {
    const rest = tag[2];
    const leftover = rest.replace(/\s+[^\s=>]+="[^"]*"/g, '');
    assert.equal(leftover.trim(), '', msg(`stray markup in <${tag[1]}${rest}>`));
    for (const a of rest.matchAll(/\s+([^\s=>]+)="([^"]*)"/g)) {
      const [, name, value] = a;
      assert.ok(ATTRS.has(name), msg(`attribute ${name}`));
      assert.ok(!/^on/i.test(name), msg(`handler ${name}`));
      assert.ok(name !== 'xlink:href', msg('xlink:href'));
      if (name === 'href') assert.match(value, /^#wm-\d+-[a-z][a-z0-9-]*$/, msg('href'));
      if (name === 'id') assert.match(value, /^wm-[a-z0-9-]+$/, msg('id'));
      if (name === 'style' && tag[1] === 'svg') assert.equal(value, ROOT_STYLE, msg('root svg style'));
      else if (name === 'style') assert.match(value, STYLE, msg('style'));
      if (name === 'fill' || name === 'stroke') assert.match(value, /^(none|currentColor|#[0-9a-f]{3}|#[0-9a-f]{6})$/, msg(name));
      if (!AUTHOR_VALUES.has(name)) {
        assert.ok(!/javascript:|url\(|expression\(/i.test(value), msg(`value of ${name}`));
      }
    }
  }
  // no tag is left unparsed by the walk above
  const tagCount = (svg.match(/<[a-zA-Z]/g) || []).length;
  const walked = [...svg.matchAll(/<([a-zA-Z][\w:-]*)((?:\s+[^\s=>]+="[^"]*")*)\s*\/?>/g)].length;
  assert.equal(walked, tagCount, msg('every tag well formed'));
  // a raw '<' only ever opens a tag; text never carries one
  assert.ok(!/<(?![a-zA-Z/])/.test(svg), msg('raw <'));
  assert.ok(!svg.includes(' ') && !svg.includes(' '), msg('line separators'));
  // the only ' on…=' left is inside escaped text or author attribute values
  const outsideText = svg.replace(/>[^<]*</g, '><').replace(/\s(aria-label|data-wm-el)="[^"]*"/g, '');
  assert.ok(!/\son[a-z]+=/i.test(outsideText), msg('on*= outside text'));
  assert.ok(!/javascript:/i.test(outsideText), msg('javascript: outside text'));
}

function renderAll(src, info) {
  const r = parseMock(src, info);
  if (!r.ok) return [];
  const out = [];
  for (const look of ['wire', 'clean']) {
    r.mock.look = look;
    for (let i = 0; i < r.mock.screens.length; i++) out.push(renderScreenSvg(r.mock, i, 0));
  }
  return out;
}

const q = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

const LABELS = [
  '</text><script>alert(1)</script>',
  '"><svg onload=alert(1)>',
  'javascript:alert(1)',
  '<foreignObject>',
  '&#x3C;script&#x3E;',
  ' ',
  '  a   b',
  ']]>',
  '&'.repeat(200),
  '<![CDATA[x]]>',
  '<!-- x -->',
  '\u0000\u0001\u001f',
  '\uD800 lone',
  "' onmouseover='x",
  '<a href="javascript:x">y</a>',
  'x id="wm-0-a" y',
  '<image href=x>',
  '<style>*{}</style>',
  '<use href="#x"/>',
];

// Lines stay under the 500-char line limit: a long label is used once per line.
function hostileBlock(label) {
  const L = q(label);
  const M = label.length > 100 ? '"m"' : L;
  return [
    `@title ${L}`,
    `screen a ${L}`,
    `  navbar ${L} back -> b`,
    `  card ${L} note=${M}`,
    `    h1 ${L}`,
    `    text ${L} muted`,
    `    link ${L} -> b`,
    `    button ${L} primary note=${M}`,
    `    input ${L} placeholder=${M} error=${M}`,
    `    input "e" error=${L}`,
    `    textarea ${M} placeholder=${L}`,
    `    select ${M} options=${L}`,
    `    checkbox ${L} checked`,
    `    radio ${L} selected`,
    `    toggle ${L} on`,
    `    badge ${L} tone=bad`,
    `    image ${L}`,
    `    avatar ${L}`,
    `    icon ${L} icon=${M}`,
    `    mystery ${L}`,
    `  tabs`,
    `    tab ${L} selected`,
    `  list`,
    `    item ${L} ${M} -> b`,
    `  table cols=${L} rows=2`,
    `  toast ${L}`,
    `screen b ${L}`,
    `  text ${L}`,
  ].join('\n');
}

test('hostile labels and attributes render safely everywhere', () => {
  let rendered = 0;
  for (const label of LABELS) {
    const svgs = renderAll(hostileBlock(label));
    assert.ok(svgs.length > 0, `parses: ${JSON.stringify(label)}`);
    for (const svg of svgs) { assertSafe(svg, JSON.stringify(label)); rendered++; }
  }
  assert.ok(rendered >= LABELS.length * 4);
});

test('the &-bomb label stays entity-escaped and never double-decodes', () => {
  const [svg] = renderAll(`text ${q('&'.repeat(200))}`);
  assert.ok(svg.includes('&amp;'.repeat(20)));
  assert.ok(!svg.includes('&amp;amp;'));
});

test('hostile attribute values and ids', () => {
  const cases = [
    `input "E" note="<img src=x>"`,
    `input "E" placeholder="\\" onmouseover=\\""`,
    `button "x" #a"b`,
    `button "x" -> javascript:alert(1)`,
    `button "x" -> back`,
    `badge "x" tone="<script>"`,
    `button "x" w="1e309"`,
    `button "x" icon="../../etc/passwd"`,
    `image "x" note="url(javascript:alert(1))"`,
  ];
  for (const src of cases) {
    for (const svg of renderAll(src)) {
      assertSafe(svg, src);
      assert.ok(!svg.includes('<a'), `${src}: no hotspot`);
    }
  }
});

// --- seeded fuzz: 300 hostile strings, through the parser and straight into the node tree ---
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ALPHABET = ['<', '>', '&', '"', "'", '`', '/', '=', ':', ';', '#', ' ', '\u0000', 'a', 'b', 'o', 'n', 's', 'c', 'r', 'i', 'p', 't', 'x', ' ', '\uD800', '\uDE00', '￿', '\n'];
const rand = mulberry32(20261122);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const fuzzString = () => Array.from({ length: 1 + Math.floor(rand() * 40) }, () => pick(ALPHABET)).join('');

function walk(n, f) { f(n); for (const c of n.children) walk(c, f); }

test('seeded fuzz: 300 hostile strings stay inside the allowlist', () => {
  const base = parseMock(hostileBlock('seed'));
  assert.equal(base.ok, true);
  let parsedOk = 0;
  for (let k = 0; k < 300; k++) {
    const s = fuzzString();
    // 1. through the parser (when the lexer accepts it)
    for (const svg of renderAll(hostileBlock(s.replace(/\n/g, ' ')))) { assertSafe(svg, `parse #${k}`); parsedOk++; }
    // 2. straight into the tree, as if a parser bug let anything through
    const mock = structuredClone(base.mock);
    mock.title = s;
    mock.look = k % 2 ? 'clean' : 'wire';
    for (const scr of mock.screens) {
      scr.label = s;
      walk(scr.root, (n) => {
        n.labels = n.labels.map(() => fuzzString());
        n.id = fuzzString();
        if (n.note !== null) n.note = fuzzString();
        if (n.link) n.link = fuzzString();
        for (const key of Object.keys(n.attrs)) n.attrs[key] = fuzzString();
        if (n.kind === 'unknown') n.typed = fuzzString();
      });
    }
    for (let i = 0; i < mock.screens.length; i++) assertSafe(renderScreenSvg(mock, i, k), `tree #${k}`);
  }
  assert.ok(parsedOk > 0, 'some fuzz strings parse');
});

// --- the figure HTML around the screens (also spliced after the sanitizer) ---
const HTML_TAGS = new Set('figure div figcaption ol ul li span a details summary p strong'.split(' '));
const HTML_ATTRS = new Set(['class', 'id', 'role', 'data-wm-block', 'data-wm-digest', 'data-wm-screen', 'data-wm-el']);
const CLASSES = new Set('wm wm-look-wire wm-look-clean wm-proto wm-title wm-strip wm-variants wm-screen wm-start wm-cap wm-notes wm-outline wm-error'.split(' '));
const TAG_RE = /<([a-zA-Z][\w:-]*)((?:\s+[^\s=>]+="[^"]*")*)\s*\/?>/g;

function assertSafeHtml(html, what) {
  const msg = (m) => `${what}: ${m}`;
  assert.equal(typeof html, 'string', msg('a string'));
  const isCard = html.startsWith('<div class="wm wm-error" role="note">');
  assert.ok(isCard || (html.startsWith('<figure class="wm ') && html.endsWith('</figure>')), msg('figure or card'));
  // each <svg>…</svg> is checked by the SVG rules; what is left is the HTML shell
  const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) || [];
  for (const svg of svgs) assertSafe(svg, what);
  const shell = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  assert.ok(!/<\/?svg/i.test(shell), msg('svg outside a whole <svg> element'));
  for (const m of shell.matchAll(/<\/?([a-zA-Z][\w:-]*)/g)) assert.ok(HTML_TAGS.has(m[1]), msg(`html tag ${m[1]}`));
  assert.ok(!/<a[\s>]/.test(shell), msg('no <a> outside the svg'));
  assert.ok(!/&(?!(amp|lt|gt|quot|#39);)/.test(shell), msg('bare &'));
  assert.ok(!/<(?![a-zA-Z/])/.test(shell), msg('raw <'));
  const tags = [...shell.matchAll(TAG_RE)];
  assert.equal(tags.length, (shell.match(/<[a-zA-Z]/g) || []).length, msg('every tag well formed'));
  for (const tag of tags) {
    const rest = tag[2];
    assert.equal(rest.replace(/\s+[^\s=>]+="[^"]*"/g, '').trim(), '', msg('stray markup'));
    for (const a of rest.matchAll(/\s+([^\s=>]+)="([^"]*)"/g)) {
      const [, name, value] = a;
      assert.ok(HTML_ATTRS.has(name), msg(`html attribute ${name}`));
      if (name === 'id') assert.match(value, /^wm-[0-9]+-[a-z][a-z0-9-]*$/, msg('id'));
      if (name === 'class') for (const c of value.split(' ')) assert.ok(CLASSES.has(c), msg(`class ${c}`));
      if (name === 'role') assert.equal(value, 'note', msg('role'));
      if (name === 'data-wm-block') assert.match(value, /^[0-9]{1,4}$/, msg('block'));
      if (name === 'data-wm-digest') assert.match(value, /^[0-9a-f]{16}$/, msg('digest'));
    }
  }
  // every href in the figure is #wm-<n>-<slug>
  for (const h of html.matchAll(/\shref="([^"]*)"/g)) assert.match(h[1], /^#wm-[0-9]+-[a-z0-9-]+$/, msg('href'));
  assert.ok(!/\sstyle="/.test(shell), msg('no style in the html shell'));
  assert.ok(!/\son[a-z]+=/i.test(shell.replace(/>[^<]*</g, '><').replace(/\s(data-wm-el|data-wm-screen)="[^"]*"/g, '')), msg('on*='));
}

// Hotspots in a parsed figure always land on a screen of the same figure.
function assertLinksResolve(html, what) {
  const ids = new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]));
  for (const h of html.matchAll(/\shref="#([^"]*)"/g)) assert.ok(ids.has(h[1]), `${what}: #${h[1]} resolves`);
}

test('figure HTML: hostile labels through the parser, every look and view', () => {
  for (const label of LABELS) {
    for (const info of ['wiremark', 'screens look=clean', 'wiremark view=prototype', 'wiremark look=clean view=prototype']) {
      for (const bi of [0, 3, 49]) {
        const html = renderMockBlock(hostileBlock(label), info, { blockIndex: bi });
        assert.ok(html.startsWith('<figure'), `figure: ${JSON.stringify(label)}`);
        assertSafeHtml(html, `${JSON.stringify(label)} ${info}`);
        assertLinksResolve(html, JSON.stringify(label));
        assert.ok(html.includes(`id="wm-${bi}-a"`) && html.includes(`id="wm-${bi}-b"`));
      }
    }
  }
});

test('figure HTML: error cards escape hostile messages', () => {
  for (const label of LABELS) {
    assertSafeHtml(renderErrorCard([{ line: 1, message: label }, { line: '<b>', message: label }]), 'card');
    assertSafeHtml(renderMockBlock(`screen a\n  bogus ${q(label)}=1\n  !!! ${q(label)}`), 'parse error');
  }
});

test('figure HTML: seeded fuzz through the parser and straight into the tree', () => {
  const base = parseMock(hostileBlock('seed') + '\nvariant a2 of a "V"\n  #x hide'.replace('#x', '#' + 'h1-seed'));
  assert.equal(base.ok, true, JSON.stringify(base.errors));
  for (let k = 0; k < 300; k++) {
    const s = fuzzString();
    assertSafeHtml(renderMockBlock(hostileBlock(s.replace(/\n/g, ' ')), k % 3 ? 'wiremark' : 'wiremark view=prototype', { blockIndex: k % 60 }), `parse #${k}`);
    const mock = structuredClone(base.mock);
    mock.title = s;
    mock.look = k % 2 ? 'clean' : 'wire';
    mock.view = k % 3 ? 'stack' : 'prototype';
    mock.flow = [fuzzString(), 'b', fuzzString()];
    for (const scr of mock.screens) {
      scr.label = fuzzString();
      if (k % 4 === 0) scr.id = fuzzString();
      if (scr.variantOf && k % 5 === 0) scr.variantOf = fuzzString();
      walk(scr.root, (n) => {
        n.labels = n.labels.map(() => fuzzString());
        n.id = fuzzString();
        if (n.note !== null || k % 7 === 0) n.note = fuzzString();
        if (n.link) n.link = fuzzString();
        n.flags = n.flags.map(() => fuzzString());
        for (const key of Object.keys(n.attrs)) n.attrs[key] = fuzzString();
        if (n.kind === 'unknown') n.typed = fuzzString();
      });
    }
    assertSafeHtml(renderMockHtml(mock, { blockIndex: k, digest: k % 2 ? fuzzString() : '0123456789abcdef' }), `tree #${k}`);
  }
});

test('the figure checker rejects tampered output', () => {
  const good = renderMockBlock(hostileBlock('ok'));
  assertSafeHtml(good, 'good');
  const tampered = [
    good.replace('<div class="wm-strip">', '<div class="wm-strip"><script>x</script>'),
    good.replace('<div class="wm-strip">', '<div class="wm-strip" style="color:red">'),
    good.replace('<div class="wm-strip">', '<div class="wm-strip" onclick="x">'),
    good.replace('<div class="wm-strip">', '<div class="wm-strip"><a href="https://x">y</a>'),
    good.replace('id="wm-0-a"', 'id="login"'),
    good.replace('class="wm-strip"', 'class="wm-strip evil"'),
    good.replace('<div class="wm-strip">', '<div class="wm-strip"><img src=x>'),
    good.replace('<div class="wm-strip">', '<div class="wm-strip">&nbsp;'),
    good.replace('href="#wm-0-b"', 'href="javascript:x"'),
    good.replace('</figure>', '<svg></svg></figure>').replace(/<\/svg><\/figure>$/, '</figure>'),
    good.replace('<div class="wm-strip">', '<div class="wm-strip" style="max-width:100%;height:auto">'),
    good.replace(`style="${ROOT_STYLE}"`, 'style="max-width:100%;height:auto;background:url(x)"'),
    good.replace('<rect ', `<rect style="${ROOT_STYLE}" `),
  ];
  for (const [i, t] of tampered.entries()) {
    assert.notEqual(t, good, `tamper ${i} applied`);
    assert.throws(() => assertSafeHtml(t, `tamper ${i}`), undefined, `tamper ${i} caught`);
  }
});
