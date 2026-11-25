// The README stays true to the code: every name a js block imports from wiremark exists, and the
// picture at the top is exactly what the renderer draws for the contract example.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as core from '../src/index.js'
import * as exporters from '../src/export/index.js'
import * as fences from '../src/fences.js'
import { CONTRACT_EXAMPLE } from '../src/contract.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const readme = read('README.md')

// browser/auto.js runs against document on import, so its names are read from the source.
const browserNames = [...read('browser/auto.js').matchAll(/^export (?:async )?(?:function|const|let) (\w+)/gm)].map((m) => m[1])
const modules = {
  wiremark: Object.keys(core),
  'wiremark/export': Object.keys(exporters),
  'wiremark/fences': Object.keys(fences),
  'wiremark/browser': browserNames,
}

const jsBlocks = [...readme.matchAll(/^```js\n([\s\S]*?)^```$/gm)].map((m) => m[1])
const imports = jsBlocks.flatMap((b) => [...b.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](wiremark(?:\/[\w.-]+)?)['"]/g)])

test('readme: js blocks import only names wiremark exports', () => {
  assert.ok(imports.length >= 2, 'expected the Install blocks to import from wiremark')
  for (const [, list, from] of imports) {
    assert.ok(from in modules, `README imports from an unknown subpath ${from}`)
    for (const raw of list.split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0]
      if (name) assert.ok(modules[from].includes(name), `${name} is not exported by ${from}`)
    }
  }
})

test('readme: no js block imports wiremark another way', () => {
  for (const b of jsBlocks) {
    for (const m of b.matchAll(/from\s*['"](wiremark(?:\/[^'"]*)?)['"]/g)) assert.ok(m[1] in modules, m[1])
    assert.ok(!/import\s+\w+\s*(,|from)\s*['"]?wiremark/.test(b), 'default imports from wiremark are not exports')
  }
})

test('readme: docs/example.svg is the first screen of CONTRACT_EXAMPLE as drawn', () => {
  const r = core.parseMock(CONTRACT_EXAMPLE, 'wiremark')
  assert.ok(r.ok)
  const svg = core.renderScreenSvg(r.mock, 0, 0)
  assert.ok(svg.startsWith('<svg '))
  assert.equal(read('docs/example.svg'), svg, 'regenerate with: node bin/wiremark.js render <CONTRACT_EXAMPLE file>')
  assert.ok(readme.includes('](docs/example.svg)'))
  assert.ok(readme.includes('```wiremark\n' + CONTRACT_EXAMPLE + '\n```'), 'the README source block is CONTRACT_EXAMPLE')
})
