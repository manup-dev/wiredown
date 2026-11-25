import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { pixelAt, frames } from './pixels.mjs'

const playBtn = (page) => page.getByRole('button', { name: 'Play', exact: true })
const dialog = (page) => page.getByRole('dialog', { name: 'Play the flow' })

test('Play opens the animation; Esc closes it and focus goes back', async ({ page }) => {
  await page.goto('/')
  await playBtn(page).focus()
  await playBtn(page).click()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toContainText('3 screens, loops every 7.8 s')
  const src = await page.locator('#play-img').getAttribute('src')
  expect(src).toMatch(/^data:image\/svg\+xml,/)
  expect(decodeURIComponent(src)).toContain('@keyframes')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('play-open')
})

test('Tab stays inside the Play panel', async ({ page }) => {
  await page.goto('/')
  await playBtn(page).click()
  await expect(dialog(page)).toBeVisible()
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('#play'))).toBe(true)
  }
  await page.locator('#play-close').focus()
  await page.keyboard.press('Shift+Tab')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('play-link')
})

test('P plays while the drawing has focus, not while typing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'wiredown source' }).press('End')
  await page.keyboard.press('p')
  await expect(dialog(page)).toBeHidden()
  await page.locator('#preview').focus()
  await page.keyboard.press('p')
  await expect(dialog(page)).toBeVisible()
})

test('the animated image changes over time', async ({ page }) => {
  await page.goto('/')
  await playBtn(page).click()
  const shots = await frames(page.locator('#play-img'), 8, 400)
  expect(new Set(shots.map((b) => b.toString('base64'))).size).toBeGreaterThan(1)
  // Light by default: the corner of the drawing is paper.
  expect(Math.min(...(await pixelAt(page, shots[0], 4, 4)))).toBeGreaterThan(200)
})

test('Download SVG and GIF; the GIF is a looping GIF89a', async ({ page }) => {
  await page.goto('/')
  await playBtn(page).click()
  const svgDl = page.waitForEvent('download')
  await dialog(page).getByRole('button', { name: 'Download SVG' }).click()
  const svg = await svgDl
  expect(svg.suggestedFilename()).toBe('analytics-dashboard.svg')
  expect(await readFile(await svg.path(), 'utf8')).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[\s\S]*@keyframes/)
  const gifDl = page.waitForEvent('download', { timeout: 60000 })
  await dialog(page).getByRole('button', { name: 'Download GIF' }).click()
  const gif = await gifDl
  expect(gif.suggestedFilename()).toBe('analytics-dashboard.gif')
  const bytes = await readFile(await gif.path())
  expect(bytes.subarray(0, 6).toString('latin1')).toBe('GIF89a')
  expect(bytes.readUInt16LE(6)).toBeLessThanOrEqual(720)
  expect(bytes.includes(Buffer.from('NETSCAPE2.0'))).toBe(true)
  await expect(page.locator('#toast')).toContainText('GIF saved')
})

test('a GIF can be cancelled', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Examples' }).selectOption('booking-app')
  await playBtn(page).click()
  await dialog(page).getByRole('button', { name: 'Download GIF' }).click()
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('#toast')).toContainText('GIF cancelled')
  await expect(page.locator('#play-progress')).toBeHidden()
  // The button works again at once, while the cancelled run is still unwinding.
  await expect(dialog(page).getByRole('button', { name: 'Download GIF' })).toBeFocused()
  const dl = page.waitForEvent('download', { timeout: 60000 })
  await dialog(page).getByRole('button', { name: 'Download GIF' }).click()
  expect((await dl).suggestedFilename()).toBe('booking-app.gif')
})

test('a message that comes after the panel closes is still shown', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await playBtn(page).click()
  await dialog(page).getByRole('button', { name: 'Download GIF' }).click()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(page.locator('#toast')).toBeVisible()
  await expect(page.locator('#toast')).toContainText('GIF cancelled')
  // A toast shown inside the panel goes back to the page when it closes.
  await playBtn(page).click()
  await dialog(page).getByRole('button', { name: 'Copy README snippet' }).click()
  await expect(page.locator('#play #toast')).toContainText('Snippet copied')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(page.locator('#toast')).toBeVisible()
  expect(await page.evaluate(() => document.getElementById('toast').parentElement === document.body)).toBe(true)
})

test('README snippet and the link that plays on open', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Examples' }).selectOption('chat-app')
  await playBtn(page).click()
  await dialog(page).getByRole('button', { name: 'Copy README snippet' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('![Chat app](./chat-app.svg)')
  await dialog(page).getByRole('button', { name: 'Copy link that plays' }).click()
  await expect(page.locator('#toast')).toContainText('Link copied')
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toMatch(/#v1:[A-Za-z0-9_-]+!play$/)
  const other = await context.newPage()
  await other.goto(url)
  await expect(dialog(other)).toBeVisible()
  await expect(other.getByRole('textbox', { name: 'wiredown source' })).toHaveValue(/@title "Chat app"/)
  // The plain Share link still opens without playing.
  await other.keyboard.press('Escape')
  await other.getByRole('button', { name: 'Share' }).click()
  const plain = await other.evaluate(() => navigator.clipboard.readText())
  expect(plain).not.toContain('!play')
  const third = await context.newPage()
  await third.goto(plain)
  await expect(third.getByRole('textbox', { name: 'wiredown source' })).toHaveValue(/Chat app/)
  await expect(dialog(third)).toBeHidden()
})

test('the Play panel fits a phone without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await playBtn(page).click()
  await expect(dialog(page)).toBeVisible()
  const fit = await page.evaluate(() => {
    const d = document.getElementById('play'), r = d.getBoundingClientRect(), img = document.getElementById('play-img').getBoundingClientRect()
    return { page: document.documentElement.scrollWidth <= innerWidth, panel: d.scrollWidth <= d.clientWidth, left: r.left, right: innerWidth - r.right, img: img.right <= r.right }
  })
  expect(fit).toEqual({ page: true, panel: true, left: 16, right: 16, img: true })
  for (const name of ['Download SVG', 'Download GIF', 'Copy README snippet', 'Copy link that plays']) await expect(dialog(page).getByRole('button', { name })).toBeInViewport()
})

test('Play is off while the block has errors', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'wiredown source' }).fill('screen a "A"\n  button "x" ->\n')
  await expect(playBtn(page)).toBeDisabled()
})
