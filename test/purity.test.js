import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') || p.endsWith('.mjs') ? [p] : []
  })
const files = [...walk(join(root, 'src')), ...walk(join(root, 'scripts'))]

test('wiredown imports only itself (node: only in scripts/)', () => {
  assert.ok(files.length > 5)
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    const specs = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1])
    for (const s of specs) {
      const ok = s.startsWith('./') || s.startsWith('../') || (s.startsWith('node:') && f.includes(`${join(root, 'scripts')}`))
      assert.ok(ok, `${f} imports ${s}`)
    }
  }
})

test('no wiredown source file is over 300 code lines', () => {
  for (const f of files) {
    let inBlock = false
    let n = 0
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim()
      if (inBlock) { if (t.includes('*/')) inBlock = false; continue }
      if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; continue }
      if (t === '' || t.startsWith('//')) continue
      n++
    }
    assert.ok(n <= 300, `${f} has ${n} code lines`)
  }
})
