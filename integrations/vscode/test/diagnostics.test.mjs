import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diagnosticsFor } from '../src/diagnostics.mjs'

test('markdown: fence problems at their file position, 0-based', () => {
  const d = diagnosticsFor('# T\n\n```wiremark\nscreen a "A"\n  gadget "x"\n```\n', 'markdown')
  assert.equal(d.length, 1)
  assert.equal(d[0].code, 'unknown_kind')
  assert.equal(d[0].line0, 4)
  assert.equal(d[0].severity, 'error')
})

test('.wiremark file: whole text; clean text has none', () => {
  assert.equal(diagnosticsFor('button "Go"\n', 'wiremark').length, 0)
  assert.equal(diagnosticsFor('gadget "x"\n', 'wiremark')[0].line0, 0)
})

test('an info-string warning lands on the fence line', () => {
  const d = diagnosticsFor('```wiremark lok=clean\nbutton "x"\n```\n', 'markdown')
  assert.equal(d[0].line0, 0); assert.equal(d[0].severity, 'warning')
})
