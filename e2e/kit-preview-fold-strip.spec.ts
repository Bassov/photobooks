import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// kit-preview-fold-strip (Designer page-numbers kit review, 2026-11-06): the
// kit `#/demo` Preview showed a grey strip at the left edge of Page 1 (the
// right page of the first slide): the centre fold hairline left at the edge.
// Since personal-site K2 the Preview is the reading room and its Fullscreen
// lightbox draws the slides: single pages paint paper up to their edges,
// two-page spreads keep the centre fold.

const PAPER = [255, 255, 255, 255]
const EDGE = [0, 1, 2, 3, 4]

const demo = (page: Page) => page.getByTestId('demo')

async function openPreview(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await page.getByTestId('demo-preview').click()
  await expect(page.getByTestId('site-preview')).toBeVisible()
}

async function slide(page: Page, key: string, label: RegExp) {
  await page.keyboard.press(key)
  await expect(page.getByTestId('site-fullscreen-indicator')).toHaveText(label)
}

/** RGBA of the given columns (CSS px from the box's left) at three rows: top margin, middle, bottom margin. */
async function columns(box: Locator, xs: number[]) {
  const b = await box.boundingBox()
  if (b === null) throw new Error('not visible')
  const ys = [2, Math.round(b.height / 2), Math.floor(b.height) - 3]
  return pixelsAt(
    box,
    ys.flatMap((y) => xs.map((x) => ({ x, y }))),
  )
}

test.describe('kit Preview single-page slides', () => {
  test('Page 1 left edge and the last page right edge are paper; a two-page slide keeps the fold', async ({
    page,
  }) => {
    await openPreview(page)
    await page.getByTestId('site-fullscreen-btn').click()
    await expect(page.getByTestId('site-fullscreen-indicator')).toHaveText(
      'Page 1',
    )
    // the slide box (the full spread width) centred in the lightbox layer
    const spread = page
      .getByTestId('site-fullscreen-book')
      .locator(':scope > div')
    const w = (await spread.boundingBox())?.width ?? 0
    // the right page starts at the spread's centre
    const first = await columns(
      spread,
      EDGE.map((k) => w / 2 + k),
    )
    expect(first).toEqual(first.map(() => PAPER))

    await slide(page, 'ArrowRight', /^Pages 2–3$/)
    // the fold shade (black / 6 % at the centre), top margin
    const [fold = []] = await pixelsAt(spread, [{ x: w / 2, y: 2 }])
    expect(fold.slice(0, 3).every((v) => v < 250)).toBe(true)

    await slide(page, 'End', /^Page \d+$/)
    // the left page ends at the spread's centre; a new book's last page is
    // one empty placeholder frame, so its edge matches the page 8 px inside
    const xs = [...EDGE, 8].map((k) => w / 2 - 1 - k)
    const last = await columns(spread, xs)
    const inner = last.filter((_, k) => k % xs.length === EDGE.length)
    expect(last).toEqual(inner.flatMap((c) => xs.map(() => c)))
  })

  test('the Preview room paints the open book under the bar', async ({
    page,
  }) => {
    await openPreview(page)
    const room = page.getByTestId('site-room')
    await expect(room).toHaveAttribute('data-view', '1')
    const bar = await page.getByTestId('site-preview-bar').boundingBox()
    const b = await room.boundingBox()
    expect(b?.y ?? 0).toBeGreaterThanOrEqual((bar?.y ?? 0) + (bar?.height ?? 0))
    // the right page (Page 1) is paper, not the room's #f4f3f0
    const [right = []] = await pixelsAt(room, [
      { x: (b?.width ?? 0) * 0.75, y: (b?.height ?? 0) / 2 },
    ])
    expect(right.slice(0, 3)).not.toEqual([244, 243, 240])
  })
})
