import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'

// Designer interface-size §2 / §3 (item interface-size-core): the stored
// choice in localStorage["photobooks.ui.scale.v1"] zooms `#root`, clamped to
// a 1280×720 app (D4); viewport sizes divide by the zoom, so no page scroll.

const KEY = 'photobooks.ui.scale.v1'

async function storeChoice(page: Page, value: string): Promise<void> {
  await page.addInitScript(
    ([k, v]) => {
      localStorage.setItem(k, v)
    },
    [KEY, value] as const,
  )
}

const rootZoom = (page: Page) =>
  page.evaluate(() => {
    const root = document.getElementById('root')
    if (!root) throw new Error('no #root')
    return getComputedStyle(root).zoom
  })

/** Visible Export site pill labels (the pill renders twice in the bar). */
const exportLabels = (page: Page) =>
  page.locator('.site-job-pill__label--narrow').filter({ visible: true })

/** No page-level scroll: the document is exactly the window. */
async function expectFitsWindow(page: Page): Promise<void> {
  const m = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    sw: document.documentElement.scrollWidth,
    ih: window.innerHeight,
    iw: window.innerWidth,
  }))
  expect({ h: m.sh, w: m.sw }).toEqual({ h: m.ih, w: m.iw })
}

test.describe('4K at 150 %', () => {
  test.use({ viewport: { width: 3840, height: 2160 } })

  test('welcome, editor and library zoom 1.5 and fill the window', async ({
    page,
  }) => {
    await storeChoice(page, '150')
    await page.goto('/')
    await expect(page.getByTestId('welcome-screen')).toBeVisible({
      timeout: 15_000,
    })
    expect(await rootZoom(page)).toBe('1.5')
    await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '150')
    await expectFitsWindow(page)

    await openLibraryBook(page)
    const shell = page.getByTestId('editor-shell')
    // The shell is one app viewport tall: 2160 / 1.5 app px = the window.
    expect(
      await shell.evaluate((el) => el.getBoundingClientRect().height),
    ).toBe(2160)
    await expectFitsWindow(page)
    // IS7: the Export site label follows the app width (2560 ≥ 1424).
    await expect(exportLabels(page).first()).toBeVisible()

    await page.getByTestId('go-library').click()
    await expect(page.getByTestId('library-screen')).toBeVisible()
    await expectFitsWindow(page)
  })
})

test.describe('clamp (D4)', () => {
  test('1920×970 with 150 shows 125 and keeps the choice', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 970 })
    await storeChoice(page, '150')
    await page.goto('/')
    await expect(page.getByTestId('welcome-screen')).toBeVisible({
      timeout: 15_000,
    })
    expect(await rootZoom(page)).toBe('1.25')
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('150')
    await expectFitsWindow(page)
  })

  test('1440×900 with 125 stays at 1', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await storeChoice(page, '125')
    await page.goto('/')
    await expect(page.getByTestId('welcome-screen')).toBeVisible({
      timeout: 15_000,
    })
    expect(await rootZoom(page)).toBe('1')
  })

  test('1700×1000 with 125 hides the Export site label (app 1360)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 1000 })
    await storeChoice(page, '125')
    await openLibraryBook(page)
    expect(await rootZoom(page)).toBe('1.25')
    await expect(page.getByTestId('export-site').first()).toBeVisible()
    await expect(exportLabels(page)).toHaveCount(0)
    await expectFitsWindow(page)
  })
})

test('no stored choice: zoom 1 (IS10)', async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  expect(await rootZoom(page)).toBe('1')
  await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '100')
})
