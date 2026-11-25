import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lintMock } from '../../src/index.js'
import { EXAMPLES } from '../examples.js'

test('every example is lint-clean and has a unique id', () => {
  assert.ok(EXAMPLES.length >= 4)
  assert.equal(new Set(EXAMPLES.map((e) => e.id)).size, EXAMPLES.length)
  for (const e of EXAMPLES) assert.deepEqual(lintMock(e.body).filter((p) => p.severity === 'error'), [], e.id)
})
