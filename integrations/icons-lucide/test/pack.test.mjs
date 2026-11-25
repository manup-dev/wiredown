import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderMockBlock, lintMock, isIconPack, iconPacksKey, pathFromD } from 'wiredown'
import pack from '../index.js'

const MIN = { lucide: 1000, tabler: 1000, heroicons: 200 }['lucide']
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('lucide pack loads and is a wiredown pack', () => {
  assert.ok(isIconPack(pack))
  assert.equal(pack.id, 'lucide')
  assert.equal(pack.version, pkg.version)
  assert.ok(Object.keys(pack.icons).length > MIN, String(Object.keys(pack.icons).length))
  assert.equal(iconPacksKey([pack]), 'lucide@' + pkg.version)
})

test('lucide icons draw by prefix and by header, and lint clean', () => {
  const name = Object.keys(pack.icons)[0]
  const prefixed = `screen a "A"\n  icon "lucide:${name}"\n`
  const headed = `@icons lucide\nscreen a "A"\n  icon "${name}"\n`
  const bare = renderMockBlock(`screen a "A"\n  icon "${name}"\n`, 'wiredown', { icons: [pack] })
  const a = renderMockBlock(prefixed, 'wiredown', { icons: [pack] })
  const b = renderMockBlock(headed, 'wiredown', { icons: [pack] })
  assert.ok(a.includes('<path'), 'prefixed draws a path')
  const paths = (html) => [...html.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(paths(a), paths(b))
  assert.match(paths(a)[0], /^M/, 'the path starts at an absolute point')
  assert.ok(bare.includes('<svg'))
  assert.deepEqual(lintMock(prefixed, 'wiredown', { icons: [pack] }), [])
  assert.deepEqual(lintMock(headed, 'wiredown', { icons: [pack] }), [])
  assert.ok(lintMock(headed, 'wiredown').some((p) => p.code === 'icon_pack_missing'))
})

// Checked by hand against the upstream svg: each element starts at its own absolute point.
test('lucide: an icon of several elements draws each from its own start', () => {
  assert.equal(pathFromD(pack.icons['circle-check'], 0, 0, 24), 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M16 9l-5.5 5.5L8 12')
})
