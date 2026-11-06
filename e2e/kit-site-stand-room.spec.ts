import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { visibleCentres, white } from './fixtures/sitePagePaint'

// site-stand S5 + S6, site-stand-v2 S (DEMO branch): a demo 6 book opens the
// shared reading room; on a phone portrait the room reads by spreads and the
// book never moves (site-stand-v4 D20).

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** the CSS reader (`?gl=0`): its page boxes are DOM; the GL reader's paint is in kit-site-stand-reader-gl */
async function openRoom(page: Page) {
  await page.goto('/uikit/#/full/site-demo-6?gl=0')
  await page.getByTestId('ss6-book').locator('visible=true').first().click()
  await expect(page.getByTestId('ss-reader-page')).toBeVisible()
}

type Rect = [number, number, number, number]
interface Sampler {
  rects: Rect[]
  raf: number
}

/** every rAF frame: the ps-reader rect, until `stopRects` */
const startRects = (page: Page) =>
  page.evaluate(() => {
    const s: Sampler = { rects: [], raf: 0 }
    ;(window as unknown as { __rects: Sampler }).__rects = s
    const tick = () => {
      const r = document
        .querySelector('[data-testid="ps-reader"]')
        ?.getBoundingClientRect()
      if (r) s.rects.push([r.x, r.y, r.width, r.height])
      s.raf = requestAnimationFrame(tick)
    }
    tick()
  })
const stopRects = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __rects: Sampler }).__rects
    cancelAnimationFrame(s.raf)
    return s.rects
  })

/** a one-finger swipe through the browser's touch input (pointer events + touch-action) */
async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const cdp = await page.context().newCDPSession(page)
  const at = (x: number, y: number) => [{ x, y, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: at(from.x, from.y),
  })
  for (let i = 1; i <= 12; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: at(
        from.x + ((to.x - from.x) * i) / 12,
        from.y + ((to.y - from.y) * i) / 12,
      ),
    })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await cdp.detach()
}

test.describe('phone 390×844: spreads', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('demo 6 lake-trip: the whole spread 358 × 223.75 at x 16; the book never moves; swipes turn one leaf', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto('/uikit/#/full/site-demo-6?books=6&book=lake-trip&gl=0')
    const room = page.getByTestId('ss-reader-page')
    await expect(room).toHaveAttribute('data-mode', 'port')
    const reader = room.getByTestId('ps-reader')
    const label = room.getByTestId('ss-label')
    await expect(reader).toHaveAttribute('data-view', '1')
    await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
    await expect(page.getByTestId('ps-pager')).toHaveCount(0)
    await expect(reader).toHaveCSS('touch-action', 'pan-y')
    const r = await box(reader)
    expect(Math.abs(r.width - 358)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(r.height - 223.75)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(r.x - 16)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(r.y - 274.1)).toBeLessThanOrEqual(0.5)
    await expect(label).toHaveText('Page 1 of 22')

    // Next × 3: one leaf each; the reader rect is the same at every view and on every frame of the turns
    await startRects(page)
    for (const want of [
      'Pages 2–3 of 22',
      'Pages 4–5 of 22',
      'Pages 6–7 of 22',
    ]) {
      await room.getByTestId('ss-next').click()
      await expect(label).toHaveText(want)
      await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
      const v = await box(reader)
      expect(Math.abs(v.x - r.x)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(v.y - r.y)).toBeLessThanOrEqual(0.5)
    }
    const rects = await stopRects(page)
    expect(rects.length).toBeGreaterThan(10)
    const off = rects.filter(
      ([x, y, w, h]) =>
        Math.abs(x - r.x) > 0.5 ||
        Math.abs(y - r.y) > 0.5 ||
        Math.abs(w - r.width) > 0.5 ||
        Math.abs(h - r.height) > 0.5,
    )
    expect(off).toEqual([])
    await expect(reader).toHaveAttribute('data-view', '4')

    // a photo page of the spread paints
    const centres = await visibleCentres(reader)
    expect(centres.length).toBeGreaterThan(0)
    for (const c of centres) expect(white(c)).toBe(false)
    await page.screenshot({
      path: test.info().outputPath('demo6-390-room.png'),
    })

    // a horizontal swipe 300 → 80 turns one leaf
    const y = r.y + r.height / 2
    await swipe(page, { x: 300, y }, { x: 80, y })
    await expect(label).toHaveText('Pages 8–9 of 22')
    await expect(reader).toHaveAttribute('data-view', '5')
    await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
    // a vertical swipe of 220 px turns none
    await swipe(page, { x: 300, y: r.y + 10 }, { x: 300, y: r.y + 230 })
    await page.waitForTimeout(1200)
    await expect(label).toHaveText('Pages 8–9 of 22')
    await expect(reader).toHaveAttribute('data-view', '5')
    const after = await box(reader)
    expect(Math.abs(after.x - r.x)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(after.y - r.y)).toBeLessThanOrEqual(0.5)
    test.info().annotations.push({
      type: 'paint',
      description: `reader ${r.width.toFixed(2)}×${r.height.toFixed(2)} at ${r.x.toFixed(1)},${r.y.toFixed(1)}; ${String(rects.length)} frames, 0 off; centre ${JSON.stringify(centres)}`,
    })
    expect(errors).toEqual([])
  })
})

test.describe('desktop 1440×900: the reading room', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('demo 6: the room book is 1157 × 723; Esc closes and focus returns to the book', async ({
    page,
  }) => {
    await openRoom(page)
    await page.screenshot({
      path: test.info().outputPath('demo6-1440-room-open.png'),
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
      path: test.info().outputPath('demo6-1440-room.png'),
    })
    test.info().annotations.push({
      type: 'paint',
      description: `room ${r.width.toFixed(1)}×${r.height.toFixed(1)}; centre ${JSON.stringify(centres)}`,
    })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('ss-reader-page')).toHaveCount(0)
    await expect(
      page.getByTestId('ss6-book').locator('visible=true').first(),
    ).toBeFocused()
  })
})
