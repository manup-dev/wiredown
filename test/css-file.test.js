import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WIREDOWN_CSS } from '../src/index.js'

test('wiredown.css is WIREDOWN_CSS', () => {
  const file = readFileSync(new URL('../wiredown.css', import.meta.url), 'utf8')
  assert.equal(file, WIREDOWN_CSS + '\n')
})
