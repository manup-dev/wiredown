// Runs in the "forced-media" project only: Chromium launched with --force-prefers-reduced-motion and
// a dark preferred colour scheme (--force-dark-mode alone does not change prefers-color-scheme in
// headless Chromium; the blink setting does), because page emulation does not reach an SVG shown
// as <img>. The context is made with emulation off (null), so the launch flags decide.
import { test, expect } from '@playwright/test'
import { pixelAt, frames } from './pixels.mjs'

test('with reduced motion the animation holds its first screen; in dark mode it is dark', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, colorScheme: null, reducedMotion: null })
  const page = await context.newPage()
  await page.goto('/')
  expect(await page.evaluate(() => [matchMedia('(prefers-reduced-motion: reduce)').matches, matchMedia('(prefers-color-scheme: dark)').matches])).toEqual([true, true])
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('#play-note')).toBeVisible()
  const shots = await frames(page.locator('#play-img'), 8, 400)
  expect(new Set(shots.map((b) => b.toString('base64'))).size).toBe(1)
  expect(Math.max(...(await pixelAt(page, shots[0], 4, 4)))).toBeLessThan(60)
  await context.close()
})
