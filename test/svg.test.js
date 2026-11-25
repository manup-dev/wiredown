import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMock, layoutScreen, paintScreen, serializeScreen, renderScreenSvg, escapeXml, numberNotes, ICONS, iconPath } from '../src/index.js';
import { styleAttr } from '../src/svg.js';

// The root <svg>'s one constant style; every other style is a paint form.
const ROOT = ' style="max-width:100%;height:auto"';
const unroot = (svg) => {
  assert.equal(svg.split(ROOT).length - 1, 1, 'the root style, exactly once');
  assert.ok(svg.slice(0, svg.indexOf('>')).includes(ROOT), 'on the root svg');
  return svg.replace(ROOT, '');
};
const LOGIN = readFileSync(new URL('./fixtures/login.wiremark', import.meta.url), 'utf8');

function mockOf(src, look) {
  const r = parseMock(src);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  if (look) r.mock.look = look;
  return r.mock;
}

function svgOf(src, i = 0, look, blockIndex = 0) {
  const mock = mockOf(src, look);
  return renderScreenSvg(mock, i, blockIndex);
}

test('login screen: one root svg with namespace, title and the device frame', () => {
  const svg = svgOf(LOGIN);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), svg.slice(0, 80));
  assert.equal(svg.split('<svg').length - 1, 1);
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('<title>Sign in</title>'));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('aria-label="Sign in"'));
  assert.ok(svg.includes('font-family="system-ui, -apple-system, &#39;Segoe UI&#39;, Roboto, sans-serif"'));
  assert.ok(svg.includes('>Mock</text>'));
  assert.ok(/viewBox="[-\d. ]+"/.test(svg));
  // the title is the first child
  assert.ok(/^<svg[^>]*><title>/.test(svg));
});

test('login screen: element ids, hotspot and text', () => {
  const svg = svgOf(LOGIN);
  assert.ok(svg.includes('data-wm-el="submit"'));
  assert.ok(svg.includes('data-wm-el="email"'));
  assert.ok(svg.includes('<a href="#wm-0-reset">'));
  assert.ok(svg.includes('>Welcome back</text>'));
  assert.ok(svg.includes('>you@company.com</text>'));
  assert.ok(svg.includes('>Sign in</text>'));
  assert.ok(!svg.includes(' id="'), 'no id= in a screen svg');
});

test('the block index goes into the hotspot', () => {
  assert.ok(svgOf(LOGIN, 0, undefined, 3).includes('<a href="#wm-3-reset">'));
});

test('same input gives identical bytes', () => {
  assert.equal(svgOf(LOGIN), svgOf(LOGIN));
  assert.equal(svgOf(LOGIN, 2, 'clean'), svgOf(LOGIN, 2, 'clean'));
});

test('numbers never carry more than one decimal', () => {
  for (const look of ['wire', 'clean']) for (let i = 0; i < 3; i++) {
    const svg = svgOf(LOGIN, i, look);
    assert.ok(!/\d\.\d\d/.test(svg), `${look} ${i}: ${svg.match(/.{20}\d\.\d\d.{10}/)}`);
  }
});

