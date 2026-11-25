import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

test('draws a figure without innerHTML on the host element', async () => {
  const dom = new JSDOM('<!doctype html><div id="h"></div>')
  Object.assign(globalThis, { document: dom.window.document, DOMParser: dom.window.DOMParser })
  const { drawInto } = await import('../src/render.js')
  const el = document.getElementById('h')
  drawInto(el, 'button "Go"', 'wiremark', 'clean', 0)
  assert.ok(el.querySelector('figure.wm svg'))
})

test('the look setting is used unless the fence says otherwise', async () => {
  const { lookInfo } = await import('../src/render.js')
  assert.equal(lookInfo('wiremark', 'clean'), 'wiremark look=clean')
  assert.equal(lookInfo('wiremark look=wire', 'clean'), 'wiremark look=wire')
})
