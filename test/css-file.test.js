import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WIREMARK_CSS } from '../src/index.js'

test('wiremark.css is WIREMARK_CSS', () => {
  const file = readFileSync(new URL('../wiremark.css', import.meta.url), 'utf8')
  assert.equal(file, WIREMARK_CSS + '\n')
})
