import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { toHTML } from '../src/export/index.js'

const login = readFileSync(new URL('./fixtures/login.wiremark', import.meta.url), 'utf8')
const kinds = readFileSync(new URL('./fixtures/kinds.wiremark', import.meta.url), 'utf8')

test('one file per screen and variant, semantic tags', () => {
  const r = toHTML(login)
  assert.equal(r.ok, true)
  assert.ok(r.files.length >= 2)
  const first = r.files[0]
  assert.match(first.text, /<main class="wm-screen" id="login" aria-label="Sign in">/)
  assert.match(first.text, /<label>Email <input type="text" placeholder="you@company.com"><\/label>/)
  assert.match(first.text, /<button type="button" class="primary">Sign in<\/button>/)
  assert.match(first.text, /<a href="#reset">Forgot password\?<\/a>/)
  assert.ok(first.notes.includes('Disabled until both fields are filled'))
  const v = r.files.find((f) => f.variant)
  assert.match(v.text, /class="error">That password is not right/)
})

test('a block with errors is refused with the lint list', () => {
  const r = toHTML(kinds)
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.code === 'unknown_kind'))
})

test('author text is escaped and never becomes markup', () => {
  const r = toHTML('button "<script>alert(1)</script>" note="a&b"')
  assert.equal(r.ok, true)
  assert.ok(!r.files[0].text.includes('<script>'))
  assert.match(r.files[0].text, /&lt;script&gt;/)
})

test('deterministic and linear', () => {
  assert.equal(JSON.stringify(toHTML(login)), JSON.stringify(toHTML(login)))
  const big = 'stack\n' + '  button "x"\n'.repeat(1400)
  const t = performance.now(); toHTML(big); assert.ok(performance.now() - t < 200)
})
