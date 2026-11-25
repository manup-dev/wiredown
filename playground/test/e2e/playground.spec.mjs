import { test, expect } from '@playwright/test'

test('type, see the drawing and the lint list', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'wiremark source' })
  await editor.fill('screen a "A"\n  button "Go" primary\n')
  await expect(page.locator('#preview figure.wm svg')).toHaveCount(1)
  await editor.fill('screen a "A"\n  gadget "x"\n')
  await expect(page.getByRole('list', { name: 'Problems' })).toContainText('unknown_kind')
})

test('share link round trip', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('textbox', { name: 'wiremark source' }).fill('screen s "Shared"\n  h1 "Hello"\n')
  await page.getByRole('button', { name: 'Share' }).click()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toMatch(/#v1:/)
  const other = await context.newPage()
  await other.goto(url)
  await expect(other.getByRole('textbox', { name: 'wiremark source' })).toHaveValue(/Hello/)
})

test('examples, export tab and AI prompt', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Examples' }).selectOption('checkout')
  await expect(page.locator('#preview figure.wm')).toHaveCount(1)
  await page.getByRole('tab', { name: 'OpenUI' }).click()
  await expect(page.locator('#export-output')).toContainText('root = ')
  await page.getByRole('button', { name: 'Copy prompt for your AI' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Describe your screens:')
})

test('fits a phone screen without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('Escape then Tab or Shift+Tab leaves the editor without changing the text', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'wiremark source' })
  await editor.fill('screen a "A"\n  h1 "x"\n')
  for (const key of ['Tab', 'Shift+Tab']) {
    await editor.focus()
    await editor.press('End')
    await page.keyboard.press('Escape')
    await page.keyboard.press(key)
    expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('source')
    await expect(editor).toHaveValue('screen a "A"\n  h1 "x"\n')
  }
})

test('the live problems list is replaced only when its text changes', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'wiremark source' })
  await editor.fill('screen a "A"\n  h1 "x"\n')
  await expect(page.locator('#problems')).toContainText('No problems')
  await page.evaluate(() => { document.querySelector('#problems li').dataset.mark = 'kept' })
  await editor.press('End')
  await editor.type('  h2 "y"\n')
  await page.waitForTimeout(400)
  await expect(page.locator('#problems li[data-mark=kept]')).toHaveCount(1)
  await editor.type('  gadget "z"\n')
  await expect(page.locator('#problems')).toContainText('unknown_kind')
  await expect(page.locator('#problems li[data-mark=kept]')).toHaveCount(0)
})

test('clicking a drawn element selects its line; the caret lights its element', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'wiremark source' })
  await editor.fill('screen a "A"\n  navbar "Top"\n  button "Go" primary icon=plus -> b\n\nscreen b "B"\n  h1 "Done"\n')
  await page.locator('#preview .wm-screen[data-wm-screen=a] svg [data-wm-el=button-go]').click()
  expect(await page.evaluate(() => { const s = document.getElementById('source'); return s.value.slice(s.selectionStart, s.selectionEnd) })).toBe('button "Go" primary icon=plus -> b')
  await expect(page.locator('.wm-chip')).toContainText('Line 3')
  await page.locator('.wm-chip button.go').click()
  await expect(page.locator('.wm-chip')).toBeHidden()
  await editor.focus()
  await page.evaluate(() => { const s = document.getElementById('source'); const i = s.value.indexOf('h1'); s.setSelectionRange(i, i) })
  await expect(page.locator('.wm-sel')).toBeVisible()
})

test('screens fold from their caption, and a chip jumps back to one', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'wiremark source' }).fill('screen a "A"\n  h1 "x"\n\nscreen b "B"\n  h1 "y"\n')
  await page.locator('.wm-screen[data-wm-screen=b] > .wm-cap').click()
  await expect(page.locator('.wm-screen[data-wm-screen=b] svg')).toBeHidden()
  await expect(page.locator('.wm-screen[data-wm-screen=b] > .wm-cap')).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('navigation', { name: 'Jump to a screen' }).getByRole('button', { name: 'B' }).click()
  await expect(page.locator('.wm-screen[data-wm-screen=b] svg')).toBeVisible()
  await page.getByRole('button', { name: 'Fold all' }).click()
  await expect(page.locator('.wm-screen.is-folded')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Unfold all' })).toBeVisible()
})

test('the source hides and the split resizes, and both are kept', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')
  const split = page.getByRole('separator', { name: 'Resize the source and the drawing' })
  await split.focus()
  await page.keyboard.press('End')
  await expect(split).toHaveAttribute('aria-valuenow', '70')
  await page.getByRole('button', { name: 'Hide', exact: true }).first().click()
  await expect(page.locator('#source-pane')).toBeHidden()
  await page.reload()
  await expect(page.locator('#source-pane')).toBeHidden()
  await page.getByRole('button', { name: 'Show source' }).click()
  await expect(page.locator('#source-pane')).toBeVisible()
  await expect(split).toHaveAttribute('aria-valuenow', '70')
})

test('the open export tab folds the code away; long problem lists fold', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'wiremark source' }).fill('screen a "A"\n  gadget "1"\n  gadget "2"\n  gadget "3"\n  gadget "4"\n')
  await expect(page.locator('#problems li:visible')).toHaveCount(2)
  await page.getByRole('button', { name: /Show \d+ more/ }).click()
  await expect(page.locator('#problems li:visible')).toHaveCount(4)
  await page.getByRole('tab', { name: 'HTML' }).click()
  await expect(page.locator('#export')).toBeVisible()
  await page.getByRole('tab', { name: 'HTML' }).click()
  await expect(page.locator('#export')).toBeHidden()
})

test('the gallery has the flows', async ({ page }) => {
  await page.goto('/')
  for (const id of ['dashboard-states', 'team-invite', 'upgrade-paywall', 'password-reset', 'mobile-onboarding', 'support-inbox']) {
    await page.getByRole('combobox', { name: 'Examples' }).selectOption(id)
    await expect(page.locator('#problems')).toContainText('No problems')
  }
})
