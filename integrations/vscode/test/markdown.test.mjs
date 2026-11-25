import { test } from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'
import { extendMarkdownIt, previewHtml } from '../src/markdown.mjs'

test('plugin draws a wiremark fence and leaves other fences alone', () => {
  const md = extendMarkdownIt(new MarkdownIt())
  const html = md.render('```wiremark\nscreen a "A"\n  button "Go"\n```\n\n```js\nlet x = 1\n```\n')
  assert.ok(html.includes('<figure class="wm'))
  assert.ok(html.includes('<code class="language-js">'))
})

test('previewHtml: CSP, no script, hostile label escaped', () => {
  const evil = 'button "<img src=x onerror=1>"\n'
  for (const [text, lang] of [[evil, 'wiremark'], ['```wiremark\n' + evil + '```\n', 'markdown']]) {
    const html = previewHtml(text, lang)
    assert.ok(html.includes('Content-Security-Policy'))
    assert.ok(!html.includes('<script'))
    assert.ok(!html.includes('<img src=x'))
    assert.ok(html.includes('&lt;img'))
  }
})
