import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const at = (p) => new URL('../' + p.replace(/^\.\//, ''), import.meta.url)

test('package is publishable and its paths exist', () => {
  assert.equal(pkg.private, undefined)
  assert.equal(pkg.license, 'MIT')
  // No sideEffects field: browser/auto.js renders on import, and the field changes how a host's bundler splits chunks.
  assert.equal(pkg.sideEffects, undefined)
  assert.equal(pkg.engines.node, '>=20')
  assert.deepEqual(Object.keys(pkg.exports), ['.', './export', './fences', './browser', './wiredown.css', './package.json'])
  for (const v of Object.values(pkg.exports)) {
    for (const p of typeof v === 'string' ? [v] : Object.values(v)) assert.ok(existsSync(at(p)), p)
  }
  assert.ok(existsSync(at(pkg.bin.wiredown)))
  assert.deepEqual(pkg.files, ['src', 'bin', 'browser', 'wiredown.css', 'LICENSE', 'README.md'])
})

test('index.js re-exports nothing from the new subpaths', () => {
  const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  assert.ok(!/export\/|fences/.test(index))
})
