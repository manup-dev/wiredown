// Pixels from Playwright screenshots, decoded by the page itself (a PNG, so no media query applies).
export async function pixelAt(page, png, x, y) {
  return page.evaluate(async ({ b64, x, y }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height
    const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0)
    return [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)]
  }, { b64: png.toString('base64'), x, y })
}

/** `n` screenshots of `locator`, `gap` ms apart. */
export async function frames(locator, n, gap) {
  const out = []
  for (let i = 0; i < n; i++) {
    if (i) await locator.page().waitForTimeout(gap)
    out.push(await locator.screenshot({ animations: 'allow' }))
  }
  return out
}
