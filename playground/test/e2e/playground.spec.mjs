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
