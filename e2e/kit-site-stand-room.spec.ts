import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'
import { visibleCentres, white } from './fixtures/sitePagePaint'

// site-stand S5 + S6, site-stand-v2 S (DEMO branch): a demo 6 book opens the
// shared reading room; on a phone portrait the room reads one page per slide
// (site-stand-v5 R, D23–D25) and a swipe that starts outside the stage goes
// back to the list.

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

/** a one-finger swipe through the browser's touch input (pointer events + touch-action); `stepMs` slows it down */
async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  stepMs = 0,
) {
  const cdp = await page.context().newCDPSession(page)
  const at = (x: number, y: number) => [{ x, y, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: at(from.x, from.y),
  })
  for (let i = 1; i <= 12; i++) {
    if (stepMs) await page.waitForTimeout(stepMs)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: at(
        from.x + ((to.x - from.x) * i) / 12,
        from.y + ((to.y - from.y) * i) / 12,
      ),
    })
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await cdp.detach()
}

const LABELS = [
  'Cover',
  'Page 1',
  'Pages 2–3',
  'Page 4',
  'Page 5',
  'Page 6',
  'Page 7',
  'Page 9',
  'Pages 10–11',
  'Page 12',
  'Page 13',
  'Page 14',
  'Page 15',
  'Pages 16–17',
  'Pages 18–19',
  'Page 20',
].map((l) => (l === 'Cover' ? l : `${l} of 22`))

const near = (a: number, b: number, d = 0.5) => {
  expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(d)
}

/** the room at rest on `label`: the label shows it and its paper sits at x 16 */
async function rest(room: Locator, label: string) {
  await expect(room.getByTestId('ss-label')).toHaveText(label)
  const paper = room
    .locator(`[data-testid="ps-slide"][aria-label="${label}"]`)
    .getByTestId('ps-paper')
  await expect.poll(async () => Math.round((await box(paper)).x)).toBe(16)
  return paper
}

