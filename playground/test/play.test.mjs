import { test } from 'node:test'
import assert from 'node:assert/strict'
import { framePlan, readmeSnippet, svgSize, GIF_FPS, GIF_MAX_WIDTH } from '../play.js'
import { renderFlowAnimation, renderFlowFrame, flowDuration } from '../../src/export/index.js'
import { EXAMPLES } from '../examples.js'

test('12 frames a second, at most 720 px wide', () => {
  assert.equal(GIF_FPS, 12)
  assert.equal(GIF_MAX_WIDTH, 720)
})

test('the frame plan covers the loop once; delays add up to it exactly', () => {
  const plan = framePlan(7.8)
  assert.equal(plan.length, Math.round(7.8 * 12))
  assert.equal(plan[0].at, 0)
  assert.ok(plan.at(-1).at < 7.8)
  assert.equal(plan.reduce((s, f) => s + f.delay, 0), 780)
  assert.ok(plan.every((f) => f.delay === 8 || f.delay === 9))
  assert.deepEqual(framePlan(0).map((f) => f.delay), [0])
})

test('README snippet points at the file beside it; brackets in the title are escaped', () => {
  assert.equal(readmeSnippet('Shop checkout', 'shop-checkout.svg'), '![Shop checkout](./shop-checkout.svg)')
  assert.equal(readmeSnippet('A [b]\nc', 'x.svg'), '![A \\[b\\] c](./x.svg)')
  assert.equal(readmeSnippet('', 'wiredown.svg'), '![Flow](./wiredown.svg)')
})

test('svgSize reads the animation and its frames; both have the same size', () => {
  const body = EXAMPLES[0].body
  const a = svgSize(renderFlowAnimation(body, 'wiredown'))
  const f = svgSize(renderFlowFrame(body, 'wiredown', { at: 1.2, theme: 'light' }))
  assert.ok(a && a.w > 0 && a.h > 0)
  assert.deepEqual(a, f)
  assert.ok(flowDuration(body, 'wiredown') > 0)
  assert.equal(svgSize('<p>'), null)
})
