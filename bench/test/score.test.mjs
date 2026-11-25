import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extractFence, scoreAnswer } from '../score.mjs'

const prompt = { id: 'p', minScreens: 2, kinds: ['button', 'input'], links: [['sign in', 'reset']] }
const good = 'screen a "Sign in"\n  input "Email"\n  link "Forgot?" -> b\n  button "Go"\nscreen b "Reset password"\n  input "Email"\n'

test('extracts the fence or a bare parseable answer', () => {
  assert.equal(extractFence('Here:\n```wiredown\n' + good + '```\nDone'), good)
  assert.equal(extractFence(good), good)
  assert.equal(extractFence('no mock here'), null)
})

test('scores checks', () => {
  assert.equal(scoreAnswer(prompt, good).pass, true)
  const r = scoreAnswer(prompt, 'screen a "Sign in"\n  gadget "x"\n')
  assert.equal(r.pass, false); assert.ok(r.errors >= 1); assert.equal(r.checks.minScreens, false)
})

test('a link to back or a missing screen never throws', () => {
  const r = scoreAnswer(prompt, 'screen a "Sign in"\n  link "Up" back -> back\n  link "x" -> nowhere\n')
  assert.equal(r.pass, false)
  assert.equal(scoreAnswer(prompt, null).pass, false)
})

test('every reference answer passes its own prompt and lints clean', () => {
  const prompts = JSON.parse(readFileSync(new URL('../prompts.json', import.meta.url), 'utf8'))
  assert.equal(prompts.length, 20)
  const files = readdirSync(new URL('../reference/', import.meta.url)).filter((f) => f.endsWith('.wiredown'))
  assert.equal(files.length, 20)
  for (const p of prompts) {
    const body = readFileSync(new URL(`../reference/${p.id}.wiredown`, import.meta.url), 'utf8')
    const s = scoreAnswer(p, body)
    assert.equal(s.pass, true, `${p.id}: ${JSON.stringify(s)}`)
    assert.equal(s.errors, 0)
  }
})

test('a self-linking screen does not satisfy a link check', () => {
  const body = 'screen a "Sign in and reset"\n  input "Email"\n  button "Go" -> a\n  link "x" -> a\nscreen b "Other"\n  input "E"\n'
  const r = scoreAnswer(prompt, body)
  assert.equal(r.checks.links, false)
})

test('a kind present only in a variant does not count', () => {
  const p = { id: 'q', minScreens: 1, kinds: ['button'], links: [] }
  const body = 'screen a "A"\n  text "x"\nvariant a2 of a "A busy"\n  #x hide\n'
  assert.equal(scoreAnswer(p, body).checks.kinds, false)
})