test('wire look paints with currentColor only', () => {
  for (let i = 0; i < 3; i++) {
    // the one exception is the opaque surface under overlays and note badges
    const svg = unroot(svgOf(LOGIN, i, 'wire')).replace(/ fill="#fff" style="fill:var\(--wm-bg,Canvas\)"/g, '');
    assert.ok(!/(fill|stroke)="#/.test(svg));
    assert.ok(!svg.includes('style='));
  }
});

test('clean look: accent with a CSS variable fallback, white text on primary', () => {
  const svg = unroot(svgOf(LOGIN, 0, 'clean'));
  assert.ok(svg.includes('style="fill:var(--wm-accent,#3b5bdb)"'));
  assert.ok(svg.includes('fill="#3b5bdb"'));
  assert.ok(/fill="#fff"[^>]*>Sign in</.test(svg));
  for (const m of svg.match(/style="[^"]*"/g)) assert.match(m, /^style="((fill|stroke):var\(--wm-accent,#3b5bdb\)|fill:var\(--wm-bg,Canvas\))"$/);
});

test('wire primary button: 2px stroke and bold label', () => {
  const svg = svgOf(LOGIN, 0, 'wire');
  const g = svg.slice(svg.indexOf('data-wm-el="submit"'));
  assert.ok(/stroke-width="2"/.test(g.slice(0, 400)));
  assert.ok(/font-weight="(600|700)"[^>]*>Sign in</.test(g));
});

test('variant shows its patched error and the navbar links back', () => {
  assert.ok(svgOf(LOGIN, 1).includes('>That password is not right</text>'));
  assert.ok(svgOf(LOGIN, 1).includes('<title>Wrong password</title>'));
  assert.ok(svgOf(LOGIN, 2).includes('<a href="#wm-0-login">'));
});

test('notes: numbered badges in source order, a variant keeps its source number', () => {
  const mock = mockOf(LOGIN);
  const notes = numberNotes(mock);
  const nums = [...notes.values()];
  assert.ok(nums.length >= 1);
  assert.equal(Math.min(...nums), 1);
  const submit = mock.screens[0].root.children[0].children.at(-1);
  const submit2 = mock.screens[1].root.children[0].children.at(-1);
  assert.equal(notes.get(submit), 1);
  assert.equal(notes.get(submit2), 1);
  const src = 'text "a" note="first"\ntext "b"\nbutton "c" note="second"';
  const m2 = mockOf(src);
  assert.deepEqual([...numberNotes(m2).values()], [1, 2]);
  const svg = renderScreenSvg(m2, 0, 0);
  assert.ok(svg.includes('>1</text>') && svg.includes('>2</text>'));
});

test('dangling and hostile links get no hotspot; back resolves when it can', () => {
  assert.ok(!svgOf('button "x" -> nowhere').includes('<a'));
  assert.ok(!svgOf('button "x" -> javascript:alert(1)').includes('<a'));
  const two = 'screen a "A"\n  button "go" -> b\nscreen b "B"\n  button "Back" -> back';
  assert.ok(svgOf(two, 1).includes('<a href="#wm-0-a">'));
  const lone = 'screen a "A"\n  button "Back" -> back';
  assert.ok(!svgOf(lone).includes('<a'));
  const flow = '@flow a b\nscreen a "A"\n  text "hi"\nscreen b "B"\n  button "Back" -> back';
  assert.ok(svgOf(flow, 1).includes('<a href="#wm-0-a">'));
});

test('unknown kinds are a dashed placeholder with the label and a ?', () => {
  const svg = svgOf('frobnicator "Hello"\nwidget');
  assert.ok(svg.includes('>Hello</text>'));
  assert.ok(svg.includes('>widget</text>'));
  assert.ok(svg.includes('>?</text>'));
  assert.ok(svg.includes('stroke-dasharray'));
});

test('a screen taller than the device gets a fold line', () => {
  const tall = '@device 200x200\n' + Array.from({ length: 20 }, (_, i) => `text "Line ${i}"`).join('\n');
  const svg = svgOf(tall);
  assert.ok(svg.includes('>fold</text>'));
});

test('every kind paints without throwing in both looks', () => {
  const all = [
    '@device tablet',
    'screen all "All kinds"',
    '  navbar "Title" back',
    '  tabs',
    '    tab "One" selected',
    '    tab "Two" icon=star',
    '  card "Card"',
    '    h2 "Heading" muted',
    '    h3 "Small"',
    '    text "Body text that is long enough to wrap onto more than one line in a card" muted',
    '    link "A link" icon=mail',
    '  grid cols=3',
    '    image "Cover"',
    '    avatar "Ada Lovelace"',
    '    icon icon=bell',
    '  row',
    '    badge "New" tone=good',
    '    badge "Late" tone=bad icon=clock',
    '    badge "Warn" tone=warn',
    '    badge "Info" tone=info',
    '    spacer',
    '    button "Go" icon=plus loading',
    '    button "Off" disabled',
    '  divider',
    '  input "Search" type=search placeholder="Find"',
    '  textarea "About" rows=4 placeholder="Tell us"',
    '  select "Plan" options="Free, Pro"',
    '  radio "One" checked',
    '  radio "Two"',
    '  toggle "Alerts" on',
    '  toggle "Sounds"',
    '  checkbox "Agree"',
    '  list',
    '    item "First" "Sub line" icon=user selected',
    '    item "Second" muted -> all',
    '  table cols="Name, Role, Seats" rows=3',
    '  tabbar',
    '    item "Home" icon=home selected',
    '    item "Me" icon=user',
    '  toast "Saved" tone=good',
    '  modal "Confirm"',
    '    text "Sure?"',
    '    button "Yes" primary',
    '  sheet "Pick"',
    '    item "Option"',
  ].join('\n');
  for (const look of ['wire', 'clean']) {
    const svg = svgOf(all, 0, look);
    assert.equal(svg.split('<svg').length - 1, 1);
    assert.ok(!/\d\.\d\d/.test(svg), look);
    assert.ok(svg.includes('data-wm-el="tab-one"'));
    // every shape is visible: a token the look lacks would silently drop its paint
    for (const m of svg.matchAll(/<(path|line|circle|rect)\b[^>]*>/g)) {
      const tag = m[0];
      if (/fill-opacity="0"/.test(tag)) continue; // hotspot hit area
      assert.ok(/stroke="(currentColor|#)/.test(tag) || /fill="(currentColor|#)/.test(tag), `${look}: invisible ${tag}`);
    }
  }
});

test('escapeXml: exactly five entities, controls and bad code points dropped', () => {
  assert.equal(escapeXml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(escapeXml('a\tb\nc'), 'a\tb\nc');
  assert.equal(escapeXml('a\u0000b\u0007c\u001fd\re'), 'abcde');
  assert.equal(escapeXml('x y z￾￿'), 'xyz');
  assert.equal(escapeXml('a\uD800b\uDC00c'), 'abc');
  assert.equal(escapeXml('ok 😀 é ü 中'), 'ok 😀 é ü 中');
  assert.equal(escapeXml('&amp;'), '&amp;amp;');
  assert.equal(escapeXml(42), '42');
  assert.equal(escapeXml(null), '');
});

test('serializer refuses unknown ops, bad path data and bad link targets', () => {
  const ops = [
    { op: 'script', text: 'x' },
    { op: 'path', d: 'M0 0 url(javascript:x)' },
    { op: 'link', target: 'javascript:alert(1)', ops: [{ op: 'rect', x: 0, y: 0, w: 1, h: 1, fill: 'faint' }] },
    { op: 'rect', x: 1, y: 1, w: 2, h: 2, fill: 'red;background:url(x)' },
    { op: 'group', el: '"><script>', ops: [{ op: 'text', x: 0, y: 0, text: '</text>', size: 12 }] },
  ];
  const svg = serializeScreen(ops, { width: 100, height: 100, title: 't', blockIndex: 0, screenId: 's', look: 'wire' });
  assert.ok(!svg.includes('script>') && !svg.includes('<script'));
  assert.ok(!svg.includes('url('));
  assert.ok(!svg.includes('<a'));
  assert.ok(!svg.includes('red'));
  assert.ok(svg.includes('data-wm-el="&quot;&gt;&lt;script&gt;"'));
  assert.ok(svg.includes('&lt;/text&gt;'));
});

test('icons: the vendored set is complete and scales to plain path data', () => {
  const names = 'home users settings search bell plus x check chevron-left chevron-right chevron-down menu mail lock user card download upload trash edit star heart calendar clock filter more google apple github image file'.split(' ');
  for (const n of names) {
    assert.ok(Object.prototype.hasOwnProperty.call(ICONS, n), n);
    const d = iconPath(n, 10, 20, 18);
    assert.match(d, /^[MmLlHhVvCcSsQqAaZz0-9 .-]+$/, n);
    assert.ok(!/\d\.\d\d/.test(d), `${n}: ${d}`);
  }
  assert.equal(iconPath('nope', 0, 0, 24), null);
  assert.equal(iconPath('__proto__', 0, 0, 24), null);
});

test('layout and paint stay usable directly', () => {
  const mock = mockOf(LOGIN);
  const L = layoutScreen(mock.screens[0], mock.device);
  const ops = paintScreen(L, mock, 0, 0);
  assert.ok(Array.isArray(ops) && ops.length > 0);
  const svg = serializeScreen(ops, { width: L.width, height: L.height, title: 'Sign in', blockIndex: 0, screenId: 'login', look: 'wire' });
  assert.equal(svg, renderScreenSvg(mock, 0, 0));
});

test('overlays and note badges sit on the opaque surface in both looks', () => {
  for (const look of ['wire', 'clean']) {
    const mock = mockOf('text "behind"\ntoast "Saved"', look);
    const L = layoutScreen(mock.screens[0], mock.device);
    const ops = paintScreen(L, mock, 0, 0);
    const toast = ops.find((o) => o.op === 'group' && o.el === 'toast-saved');
    assert.ok(toast, look);
    const firstRect = toast.ops.find((o) => o.op === 'rect');
    assert.equal(firstRect.fill, 'surface', look);
    assert.equal(toast.ops[0], firstRect, `${look}: the surface is painted first`);
    const svg = renderScreenSvg(mock, 0, 0);
    assert.ok(svg.includes('fill="#fff" style="fill:var(--wm-bg,Canvas)"'), look);
  }
  const badge = svgOf('button "Go" note="n"');
  assert.ok(/<circle[^>]*fill="#fff" style="fill:var\(--wm-bg,Canvas\)"/.test(badge));
  const modal = svgOf('text "x"\nmodal "M"\n  text "y"');
  assert.ok(modal.includes('style="fill:var(--wm-bg,Canvas)"'));
});

test('block index is an integer 0..9999, else 0', () => {
  for (const bad of [Infinity, 1e300, -1, 'x', 1.5, 10000, NaN, null]) {
    assert.ok(svgOf(LOGIN, 0, undefined, bad).includes('<a href="#wm-0-reset">'), String(bad));
  }
  assert.ok(svgOf(LOGIN, 0, undefined, 9999).includes('<a href="#wm-9999-reset">'));
  for (const m of svgOf(LOGIN, 0, undefined, 1e300).matchAll(/href="([^"]*)"/g)) assert.match(m[1], /^#wm-[0-9]+-[a-z0-9-]+$/);
});

test('string coordinates never concatenate', () => {
  const svg = serializeScreen([
    { op: 'icon', name: 'check', x: '10', y: '20', size: '18' },
    { op: 'icon', name: 'nope', x: '10', y: '20', size: '18' },
    { op: 'rect', x: '5', y: '5', w: '10', h: '10', fill: 'faint' },
    { op: 'circle', cx: '7', cy: 'oops', r: '2', fill: 'faint' },
  ], { width: 100, height: 100, title: 't', blockIndex: 0, screenId: 's', look: 'wire' });
  assert.ok(svg.includes('<rect x="5" y="5" width="10" height="10"'));
  assert.ok(svg.includes('<circle cx="7" cy="0" r="2"'));
  assert.ok(svg.includes('<circle cx="19" cy="29" r="8"'), 'unknown-icon ring at 10 + 18/2');
  assert.ok(!/\d{4,}/.test(svg.replace(/xmlns="[^"]*"|viewBox="[^"]*"|font-family="[^"]*"/g, '')), svg);
});

test('renderScreenSvg never throws: out of range or malformed gives ""', () => {
  const mock = mockOf(LOGIN);
  for (const i of [-1, 3, 99, 1.5, NaN, '0', undefined]) assert.equal(renderScreenSvg(mock, i, 0), '', String(i));
  assert.equal(renderScreenSvg(null, 0, 0), '');
  assert.equal(renderScreenSvg({}, 0, 0), '');
  assert.equal(renderScreenSvg({ screens: [null] }, 0, 0), '');
});

test('style: approved parts only, a fill and a stroke joined by ";"', () => {
  const ops = [
    { op: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'accent', stroke: 'accent' },
    { op: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'surface', stroke: 'accent' },
  ];
  const svg = unroot(serializeScreen(ops, { width: 100, height: 100, title: 't', blockIndex: 0, screenId: 's', look: 'clean' }));
  assert.ok(svg.includes('style="fill:var(--wm-accent,#3b5bdb);stroke:var(--wm-accent,#3b5bdb)"'));
  assert.ok(svg.includes('style="fill:var(--wm-bg,Canvas);stroke:var(--wm-accent,#3b5bdb)"'));
  assert.equal((svg.match(/ style=/g) || []).length, 2, 'never two style attributes on one element');
  assert.equal(styleAttr('fill:var(--wm-bg,Canvas)'), ' style="fill:var(--wm-bg,Canvas)"');
  assert.equal(styleAttr(undefined, 'stroke:var(--wm-accent,#3b5bdb)'), ' style="stroke:var(--wm-accent,#3b5bdb)"');
  for (const bad of ['fill:url(x)', 'fill:var(--wm-bg,#fff)', 'fill:red;stroke:blue', 'stroke:var(--wm-bg,Canvas)', 'fill:var(--wm-accent,#3b5bdb);x:y']) {
    assert.equal(styleAttr(bad, bad), '', bad);
  }
  assert.equal(styleAttr('fill:url(x)', 'stroke:var(--wm-accent,#3b5bdb)'), ' style="stroke:var(--wm-accent,#3b5bdb)"');
});
