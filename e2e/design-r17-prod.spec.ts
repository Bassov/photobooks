import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'

// Owner rule: every Designer item is a Must; round 17, Designer parity r16
// 2026-11-03 (M93). Kit MiniSpread (uikit/src/sandbox/chrome.tsx) draws the
// list card centre line as `w-px bg-black/10`; prod drew
// `color-mix(foreground 28%)` = rgb(57, 55, 56) / 0.28. The canvas fold
// keeps the r11 kit gradient (e2e/design-r11-canvas.spec.ts M73).

const KIT = {
  cut: 'rgba(0, 0, 0, 0.1)',
  cutWidth: '1px',
  fold: 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, oklab(0 0 0 / 0.06) 50%, rgba(0, 0, 0, 0) 100%)',
} as const

test.describe('design-r17 M93 spread-list centre line', () => {
  test('list card cut is the kit 10 % black hairline; the canvas fold is unchanged', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    const row = page.getByTestId(/^spread-list-item-/).nth(1)
    await row.click()

    const cut = row.locator('.spread-page-cut')
    await expect(cut).toHaveCount(1)
    const read = await cut.evaluate((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      width: getComputedStyle(el).width,
    }))
    expect(read.bg).toBe(KIT.cut)
    expect(read.width).toBe(KIT.cutWidth)

    const fold = page.getByTestId('spread-page-cut').first()
    await expect(fold).toBeVisible()
    const image = await fold.evaluate(
      (el) => getComputedStyle(el).backgroundImage,
    )
    expect(image).toBe(KIT.fold)
  })
})
