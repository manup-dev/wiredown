import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderFlowAnimation, renderFlowFrame, flowDuration, flowPath } from '../src/export/index.js'
import { parseMock, renderScreenSvg } from '../src/index.js'

const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8')
const kinds = readFileSync(new URL('./fixtures/all-kinds.wiredown', import.meta.url), 'utf8')
const W = 'wiredown'

// The standalone file's rules: one <style> of generated CSS, nested <svg> allowed, nothing that
// runs, loads or links, and only the five XML entities.
function assertSafe(svg, msg = '') {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /, msg)
  assert.ok(svg.endsWith('</svg>'), msg)
  // Tags only, attribute values emptied: author words in text or an escaped value are fine.
  const markup = svg.replace(/>[^<]*</g, '><').replace(/="[^"]*"/g, '=""')
  for (const bad of ['<script', '<foreignObject', '<image', '<use', '<iframe', '<a ', '<a>', 'href', 'url(', '@import', '<!', '<?']) {
    assert.ok(!markup.includes(bad), `${msg} contains ${bad}`)
  }
  assert.ok(!/\son[a-z]+\s*=/i.test(markup), `${msg} has an on* attribute`)
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(svg), `${msg} has another entity`)
  assert.ok((svg.match(/<style/g) || []).length <= 1, `${msg} has more than one style`)
  const style = svg.match(/<style>([^<]*)<\/style>/)
  if (style) {
    assert.match(style[1], /^[\w.\-{}:;%(),!@# ]+$/, `${msg} style holds only generated CSS`)
    assert.ok(!/url\(|@import|expression/i.test(style[1]), `${msg} style loads nothing`)
  }
  const tags = [...svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)]
  const allowed = new Set(['svg', 'style', 'title', 'g', 'rect', 'circle', 'ellipse', 'line', 'path', 'polyline', 'text', 'tspan'])
  const stack = []
  for (const [, close, name, self] of tags) {
    assert.ok(allowed.has(name), `${msg} has <${name}>`)
    if (self) continue
    if (close) assert.equal(stack.pop(), name, `${msg} tags balance`)
    else stack.push(name)
  }
  assert.equal(stack.length, 0, `${msg} tags balance`)
}

test('the animation is a standalone, safe SVG with one style, keyframes and nested screens', () => {
  const svg = renderFlowAnimation(login, W)
  assertSafe(svg)
  assert.equal((svg.match(/<style>/g) || []).length, 1)
  assert.match(svg, /@keyframes wm-a0\{/)
  assert.match(svg, /@keyframes wm-a2\{/)
  assert.match(svg, /animation-duration:7\.8s;animation-iteration-count:infinite/)
  assert.ok((svg.match(/<svg /g) || []).length >= 5, 'root, window and three screens')
  assert.match(svg, /^<svg [^>]* width="\d+" height="\d+"/)
  assert.match(svg, />wiredown<\/text>/)
})

test('a file you can open: writes a sample that plays as <img src>', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wm-anim-'))
  const file = join(dir, 'flow.svg')
  writeFileSync(file, renderFlowAnimation(login, W))
  const text = readFileSync(file, 'utf8')
  // An <img> needs a namespace, an intrinsic size and CSS animation (no script, no SMIL events).
  assert.match(text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) (\d+)" width="\1" height="\2"/)
  assert.match(text, /\.wm-s1\{animation-name:wm-a1;opacity:0/)
  assert.ok(!/<animate|<set /.test(text))
})

test('same input, same bytes', () => {
  assert.equal(renderFlowAnimation(login, W), renderFlowAnimation(login, W))
  assert.equal(renderFlowFrame(login, W, { at: 3.3 }), renderFlowFrame(login, W, { at: 3.3 }))
})

test('reduced motion shows step 0 only: animations off, later steps hidden by default', () => {
  const svg = renderFlowAnimation(login, W)
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.wm-k\{animation:none!important\}\}/)
  assert.match(svg, /\.wm-s0\{animation-name:wm-a0;transform/)
  assert.match(svg, /\.wm-s1\{[^}]*opacity:0/)
  assert.match(svg, /\.wm-r0\{[^}]*opacity:0/)
  assert.match(svg, /\.wm-f0\{[^}]*opacity:0/)
})

test('a tap (finger dot + released ring) before a switch only where the next step has a via', () => {
  const svg = renderFlowAnimation(login, W)
  assert.match(svg, /<circle [^>]*r="16" fill="#3b5bdb" fill-opacity="\.5" class="wm-k wm-f0"\/>/)
  assert.match(svg, /<circle [^>]*r="16" fill="none" stroke="#3b5bdb" stroke-width="3" stroke-opacity="\.75" class="wm-k wm-r0"\/>/)
  assert.ok(!svg.includes('wm-r1') && !svg.includes('wm-f1'), 'login-error is not reached by a tap')
  assert.match(svg, /scale\(0\.85\)/)
  assert.match(svg, /scale\(2\.2\)/)
})

test('the tap is centred on the tapped element, nested in containers', () => {
  const body = 'screen a\n  row pad=16\n    card "Box" pad=16\n      button "Go" -> b #go\nscreen b\n  text "b"'
  assert.equal(flowPath(body, W).steps[1].via, 'go')
  const a = renderFlowAnimation(body, W)
  const [, cx, cy] = a.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="16"/)
  // The link's hit rect in the screen's own drawing, offset by where the drawing is placed.
  const screen = renderScreenSvg(parseMock(body, W).mock, 0, 0)
  const [, x, y, w, h] = screen.match(/<a href="#wm-0-b"><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/).map(Number)
  const [, sx, sy] = a.match(/<svg x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="[\d.]+" viewBox="-1 -22 /).map(Number)
  assert.equal(Number(cx), sx + 1 + x + w / 2)
  assert.equal(Number(cy), sy + 22 + y + h / 2)
})

test('frames: t=0 is step 0, mid step 2 is step 2, no style; the loop wraps', () => {
  const at0 = renderFlowFrame(login, W)
  assertSafe(at0, 'frame')
  assert.ok(!at0.includes('<style'))
  assert.ok(at0.includes('<title>Sign in</title>'))
  assert.ok(!at0.includes('<title>Reset password</title>'))
  assert.ok(!at0.includes('<title>Wrong password</title>'))
  const mid2 = renderFlowFrame(login, W, { at: 2.5 * 2.6 })
  assert.ok(mid2.includes('<title>Wrong password</title>'))
  assert.ok(!mid2.includes('<title>Reset password</title>'))
  assert.ok(mid2.includes('>Sign in · Wrong password</text>'))
  assert.equal(renderFlowFrame(login, W, { at: 7.8 + 2.5 * 2.6 }), mid2)
  // Same geometry as the animation: same root tag.
  const root = (s) => s.slice(0, s.indexOf('>'))
  assert.equal(root(at0), root(renderFlowAnimation(login, W)))
})

test('the tap is computed in frames: dot in, pressed, then the released ring', () => {
  const sw = 2.6 - 0.45 // the switch to step 1 starts here
  assert.ok(!renderFlowFrame(login, W, { at: sw - 0.7 }).includes('r="16"'), 'no tap yet')
  const press = renderFlowFrame(login, W, { at: sw - 0.15 })
  assert.match(press, /r="16" fill="#3b5bdb" fill-opacity="\.5" transform="translate\([\d.-]+ [\d.-]+\) scale\(0\.8\d*\)"\/>/)
  const release = renderFlowFrame(login, W, { at: sw + 0.2 })
  assert.match(release, /stroke-opacity="\.75" opacity="0\.\d+" transform="translate\([\d.-]+ [\d.-]+\) scale\((1\.[5-9]|2)[\d.]*\)"\/>/)
  assert.ok(!renderFlowFrame(login, W, { at: sw + 0.6 }).includes('r="16"'), 'tap over')
})

test('mid-transition shows only the incoming screen and its caption', () => {
  // The file's own <title> is the block's @title ("Sign in"); look at the screens after it.
  const frame = (at) => { const f = renderFlowFrame(login, W, { at }); return f.slice(f.indexOf('</title>') + 8) }
  const mid = frame(2.6 - 0.2)
  assert.ok(mid.includes('<title>Reset password</title>'))
  assert.ok(!mid.includes('<title>Sign in</title>'), 'the outgoing screen is gone')
  assert.ok(mid.includes('>Reset password</text>') && !mid.includes('>Sign in</text>'), 'one caption')
  assert.match(mid, /<g opacity="0\.\d+">/)
  // The wrap into step 0 too: only step 0 while it enters.
  const wrap = frame(7.8 - 0.2)
  assert.ok(wrap.includes('<title>Sign in</title>') && !wrap.includes('<title>Wrong password</title>'))
  for (let t = 0; t < 7.8; t += 0.05) {
    const f = frame(t)
    // At most one (none for an instant: a fade starts from the plain surface).
    assert.ok((f.match(/<title>(Sign in|Reset password|Wrong password)<\/title>/g) || []).length <= 1, `one screen at ${t}`)
    assert.ok((f.match(/text-anchor="middle" fill="#1f2328" class="wm-i"/g) || []).length <= 1, `one caption at ${t}`)
  }
})

test('dark: a constant prefers-color-scheme block; frames take theme', () => {
  const svg = renderFlowAnimation(login, W)
  assert.ok(svg.includes('@media (prefers-color-scheme:dark){svg{color-scheme:dark;color:#e6edf3;--wm-bg:#0d1117}.wm-p{fill:#0d1117}.wm-i{fill:#e6edf3}}'))
  assert.match(svg, /<rect width="\d+" height="\d+" class="wm-p" fill="#fff"\/>/)
  assert.match(svg, /class="wm-i wm-k wm-l0"/)
  const dark = renderFlowFrame(login, W, { theme: 'dark' })
  assertSafe(dark, 'dark')
  assert.match(dark, /^<svg [^>]* color="#e6edf3" style="--wm-bg:#0d1117">/)
  assert.ok(!dark.includes('class="wm-p" fill="#fff"') && dark.includes('class="wm-p" fill="#0d1117"') && dark.includes('fill="#e6edf3"'))
  assert.equal(renderFlowFrame(login, W, { theme: 'nope' }), renderFlowFrame(login, W))
})

test('motion: the entered screen\'s motion, else the header, else fade; none is a cut', () => {
  const two = 'screen a\n  button "B" -> b\nscreen b\n  text "b"'
  assert.ok(!renderFlowAnimation(two, W).includes('translate('))
  assert.match(renderFlowAnimation('@motion slide\n' + two, W), /opacity:0;transform:translate\(32px,0px\)/)
  assert.match(renderFlowAnimation(two.replace('screen b', 'screen b motion=sheet'), W), /transform:translate\(0px,48px\)/)
  assert.match(renderFlowAnimation('@motion zoom\n' + two, W), /scale\(0\.96\)/)
  assert.match(renderFlowAnimation('@motion push\n' + two, W), /opacity:0\.4;transform:translate\(64px,0px\)/)
  const cut = renderFlowFrame('@motion none\n' + two, W, { at: 2.6 - 0.2 })
  assert.ok(!cut.includes('<title>b</title>'), 'a cut has no overlap before the switch')
})

test('options: step, transition, credit; duration = steps x step', () => {
  assert.equal(flowDuration(login, W), 7.8)
  assert.equal(flowDuration(login, W, { step: 1 }), 3)
  assert.equal(flowDuration('@device nope', W), 0)
  assert.match(renderFlowAnimation(login, W, { step: 1 }), /animation-duration:3s/)
  assert.ok(!renderFlowAnimation(login, W, { credit: false }).includes('>wiredown<'))
  assert.match(renderFlowAnimation(login, W, { step: -1 }), /animation-duration:7\.8s/)
})

test('one screen: a still picture, still a safe file', () => {
  const svg = renderFlowAnimation('screen a "Only"\n  text "x"', W)
  assertSafe(svg)
  assert.ok(!svg.includes('@keyframes'))
  assert.ok(svg.includes('>Only</text>'))
})

test('hostile labels stay text', () => {
  const evil = [
    '</style><script>alert(1)</script>', '"><image href="x" onerror="alert(1)">', '@import url(https://x/y.css);',
    '&nbsp;&#x3c;script&#62;', ']]><!--', '}*{background:url(javascript:x)}', '<foreignObject>', 'a\u0000b c',
  ]
  for (const label of evil) {
    const q = JSON.stringify(label).replace(/\\u0000|\\u2028/g, '')
    const body = `@title ${q}\nscreen a ${q}\n  button ${q} -> b\n  text ${q} note=${q}\nscreen b ${q}\n  h1 ${q}`
    assert.equal(flowPath(body, W).ok, true, `${label} parses, so the drawing is tested`)
    for (const svg of [renderFlowAnimation(body, W), renderFlowFrame(body, W, { at: 1.9 })]) {
      assertSafe(svg, label)
      assert.ok(!svg.includes('<script') && !svg.includes('alert(1)</'), label)
    }
  }
})

test('every kind animates safely', () => {
  assertSafe(renderFlowAnimation(kinds, W))
  assertSafe(renderFlowFrame(kinds, W, { at: 1 }))
})

test('a block that does not parse is the error card as an SVG', () => {
  const svg = renderFlowAnimation('@device nope\nscreen a', W)
  assertSafe(svg, 'error')
  assert.match(svg, /line 1: /)
  const frame = renderFlowFrame('@device nope\nscreen a', W)
  assertSafe(frame, 'error frame')
  assert.ok(!frame.includes('<style') && frame.includes('line 1: '))
  for (const v of [null, undefined, 42, {}, '']) {
    assert.doesNotThrow(() => renderFlowAnimation(v, v, v))
    assertSafe(renderFlowAnimation(v, v, v), String(v))
  }
})

test('over 2 MB is refused with an error SVG', () => {
  let screen = 'screen a\n'
  for (let i = 0; i < 1300; i++) screen += `  text "row ${i} has words"\n`
  const body = `@flow ${Array(24).fill('a').join(' ')}\n${screen}`
  assert.equal(flowPath(body, W).steps.length, 24)
  const svg = renderFlowAnimation(body, W)
  assertSafe(svg)
  assert.match(svg, /too large to animate/)
  assert.ok(svg.length < 4096)
})

test('the 2 MB cap counts UTF-8 bytes', () => {
  let screen = 'screen a\n'
  for (let i = 0; i < 1200; i++) screen += `  text "${'字'.repeat(40)}"\n`
  const ok = renderFlowAnimation(`@flow a a a a a a\n${screen}`, W, { credit: false })
  assert.ok(!/too large/.test(ok) && ok.length < 2 * 1024 * 1024)
  const big = renderFlowAnimation(`@flow a a a a a a a\n${screen}`, W, { credit: false })
  assert.match(big, /too large to animate/, 'fewer than 2M characters, more than 2 MB')
})
