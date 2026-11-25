import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lintMock, parseMock, WM_LIMITS } from '../../src/index.js'
import { flowPath, renderFlowAnimation } from '../../src/export/index.js'
import { defineIconPack } from '../../src/packs-define.js'
import lucideIcons from '../../integrations/icons-lucide/icons.js'
import { EXAMPLES } from '../examples.js'

// The playground loads Lucide when a block names it; the tests hand it over the same way.
const lucide = defineIconPack({ id: 'lucide', name: 'Lucide', version: 'test', license: 'ISC', icons: lucideIcons })
const SHOWCASE = ['saas-dashboard', 'shop-checkout', 'mobile-onboarding', 'chat-app', 'social-feed', 'booking-app']

test('every example is lint-clean and has a unique id', () => {
  assert.ok(EXAMPLES.length >= 4)
  assert.equal(new Set(EXAMPLES.map((e) => e.id)).size, EXAMPLES.length)
  for (const e of EXAMPLES) assert.deepEqual(lintMock(e.body).filter((p) => p.severity === 'error'), [], e.id)
})

test('the showcase: six flows first, the dashboard is the default', () => {
  assert.deepEqual(EXAMPLES.slice(0, 6).map((e) => e.id), SHOWCASE)
  assert.ok(EXAMPLES.slice(0, 6).every((e) => e.group === 'Showcase'))
})

for (const id of SHOWCASE) {
  test(`showcase ${id}: no problems at all, 3+ screens, a 3+ step flow, links, icons, typed images, motion`, () => {
    const { body } = EXAMPLES.find((e) => e.id === id)
    assert.deepEqual(lintMock(body, 'wiredown', { icons: [lucide] }), [])
    assert.ok(body.length <= WM_LIMITS.body && body.split('\n').length <= WM_LIMITS.lines)
    const r = parseMock(body, 'wiredown')
    assert.ok(r.ok)
    assert.ok(r.mock.screens.length >= 3, 'screens')
    const path = flowPath(body, 'wiredown')
    assert.ok(path.ok && path.steps.length >= 3, 'flow steps')
    // Every screen is in the walkthrough, and every step after the first is reached by a tap.
    assert.deepEqual(new Set(path.steps.map((s) => s.screenId)), new Set(r.mock.screens.map((s) => s.id)))
    assert.ok(path.steps.slice(1).every((s) => s.via), 'every step is a tap')
    assert.match(body, /icon[= ]/)
    assert.match(body, / type=(photo|chart|map|video|illustration|logo|avatar)\b/)
    assert.match(body, /^@motion (slide|fade|push|sheet|zoom)$/m)
    assert.doesNotMatch(renderFlowAnimation(body, 'wiredown', { icons: [lucide] }), /class="wm-error"/)
  })
}

test('the showcase between them: one uses @icons lucide, one enters a screen as a sheet', () => {
  const bodies = SHOWCASE.map((id) => EXAMPLES.find((e) => e.id === id).body)
  assert.ok(bodies.some((b) => /^@icons lucide$/m.test(b)))
  assert.ok(bodies.some((b) => / motion=sheet\b/.test(b)))
})