test.describe('phone 390×844: slides', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('demo 6 lake-trip: one page per slide, 16 slides; a swipe or Next turns one', async ({
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
    const strip = room.getByTestId('ps-strip')
    await expect(strip).toBeFocused()
    const s = await box(strip)
    near(s.x, 0)
    near(s.y, 198.25)
    near(s.width, 390)
    near(s.height, 447.5)
    await expect(room.getByTestId('ps-slide')).toHaveCount(16)
    expect(
      await room
        .getByTestId('ps-slide')
        .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))),
    ).toEqual(LABELS)
    // the room's own chrome only: no site head, no switch, no GL canvas
    await expect(page.locator('.ss-head')).toHaveCount(0)
    await expect(page.getByTestId('ss-switch')).toHaveCount(0)
    await expect(room.locator('canvas')).toHaveCount(0)
    const back = room.getByTestId('ss-all')
    await expect(back).toHaveText('‹ Lake trip')
    const bb = await box(back)
    near(bb.y, 146.25)

    const walked = [LABELS[1] ?? '']
    await rest(room, walked[0] ?? '')
    const next = room.getByTestId('ss-next')
    // a spread across the gutter: one whole slide, centred in the page stage
    await next.click()
    walked.push('Pages 2–3 of 22')
    const spread = await box(await rest(room, 'Pages 2–3 of 22'))
    near(spread.width, 358)
    near(spread.height, 223.75)
    near(spread.x, 16)
    near(spread.y, 310.1)
    // a left page reads as a full-width page
    await next.click()
    walked.push('Page 4 of 22')
    const paper = await rest(room, 'Page 4 of 22')
    const p = await box(paper)
    near(p.width, 358)
    near(p.height, 447.5)
    near(p.x, 16)
    near(p.y, 198.25)
    const [rgb] = await pixelsAt(paper, [{ x: p.width / 2, y: p.height / 2 }])
    expect(white(rgb ?? [255, 255, 255])).toBe(false)
    await page.screenshot({
      path: test.info().outputPath('demo6-390-slide.png'),
    })

    // a touch swipe 300 → 80 at the stage's mid-y: exactly one slide
    const y = s.y + s.height / 2
    await swipe(page, { x: 300, y }, { x: 80, y })
    walked.push('Page 5 of 22')
    await rest(room, 'Page 5 of 22')
    await page.waitForTimeout(600)
    await expect(room.getByTestId('ss-label')).toHaveText('Page 5 of 22')
    // a vertical swipe of 220: none
    await swipe(page, { x: 300, y: s.y + 10 }, { x: 300, y: s.y + 230 })
    await page.waitForTimeout(800)
    await rest(room, 'Page 5 of 22')

    // Next until disabled: the slides after page 1, in order
    while (!(await next.isDisabled())) {
      const i = walked.length + 1
      await next.click()
      walked.push(LABELS[i] ?? '?')
      await rest(room, LABELS[i] ?? '?')
    }
    expect(walked).toEqual(LABELS.slice(1))
    test.info().annotations.push({
      type: 'paint',
      description: `strip ${JSON.stringify(s)}; spread ${JSON.stringify(spread)}; page ${JSON.stringify(p)}; centre ${JSON.stringify(rgb)}`,
    })
    expect(errors).toEqual([])
  })

  test('swipe back: from outside the stage it closes, on the stage it turns, a short one springs back', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const url = '/uikit/#/full/site-demo-6?books=6&book=lake-trip&gl=0'
    await page.goto(url)
    const room = page.getByTestId('ss-reader-page')
    await rest(room, 'Page 1 of 22')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    await rest(room, LABELS[4] ?? '')
    // every label the room shows while the swipe drags
    await page.evaluate(() => {
      const seen: string[] = []
      ;(window as unknown as { __labels: string[] }).__labels = seen
      const el = document.querySelector('[data-testid="ss-label"]')
      if (el)
        new MutationObserver(() => seen.push(el.textContent)).observe(el, {
          childList: true,
          characterData: true,
          subtree: true,
        })
    })
    await swipe(page, { x: 40, y: 100 }, { x: 300, y: 100 })
    expect(
      await page.evaluate(
        () => (window as unknown as { __labels: string[] }).__labels,
      ),
    ).toEqual([])
    await expect(room).toHaveCount(0)
    expect(page.url()).not.toContain('book=')
    await expect(
      page.getByTestId('ss6-book').locator('visible=true').first(),
    ).toBeVisible()

    // on the stage: a page back to the cover, the room stays
    await page.goto(url)
    await rest(room, 'Page 1 of 22')
    await swipe(page, { x: 60, y: 300 }, { x: 330, y: 300 })
    await rest(room, 'Cover')
    await page.waitForTimeout(400)
    await expect(room).toBeVisible()

    // a slow 60 px pull above the stage springs back
    await swipe(page, { x: 40, y: 100 }, { x: 100, y: 100 }, 30)
    await expect(room).toBeVisible()
    await expect
      .poll(() => room.evaluate((el) => getComputedStyle(el).transform))
      .toBe('none')
    await expect(room.getByTestId('ss-label')).toHaveText('Cover')
    await expect(page.locator('.ss-layer')).toHaveAttribute('data-off', '')
    expect(errors).toEqual([])
  })

  test('port Play: 4000 + 400 ms turns one slide', async ({ page }) => {
    await page.clock.install()
    await page.goto('/uikit/#/full/site-demo-6?books=6&book=lake-trip&gl=0')
    const room = page.getByTestId('ss-reader-page')
    await page.clock.runFor(500)
    await rest(room, 'Page 1 of 22')
    const play = room.getByTestId('sd-play')
    await play.click()
    await expect(play).toHaveAttribute('aria-pressed', 'true')
    await page.clock.runFor(3900)
    await expect(room.getByTestId('ss-label')).toHaveText('Page 1 of 22')
    await page.clock.runFor(100 + 400)
    await rest(room, 'Pages 2–3 of 22')
    await expect(play).toHaveAttribute('aria-pressed', 'true')
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
