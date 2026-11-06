import type { Locator, Page } from '@playwright/test'
import { animationsSettled } from './fixtures/animationsSettled'
import { cdpTouch } from './fixtures/cdpTouch'
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
  const f = await cdpTouch(page, from)
  await f.move(to, 12, stepMs)
  await f.up()
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

/** after a gesture: the room no longer follows a swipe back, the strip / stage is at rest, no transition runs */
async function still(room: Locator) {
  await expect(room).not.toHaveAttribute('data-swipe', 'move')
  const strip = room.getByTestId('ps-strip')
  const stage = room.getByTestId('pt-stage')
  if (await strip.count())
    await expect(strip).toHaveAttribute('data-scroll', 'rest')
  if (await stage.count())
    await expect(stage).toHaveAttribute('data-turn', 'rest')
  await animationsSettled(room)
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
    await still(room)
    await expect(room.getByTestId('ss-label')).toHaveText('Page 5 of 22')
    // a vertical swipe of 220: none
    await swipe(page, { x: 300, y: s.y + 10 }, { x: 300, y: s.y + 230 })
    await still(room)
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
    await still(room)
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

// site-stand-v6 S / T / F (D27–D29): the Page turn mode, drawn as the CSS fold (`gl=0`)
const TURN_URL = '/uikit/#/full/site-demo-6?book=lake-trip&gl=0&reader=turn'

/** a held one-finger touch (CDP): `move` in `steps` steps `stepMs` apart, `up` lifts it */
async function touch(page: Page, x: number, y: number) {
  const f = await cdpTouch(page, { x, y })
  return {
    move: (tx: number, ty: number, steps = 12, stepMs = 0) =>
      f.move({ x: tx, y: ty }, steps, stepMs),
    hold: f.hold,
    up: f.up,
  }
}

/** Next (the label moves at the commit, 600 ms) until the label reads `label` */
async function turnTo(room: Locator, label: string) {
  const lbl = room.getByTestId('ss-label')
  const i = LABELS.indexOf(label)
  for (;;) {
    const now = LABELS.indexOf(await lbl.innerText())
    if (now === i) return
    await room.getByTestId(now < i ? 'ss-next' : 'ss-prev').click()
    await expect(lbl).toHaveText(LABELS[now + (now < i ? 1 : -1)] ?? '')
  }
}

test.describe('phone 390×844: page turn', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('geometry, the switch, Next and the 16 slides', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto(TURN_URL)
    const room = page.getByTestId('ss-reader-page')
    await expect(room).toHaveAttribute('data-mode', 'port')
    const stage = room.getByTestId('pt-stage')
    await expect(stage).toBeFocused()
    await expect(stage).toHaveAttribute('data-gl', '0')
    const s = await box(stage)
    near(s.x, 0)
    near(s.y, 198.25)
    near(s.width, 390)
    near(s.height, 447.5)
    const top = stage.locator('[data-testid="pt-sheet"][data-role="top"]')
    const t = await box(top)
    near(t.x, 16)
    near(t.y, 198.25)
    near(t.width, 358)
    near(t.height, 447.5)
    await expect(room.getByTestId('ss-label')).toHaveText('Page 1 of 22')

    const sw = room.getByTestId('ss-reader-switch')
    await expect(sw.getByRole('button', { name: 'Page turn' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(sw.getByRole('button', { name: 'Carousel' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    const b = await box(sw)
    near(b.y + b.height, 832, 1)
    const foot = await box(room.getByTestId('ss-next').locator('..'))
    expect(foot.y + foot.height).toBeLessThanOrEqual(b.y - 8)

    await room.getByTestId('ss-next').click()
    await expect(room.getByTestId('ss-label')).toHaveText('Pages 2–3 of 22')
    await still(room)
    const t2 = await box(top)
    near(t2.width, 358)
    near(t2.height, 447.5)
    near((await box(top.getByTestId('pt-art'))).y, 310.13)
    await expect(stage).toHaveAttribute('data-xm', '')

    // Home crossfades to the cover, then Next through every slide
    await page.keyboard.press('Home')
    await expect(room.getByTestId('ss-label')).toHaveText('Cover')
    const seen = ['Cover']
    const next = room.getByTestId('ss-next')
    while (await next.isEnabled()) {
      await next.click()
      await expect(room.getByTestId('ss-label')).toHaveText(
        LABELS[seen.length] ?? '',
      )
      seen.push(await room.getByTestId('ss-label').innerText())
    }
    expect(seen).toEqual(LABELS)
    expect(errors).toEqual([])
  })

  test('drag: the fold follows, springs back, turns; flick, tap, vertical', async ({
    page,
  }) => {
    await page.goto(TURN_URL)
    const room = page.getByTestId('ss-reader-page')
    const stage = room.getByTestId('pt-stage')
    const lbl = room.getByTestId('ss-label')
    await turnTo(room, 'Page 5 of 22')
    const s = await box(stage)

    // a held edge drag 370 → 200 at y 420: xm 222.4, the flap 102.8 + 135.6
    const f = await touch(page, 370, 420)
    await f.move(200, 420)
    await expect
      .poll(async () => Number(await stage.getAttribute('data-xm')))
      .toBeCloseTo(222.4, 0)
    near(Number(await stage.getAttribute('data-xm')), 222.4, 2)
    const flap = await box(stage.getByTestId('pt-flap'))
    near(flap.x, 102.8, 2)
    near(flap.width, 135.6, 2)
    await expect(stage).toHaveAttribute('data-dir', 'fwd')
    // painted: the flap's middle is the paper back (rgb 244 243 241 under a ≤ 10 % shade and the 10 % show-through)
    const [[r = 0, , b = 0] = []] = await pixelsAt(stage, [
      { x: flap.x + flap.width / 2, y: 420 - s.y },
    ])
    for (const c of [r, b]) {
      expect(c).toBeGreaterThanOrEqual(195)
      expect(c).toBeLessThanOrEqual(250)
    }
    expect(Math.abs(r - b)).toBeLessThanOrEqual(25)
    // held still past the 80 ms flick window, then released: under half way, no flick → it springs back
    f.hold(200)
    await f.up()
    await expect(stage).toHaveAttribute('data-xm', '')
    await expect(stage.getByTestId('pt-flap')).toHaveCount(0)
    await expect(lbl).toHaveText('Page 5 of 22')

    // past half way: the next slide
    const g = await touch(page, 370, 420)
    await g.move(30, 420)
    await g.up()
    await expect(lbl).toHaveText('Page 6 of 22')
    await expect(stage).toHaveAttribute('data-xm', '')

    // a quick 70 px flick: the next slide
    const h = await touch(page, 300, 420)
    await h.move(230, 420, 6, 8)
    await h.up()
    await expect(lbl).toHaveText('Page 7 of 22')
    await expect(stage).toHaveAttribute('data-xm', '')

    // a vertical swipe: nothing
    await swipe(page, { x: 200, y: 250 }, { x: 200, y: 470 })
    await still(room)
    await expect(lbl).toHaveText('Page 7 of 22')
    await expect(stage.getByTestId('pt-flap')).toHaveCount(0)

    // a tap on the left half: the previous slide
    await (await touch(page, 60, 420)).up()
    await expect(lbl).toHaveText('Page 6 of 22')
  })

  test('slide 0: a rightward drag does nothing; a swipe above the stage closes', async ({
    page,
  }) => {
    await page.goto(TURN_URL)
    const room = page.getByTestId('ss-reader-page')
    const stage = room.getByTestId('pt-stage')
    await turnTo(room, 'Cover')
    await swipe(page, { x: 60, y: 420 }, { x: 330, y: 420 })
    await still(room)
    await expect(room).toBeVisible()
    await expect(room.getByTestId('ss-label')).toHaveText('Cover')
    await expect(stage.getByTestId('pt-flap')).toHaveCount(0)
    await expect(stage).toHaveAttribute('data-xm', '')

    await swipe(page, { x: 40, y: 100 }, { x: 300, y: 100 })
    await expect(room).toHaveCount(0)
  })

  test('the switch keeps the slide, edits the hash in place', async ({
    page,
  }) => {
    await page.goto(TURN_URL)
    const room = page.getByTestId('ss-reader-page')
    const lbl = room.getByTestId('ss-label')
    await turnTo(room, 'Page 5 of 22')
    const n = await page.evaluate(() => history.length)
    const sw = room.getByTestId('ss-reader-switch')

    await sw.getByRole('button', { name: 'Carousel' }).click()
    await expect(room.getByTestId('ps-strip')).toBeVisible()
    await expect(room.getByTestId('pt-stage')).toHaveCount(0)
    await rest(room, 'Page 5 of 22')
    expect(page.url()).not.toContain('reader=')
    expect(page.url()).toContain('book=lake-trip')
    expect(await page.evaluate(() => history.length)).toBe(n)

    await sw.getByRole('button', { name: 'Page turn' }).click()
    await expect(room.getByTestId('pt-stage')).toBeVisible()
    await expect(lbl).toHaveText('Page 5 of 22')
    expect(page.url()).toContain('reader=turn')
    expect(await page.evaluate(() => history.length)).toBe(n)
  })

  test('Play: 4000 + 600 ms turns one slide', async ({ page }) => {
    await page.clock.install()
    await page.goto(TURN_URL)
    const room = page.getByTestId('ss-reader-page')
    const lbl = room.getByTestId('ss-label')
    await page.clock.runFor(500)
    await expect(lbl).toHaveText('Page 1 of 22')
    const play = room.getByTestId('sd-play')
    await play.click()
    await page.clock.runFor(3900)
    await expect(lbl).toHaveText('Page 1 of 22')
    await page.clock.runFor(100 + 600 + 100)
    await expect(lbl).toHaveText('Pages 2–3 of 22')
    await expect(play).toHaveAttribute('aria-pressed', 'true')
  })

  test('reduced motion: Next crossfades, no fold', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(TURN_URL)
    const room = page.getByTestId('ss-reader-page')
    await expect(room.getByTestId('ss-label')).toHaveText('Page 1 of 22')
    await room.getByTestId('ss-next').click()
    await expect(room.getByTestId('pt-flap')).toHaveCount(0)
    await expect(room.getByTestId('ss-label')).toHaveText('Pages 2–3 of 22', {
      timeout: 250,
    })
    await expect(room.getByTestId('pt-flap')).toHaveCount(0)
  })

  test.describe('360×560', () => {
    test.use({ viewport: { width: 360, height: 560 } })

    test('the group moves up: the foot ends 8 px above the switch', async ({
      page,
    }) => {
      await page.goto(TURN_URL)
      const room = page.getByTestId('ss-reader-page')
      await expect(room.getByTestId('pt-stage')).toBeVisible()
      near((await box(room.getByTestId('ss-all').locator('..'))).y, 7)
      const foot = await box(room.getByTestId('ss-next').locator('..'))
      near(foot.y + foot.height, 521)
      const sw = await box(room.getByTestId('ss-reader-switch'))
      expect(foot.y + foot.height).toBeLessThanOrEqual(sw.y - 8)
    })
  })
})

test.describe('phone 844×390', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  })

  const room6 = (id: string, gl = false) =>
    `/uikit/#/full/site-demo-6?books=6&book=${id}${gl ? '' : '&gl=0'}`

  // site-stand-v5 L / D26: the larger of side (136 px bands) and foot (one row under the book)
  const CASES = [
    {
      w: 844,
      h: 390,
      id: 'lake-trip',
      layout: 'side',
      box: [136, 16.25, 572, 357.5],
    },
    { w: 844, h: 390, id: 'coast', layout: 'foot', box: [16, 8.6, 812, 324.8] },
    {
      w: 844,
      h: 390,
      id: 'summer-family',
      layout: 'foot',
      box: [96, 8, 652, 326],
    },
    {
      w: 667,
      h: 375,
      id: 'lake-trip',
      layout: 'foot',
      box: [84.7, 8, 497.6, 311],
    },
    { w: 667, h: 375, id: 'coast', layout: 'foot', box: [16, 36.5, 635, 254] },
  ] as const

  test('side or foot: the reader box, and nothing drawn on the book', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    const lines: string[] = []
    for (const c of CASES) {
      await page.setViewportSize({ width: c.w, height: c.h })
      await page.goto(room6(c.id))
      const room = page.getByTestId('ss-reader-page')
      await expect(room).toHaveAttribute('data-layout', c.layout)
      await expect(room.getByTestId('ss-label')).toHaveText(/^Page 1 of \d+$/)
      const r = await box(room.getByTestId('ss-reader'))
      const [x, y, w, h] = c.box
      near(r.x, x)
      near(r.y, y)
      near(r.width, w)
      near(r.height, h)
      await expect(page.locator('.ss-head')).toHaveCount(0)
      await expect(page.getByTestId('ss-switch')).toHaveCount(0)
      for (const id of [
        'ss-all',
        'sd-play',
        'ss-label',
        'ss-prev',
        'ss-next',
      ]) {
        const o = await box(room.getByTestId(id))
        const apart =
          o.x + o.width <= r.x ||
          o.x >= r.x + r.width ||
          o.y + o.height <= r.y ||
          o.y >= r.y + r.height
        expect(
          apart,
          `${c.id} ${String(c.w)}: ${id} ${JSON.stringify(o)} vs reader`,
        ).toBe(true)
      }
      // paint: whatever is topmost over the book belongs to the reader
      const hits = await page.evaluate(
        (b) =>
          [0.1, 0.5, 0.9].flatMap((fx) =>
            [0.1, 0.5, 0.9].map((fy) => {
              const el = document.elementFromPoint(
                b.x + fx * b.width,
                b.y + fy * b.height,
              )
              return !!el?.closest('[data-testid="ss-reader"]')
            }),
          ),
        r,
      )
      expect(
        hits.every(Boolean),
        `${c.id} ${String(c.w)}: ${JSON.stringify(hits)}`,
      ).toBe(true)
      lines.push(
        `${c.id} ${String(c.w)}×${String(c.h)} ${c.layout} ${r.width.toFixed(1)}×${r.height.toFixed(1)} @ ${r.x.toFixed(1)},${r.y.toFixed(1)}`,
      )
    }
    await page.screenshot({ path: test.info().outputPath('room-844-foot.png') })
    test
      .info()
      .annotations.push({ type: 'paint', description: lines.join('; ') })
    expect(errors).toEqual([])
  })

  test('a swipe from the left band closes; a drag on the book turns a leaf', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(room6('lake-trip'))
    const room = page.getByTestId('ss-reader-page')
    await expect(room).toHaveAttribute('data-layout', 'side')
    const label = room.getByTestId('ss-label')
    await expect(label).toHaveText('Page 1 of 22')
    await expect(page.getByTestId('ps-leaf')).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath('room-844-side.png') })

    const r = await box(room.getByTestId('ss-reader'))
    const y = r.y + r.height / 2
    await swipe(
      page,
      { x: r.x + r.width * 0.9, y },
      { x: r.x + r.width * 0.1, y },
    )
    await expect(label).toHaveText('Pages 2–3 of 22')
    await expect(page.getByTestId('ps-leaf')).toHaveCount(0)
    await expect(room).toBeVisible()

    // 240 px > 0.25·w (211): past the distance threshold, so it closes whatever the swipe speed
    await swipe(page, { x: 20, y: 195 }, { x: 260, y: 195 })
    await expect(room).toHaveCount(0)
    expect(page.url()).not.toContain('book=')
    expect(errors).toEqual([])
  })

  test('the GL canvas = the reader box + the overhang and stays put across a turn', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(room6('lake-trip', true))
    await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
      'data-gl',
      'ready',
    )
    await expect(page.getByTestId('ss-label')).toHaveText('Page 1 of 22')
    await expect(page.getByTestId('ps-leaf')).toHaveCount(0)
    const reader = page.getByTestId('ps-reader')
    const canvas = page.getByTestId('ps-reader-canvas')
    const rb = await box(reader)
    // site-stand-v4 D20 + v7 T2: the default overhang (x −0.04 W, y −0.21 W, 1.08 W × (H + 0.21 W + 0.05 H)), no camera box
    const want = {
      x: rb.x - 0.04 * rb.width,
      y: rb.y - 0.21 * rb.width,
      width: 1.08 * rb.width,
      height: 1.05 * rb.height + 0.21 * rb.width,
    }
    const fits = async () => {
      const c = await box(canvas)
      near(c.x, want.x, 1)
      near(c.y, want.y, 1)
      near(c.width, want.width, 1)
      near(c.height, want.height, 1)
    }
    await fits()
    // every frame with the leaf up, the page records the canvas box (a starved poll can miss a whole turn)
    await page.evaluate(() => {
      const w = window as unknown as { __turnBoxes: number[][] }
      w.__turnBoxes = []
      const tick = () => {
        const c = document.querySelector('[data-testid="ps-reader-canvas"]')
        if (c && document.querySelector('[data-testid="ps-leaf"]')) {
          const r = c.getBoundingClientRect()
          w.__turnBoxes.push([r.x, r.y, r.width, r.height])
        } else if (w.__turnBoxes.length) return
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await page.getByTestId('ss-next').click()
    await expect(page.getByTestId('ss-label')).toHaveText('Pages 2–3 of 22')
    await expect(page.getByTestId('ps-reader')).toHaveAttribute(
      'data-turn',
      'rest',
    )
    await expect(page.getByTestId('ps-leaf')).toHaveCount(0)
    const turnBoxes = await page.evaluate(
      () => (window as unknown as { __turnBoxes: number[][] }).__turnBoxes,
    )
    expect(turnBoxes.length).toBeGreaterThan(0)
    for (const [x = 0, y = 0, width = 0, height = 0] of turnBoxes) {
      near(x, want.x, 1)
      near(y, want.y, 1)
      near(width, want.width, 1)
      near(height, want.height, 1)
    }
    await fits()
    const rb2 = await box(reader)
    near(rb2.x, rb.x)
    near(rb2.y, rb.y)
    await page.screenshot({ path: test.info().outputPath('gl-844-v2.png') })
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
