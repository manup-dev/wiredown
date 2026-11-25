import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { compile } from '@mdx-js/mdx'
import rehypeWiredown from '../index.js'

const md = '# Spec\n\n```wiredown look=clean\nscreen a "A"\n  button "Go" primary\n```\n\n```js\nx\n```\n'
const toHtml = (s) => unified().use(remarkParse).use(remarkRehype).use(rehypeWiredown).use(rehypeStringify).process(s).then(String)

test('draws wiredown fences, leaves other code alone', async () => {
  const html = await toHtml(md)
  assert.match(html, /<figure class="wm[^"]*"/)
  assert.match(html, /<svg /)
  assert.match(html, /<code class="language-js">/)
  assert.ok(!html.includes('language-wiredown'))
})

test('the info string reaches the renderer (look=clean)', async () => {
  const html = await toHtml(md)
  assert.match(html, /wm-look-clean/)
})

test('compiles inside MDX', async () => {
  const out = await compile(md, { rehypePlugins: [rehypeWiredown] })
  assert.match(String(out), /svg/)
})

const fence = (look = '') => '```wiredown ' + look + '\nscreen a "A"\n  button "Go"\n```\n'

test('several fences, in a list and in a quote: each a figure, ids unique and ordered', async () => {
  const src = fence() + '\n' + fence() + '\n- item\n\n  ' + fence().split('\n').join('\n  ') + '\n> ' + fence().trimEnd().split('\n').join('\n> ') + '\n'
  const html = await toHtml(src)
  assert.equal((html.match(/<figure class="wm/g) || []).length, 4)
  const ids = [...html.matchAll(/id="(wm-\d+-[^"]*)"/g)].map((m) => m[1])
  assert.ok(ids.length >= 4)
  assert.equal(new Set(ids).size, ids.length)
  const blocks = ids.map((i) => Number(/^wm-(\d+)-/.exec(i)[1]))
  assert.deepEqual(blocks, [...blocks].sort((a, b) => a - b))
})

test('options.info is a default; the fence wins', async () => {
  const run = (s, o) => unified().use(remarkParse).use(remarkRehype).use(rehypeWiredown, o).use(rehypeStringify).process(s).then(String)
  assert.match(await run(fence(), { info: 'look=clean' }), /wm-look-clean/)
  assert.match(await run(fence('look=wire'), { info: 'look=clean' }), /wm-look-wire/)
})

test('caps at 50 blocks: the 51st is the too-many card', async () => {
  const html = await toHtml(Array.from({ length: 51 }, () => fence()).join('\n'))
  assert.equal((html.match(/<svg /g) || []).length > 0, true)
  assert.match(html, /Too many screens blocks/)
})
