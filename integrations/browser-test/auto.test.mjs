import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const html = `<!doctype html><body>
<pre><code class="language-wiredown">button "Go"</code></pre>
<div class="highlight language-screens"><pre><span>h1 </span><span>"Hi"</span></pre></div>
<pre><code class="language-js">x</code></pre></body>`

test('replaces wiredown code blocks with figures and adds the stylesheet once', async () => {
  const dom = new JSDOM(html, { url: 'https://example.test/' })
  Object.assign(globalThis, { document: dom.window.document, window: dom.window })
  const { render } = await import('../../browser/auto.js?manual')
  assert.equal(render(document), 2)
  assert.equal(document.querySelectorAll('figure.wm').length, 2)
  assert.equal(document.querySelectorAll('code.language-js').length, 1)
  assert.equal(document.querySelectorAll('link[data-wiredown]').length, 1)
  assert.equal(render(document), 0) // idempotent
})

function load(h) {
  const dom = new JSDOM(h, { url: 'https://example.test/' })
  Object.assign(globalThis, { document: dom.window.document, window: dom.window })
  return dom.window.document
}
const tag = (src, extra = '') => `<!doctype html><head><script type="module" src="${src}" ${extra}></script></head><body></body>`

test('findOwnScript: exact, query, fragment, redirected, none, manual', async () => {
  const { findOwnScript } = await import('../../browser/auto.js?manual')
  const u = 'https://unpkg.com/wiredown@0.1/browser/auto.js'
  assert.ok(findOwnScript(load(tag(u)), u))
  assert.ok(findOwnScript(load(tag(u + '?v=2')), u))
  assert.ok(findOwnScript(load(tag(u + '#x')), u))
  assert.ok(findOwnScript(load(tag(u)), u + '?a#b'))
  assert.ok(findOwnScript(load(tag(u)), 'https://unpkg.com/wiredown@0.1.3/browser/auto.js'))
  assert.equal(findOwnScript(load(tag('https://x.test/other.js')), u), null)
  const two = `<head><script type="module" src="https://a.test/browser/auto.js"></script><script type="module" src="https://b.test/browser/auto.js"></script></head>`
  assert.equal(findOwnScript(load(two), 'https://c.test/browser/auto.js'), null)
  const s = findOwnScript(load(tag(u, 'data-wiredown-manual')), u)
  assert.ok(s.hasAttribute('data-wiredown-manual'))
})

test('Prism pre.language-x, and last pre of a multi-pre container', async () => {
  const { render } = await import('../../browser/auto.js?manual')
  const d = load(`<body><pre class="language-wiredown"><code class="language-wiredown">button "A"</code></pre>
<pre class="language-screens">button "B"</pre>
<div class="language-wiredown"><pre>1
2</pre><pre><code>button "C"</code></pre></div></body>`)
  assert.equal(render(d), 3)
  assert.equal(d.querySelectorAll('figure.wm').length, 3)
  assert.equal(d.querySelectorAll('pre').length, 1) // the line-number pre stays
})

test('a malformed sibling script src does not stop findOwnScript', async () => {
  const { findOwnScript } = await import('../../browser/auto.js?manual')
  const u = 'https://unpkg.com/wiredown@0.1/browser/auto.js'
  const d = load(`<head><script type="module" src="http://[bad"></script><script type="module" src="${u}"></script></head>`)
  assert.ok(findOwnScript(d, u))
  assert.equal(findOwnScript(load(`<head><script type="module" src="http://[bad"></script></head>`), u), null)
})
