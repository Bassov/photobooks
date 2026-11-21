import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'

// Round 33 Musts M131, M132 (Designer walkthrough-ux-review p2). Kit values at
// 1440 × 900 from the rendered kit `uikit#/demo`:
// M131 library empty sample card "AUTUMN · 2025": line-height 15px (kit body
//     inherits preflight's 1.5 at 10px), text top 354.59 (prod was `normal`,
//     12px, 353.59).
// M132 Create book Title: kit input has no border and px-3, text starts at
//     x 526; prod keeps its field-coloured 1px border, so 1 + 11 = 12. Field box
//     and the ink focus outline (M34) unchanged.

const POS = 0.25
// Field box as before this change (border-box, width 100%, height 36).
const FIELD_WIDTH = 412

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

async function openEmptyLibrary(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api?.seedHomeRecentsForTests) {
      throw new Error('missing api')
    }
    await api.seedHomeRecentsForTests(0)
  })
  await expect(page.getByTestId('library-empty')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

/** Top of the painted text run (Range rect), as the Designer quotes it. */
async function textTop(loc: Locator): Promise<number> {
  return loc.evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return range.getBoundingClientRect().top
  })
}

/** Content-box left of an input: where its text starts. */
async function inputTextX(loc: Locator): Promise<number> {
  return loc.evaluate((el) => {
    const cs = getComputedStyle(el)
    return (
      el.getBoundingClientRect().left +
      Number.parseFloat(cs.borderLeftWidth) +
      Number.parseFloat(cs.paddingLeft)
    )
  })
}

test('M131 sample card sub line: 15px line-height, kit text top', async ({
  page,
}) => {
  await openEmptyLibrary(page)
  const sub = page.getByTestId('example-book').getByTestId('book-object-sub')
  await expect(sub).toHaveText('Autumn · 2025')
  await expect(sub).toHaveCSS('line-height', '15px')
  expect(Math.abs((await textTop(sub)) - 354.59)).toBeLessThanOrEqual(POS)
})

test('M132 Create book Title: kit text start, same box and focus outline', async ({
  page,
}) => {
  await openEmptyLibrary(page)
  await page.getByTestId('new-book').first().click()
  await expect(page.getByTestId('create-book-dialog')).toBeVisible()
  const title = page.getByTestId('create-title')
  await expect(title).toBeFocused()

  expect(Math.abs((await inputTextX(title)) - 526)).toBeLessThanOrEqual(POS)
  const b = await title.boundingBox()
  expect(b).not.toBeNull()
  expect(b?.height).toBeCloseTo(36, 0)
  expect(b?.width).toBeCloseTo(FIELD_WIDTH, 0)
  await expect(title).toHaveCSS('border-left-width', '1px')
  await expect(title).toHaveCSS('padding-left', '11px')

  // Prod's app-wide ink focus outline (Designer Decided, M34).
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(title).toBeFocused()
  await expect(title).toHaveCSS('outline-style', 'solid')
  await expect(title).toHaveCSS('outline-width', '2px')
  await expect(title).toHaveCSS('outline-color', 'rgb(83, 81, 82)')
})
