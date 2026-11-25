// The README stays true to the code: every name a js block imports from wiredown exists, the
// animated picture at the top is exactly what `wiredown animate docs/hero.wiredown` writes, and the
// sign-in picture is exactly what the renderer draws for the contract example (both after the
// marker line the CLI writes first).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as core from '../src/index.js'
import * as exporters from '../src/export/index.js'
import * as fences from '../src/fences.js'
import * as icons from '../src/packs-define.js'
import { CONTRACT_EXAMPLE } from '../src/contract.js'
import { MARKER } from '../bin/marker.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const readme = read('README.md')

// browser/auto.js runs against document on import, so its names are read from the source.
const browserNames = [...read('browser/auto.js').matchAll(/^export (?:async )?(?:function|const|let) (\w+)/gm)].map((m) => m[1])
const modules = {
  wiredown: Object.keys(core),
  'wiredown/export': Object.keys(exporters),
  'wiredown/fences': Object.keys(fences),
  'wiredown/icons': Object.keys(icons),
  'wiredown/browser': browserNames,
}

const jsBlocks = [...readme.matchAll(/^```js\n([\s\S]*?)^```$/gm)].map((m) => m[1])
const imports = jsBlocks.flatMap((b) => [...b.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](wiredown(?:\/[\w.-]+)?)['"]/g)])

test('readme: js blocks import only names wiredown exports', () => {
  assert.ok(imports.length >= 2, 'expected the Install blocks to import from wiredown')
  for (const [, list, from] of imports) {
    assert.ok(from in modules, `README imports from an unknown subpath ${from}`)
    for (const raw of list.split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0]
      if (name) assert.ok(modules[from].includes(name), `${name} is not exported by ${from}`)
    }
  }
})

test('readme: no js block imports wiredown another way', () => {
  for (const b of jsBlocks) {
    for (const m of b.matchAll(/from\s*['"](wiredown(?:\/[^'"]*)?)['"]/g)) assert.ok(m[1] in modules, m[1])
    assert.ok(!/import\s+\w+\s*(,|from)\s*['"]?wiredown/.test(b), 'default imports from wiredown are not exports')
  }
})

test('readme: docs/example.svg is the first screen of CONTRACT_EXAMPLE as drawn', () => {
  const r = core.parseMock(CONTRACT_EXAMPLE, 'wiredown')
  assert.ok(r.ok)
  const svg = core.renderScreenSvg(r.mock, 0, 0)
  assert.ok(svg.startsWith('<svg '))
  assert.equal(read('docs/example.svg'), MARKER + svg, 'regenerate with: node bin/wiredown.js render <CONTRACT_EXAMPLE file>')
  assert.ok(readme.includes('](docs/example.svg)'))
  assert.ok(readme.includes('```wiredown\n' + CONTRACT_EXAMPLE + '\n```'), 'the README source block is CONTRACT_EXAMPLE')
})

test('readme: docs/hero.svg is docs/hero.wiredown as animated by the CLI', () => {
  const body = read('docs/hero.wiredown')
  assert.deepEqual(core.lintMock(body, 'wiredown'), [], 'the hero flow lints clean')
  const svg = exporters.renderFlowAnimation(body, 'wiredown')
  assert.ok(svg.startsWith('<svg '))
  assert.equal(read('docs/hero.svg'), MARKER + svg, 'regenerate with: node bin/wiredown.js animate docs/hero.wiredown --out docs/hero.svg')
  assert.ok(Buffer.byteLength(svg) < 120_000, 'the hero stays small enough for a README')
  assert.ok(exporters.flowPath(body, 'wiredown').steps.length >= 3, 'the hero shows a flow, not one screen')
  assert.ok(readme.includes('](docs/hero.svg)'))
  assert.ok(readme.indexOf('](docs/hero.svg)') < readme.indexOf('```wiredown'), 'the hero comes before the first example')
})
