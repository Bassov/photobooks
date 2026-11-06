import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { visibleCentres, white } from './fixtures/sitePagePaint'

// site-stand S5 + S6 (DEMO branch): demo 7's book page opens the shared
// reading room; on a phone portrait the room shows one page at a time.

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** the CSS reader (`?gl=0`): its page boxes are DOM; the GL reader's paint is in kit-site-stand-reader-gl */
async function openRoom(page: Page) {
  await page.goto('/uikit/#/full/site-demo-7?gl=0')
  await page.getByTestId('ss7-book').first().click()
  await expect(page.getByTestId('ss-open')).toBeFocused()
  await page.screenshot({
    path: test.info().outputPath('demo7-book-page.png'),
  })
  await page.getByTestId('ss-open').click()
  await expect(page.getByTestId('ss-reader-page')).toBeVisible()
}

test.describe('phone 390×844: single page', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('demo 7: one page 345.7 × 432 fills the width; Cover → Page 1 → Page 2', async ({
    page,
  }) => {
    await openRoom(page)
    const pager = page.getByTestId('ps-pager')
    const label = page.getByTestId('ss-label')
    await expect(page.getByTestId('ss-reader-page')).toHaveAttribute(
      'data-mode',
      'page',
    )
    // the cover opens on its own
    await expect(label).toHaveText(/^Page 1 of \d+$/)
    await expect(pager).toHaveAttribute('data-side', 'R')
    const reader = pager.getByTestId('ps-reader')
    await expect(reader).toHaveAttribute('data-view', '1')
    const pg = await box(reader.locator('.sd-pg').nth(1))
    expect(Math.abs(pg.width - 345.7)).toBeLessThanOrEqual(2)
    expect(Math.abs(pg.height - 432)).toBeLessThanOrEqual(2)
    expect(pg.height).toBeGreaterThanOrEqual(0.45 * 844)
    // centred, inside the screen
    expect(Math.abs(pg.x + pg.width / 2 - 195)).toBeLessThanOrEqual(1)

    await page.getByTestId('ss-prev').click()
    await expect(label).toHaveText('Cover')
    await expect(pager).toHaveAttribute('data-side', 'C')
    await expect(reader).toHaveAttribute('data-view', '0')
    await page.getByTestId('ss-next').click()
    await expect(label).toHaveText(/^Page 1 of \d+$/)
    await expect(reader).toHaveAttribute('data-view', '1')
    // the next leaf turns: the left page of spread 1, centred
    await page.getByTestId('ss-next').click()
    await expect(label).toHaveText(/^Page 2 of \d+$/)
    await expect(pager).toHaveAttribute('data-side', 'L')
    await expect(reader).toHaveAttribute('data-view', '2')
    const left = await box(reader.locator('.sd-pg').nth(0))
    expect(Math.abs(left.x + left.width / 2 - 195)).toBeLessThanOrEqual(1)
    // a tap on the right 40 % pans to page 3 of the same spread
    const pb = await box(pager)
    await pager.click({ position: { x: pb.width * 0.85, y: pb.height / 2 } })
    await expect(label).toHaveText(/^Page 3 of \d+$/)
    await expect(reader).toHaveAttribute('data-view', '2')
    await expect(pager).toHaveCSS('touch-action', 'pan-y')

    const centres = await visibleCentres(pager)
    expect(centres.length).toBeGreaterThan(0)
    for (const c of centres) expect(white(c)).toBe(false)
    await page.screenshot({
      path: test.info().outputPath('demo7-390-room.png'),
    })
    test.info().annotations.push({
      type: 'paint',
      description: `page ${pg.width.toFixed(1)}×${pg.height.toFixed(1)}; centre ${JSON.stringify(centres)}`,
    })
  })
})

test.describe('desktop 1440×900: the reading room', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('demo 7: the room book is 1157 × 723; Esc closes once and focus returns to Open the book', async ({
    page,
  }) => {
    await openRoom(page)
    await page.screenshot({
      path: test.info().outputPath('demo7-1440-room-open.png'),
    })
    const reader = page.getByTestId('ps-reader')
    await expect(reader).toHaveAttribute('data-view', '1')
    const r = await box(reader)
    expect(Math.abs(r.width - 1157)).toBeLessThanOrEqual(2)
    expect(Math.abs(r.height - 723)).toBeLessThanOrEqual(2)
    await expect(reader).toBeFocused()

    await page.getByTestId('ss-next').click()
    await expect(reader).toHaveAttribute('data-view', '2')
    await expect(page.getByTestId('ps-leaf')).toHaveCount(0)
    const centres = await visibleCentres(reader)
    expect(centres.length).toBeGreaterThan(0)
    for (const c of centres) expect(white(c)).toBe(false)
    await page.screenshot({
      path: test.info().outputPath('demo7-1440-room.png'),
    })
    test.info().annotations.push({
      type: 'paint',
      description: `room ${r.width.toFixed(1)}×${r.height.toFixed(1)}; centre ${JSON.stringify(centres)}`,
    })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('ss-reader-page')).toHaveCount(0)
    // one press: the book page stays
    await expect(page.getByTestId('ss-book')).toBeVisible()
    await expect(page.getByTestId('ss-open')).toBeFocused()
    await page.screenshot({
      path: test.info().outputPath('demo7-1440-book.png'),
    })
  })
})
