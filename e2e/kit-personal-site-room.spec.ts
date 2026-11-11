import type { Locator } from '@playwright/test'
import { animationsSettled } from './fixtures/animationsSettled'
import { expect, test } from './fixtures/coverage'

// personal-site reading room (site-stand-v7 R / P, stand-v8): the desktop room centres the book over a foot row pinned
// at h − 54; a phone portrait reads in Page turn (`&reader=carousel` keeps the carousel), a landscape phone in the book.

const SITE = '/uikit/#/full/personal-site'

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

const near = (a: number, b: number, d = 0.5) => {
  expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(d)
}

/** the room at rest on `label`: the label shows it and its paper sits at x 16 */
async function rest(room: Locator, label: string) {
  await expect(room.getByTestId('site-label')).toHaveText(label)
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

test.describe('desktop 1440×900: the reading room', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // site-stand-v7 R (D31) + stand-v8: the room centres the visible book in [44, 846], ≥ 32 above / below, ≥ 64 each
  // side, pins the foot at h − 54 and centres the pager; the CSS reader (gl=0) is its whole box (the GL book: reader-gl)
  for (const [id, W, left, top] of [
    ['coast', 1312, 64, 182.6],
    ['lake-trip', 1180.8, 129.6, 76],
  ] as const)
    test(`${id}: W ${String(W)}, foot row top 846, pager centre 720, Play ends at 1416`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      await page.goto(`${SITE}?book=${id}&gl=0`)
      const room = page.getByTestId('ss-reader-page')
      await expect(room).toHaveAttribute('data-mode', 'desk')
      const r = await box(room.getByTestId('site-room'))
      near(r.width, W)
      near(r.x, left)
      near(r.y, top)
      // the pager: Previous · label · Next
      const pager = await box(room.getByTestId('site-label').locator('..'))
      near(pager.y, 846)
      near(pager.x + pager.width / 2, 720)
      const prev = await box(room.getByTestId('ss-prev'))
      const next = await box(room.getByTestId('ss-next'))
      near((prev.x + next.x + next.width) / 2, 720)
      const playBtn = room.getByTestId('site-play')
      near((await box(playBtn.locator('..'))).y, 846)
      const play = await box(playBtn)
      near(play.x + play.width, 1416)
      const about = await box(room.getByTestId('site-about').locator('..'))
      near(about.y, 846)
      await page.screenshot({
        path: test.info().outputPath(`site-1440-${id}.png`),
      })
      expect(errors).toEqual([])
    })
})

/** the art.tsx FOLD gradients painted over the paper's centre (the gutter of a whole-spread slide); the fold is
   pointer-events: none, so elementsFromPoint can't see it: the paper's visible descendants whose box covers the centre */
async function foldsAtCentre(paper: Locator) {
  return paper.evaluate((el) => {
    const p = el.getBoundingClientRect()
    const x = p.x + p.width / 2,
      y = p.y + p.height / 2
    return [...el.querySelectorAll('*')].filter((e) => {
      const r = e.getBoundingClientRect(),
        cs = getComputedStyle(e)
      return (
        cs.visibility === 'visible' &&
        Number(cs.opacity) > 0 &&
        r.left <= x &&
        r.right >= x &&
        r.top <= y &&
        r.bottom >= y &&
        cs.backgroundImage.includes('rgba(0, 0, 0, 0.06) 50%')
      )
    }).length
  })
}

// site-stand-v7 P (D32): the phone reader: the group centred in [8, h − 64], the label only, no switch, no fold.
// stand-v8: Page turn is the mode; `&reader=carousel` keeps the carousel for comparison
test.describe('phone 390×844: reader', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('&reader=carousel: geometry; no Previous / Next / Reader switch; the gutter slide has no fold', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto(`${SITE}?book=lake-trip&gl=0&reader=carousel`)
    const room = page.getByTestId('ss-reader-page')
    await expect(room).toHaveAttribute('data-mode', 'port')
    const strip = room.getByTestId('ps-strip')
    await expect(strip).toBeFocused()
    near((await box(room.getByTestId('site-all-books'))).y, 128.25)
    const s = await box(strip)
    near(s.y, 180.25)
    near(s.height, 447.5)
    const label = await box(room.getByTestId('site-label').locator('..'))
    near(label.y, 635.75)
    near(label.height, 24)
    await expect(room.getByTestId('ss-prev')).toHaveCount(0)
    await expect(room.getByTestId('ss-next')).toHaveCount(0)
    await expect(page.getByTestId('ss-reader-switch')).toHaveCount(0)

    // → from Page 1: the gutter slide
    await rest(room, 'Page 1 of 22')
    await page.keyboard.press('ArrowRight')
    const spread = await rest(room, 'Pages 2–3 of 22')
    await still(room)
    expect(await foldsAtCentre(spread)).toBe(0)
    await expect(
      spread.locator('[style*="rgba(0, 0, 0, 0.06) 50%"]'),
    ).toHaveCount(0)
    await page.screenshot({
      path: test.info().outputPath('site-390-spread.png'),
    })
    expect(errors).toEqual([])
  })

  test('opens in Page turn with no URL param; header row 128.25, stage 180.25; Next turns one page', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${SITE}?book=lake-trip&gl=0`)
    const room = page.getByTestId('ss-reader-page')
    await expect(room).toHaveAttribute('data-mode', 'port')
    const stage = room.getByTestId('pt-stage')
    await expect(stage).toBeVisible()
    await expect(stage).toBeFocused()
    expect(page.url()).not.toContain('reader=')
    await expect(room.getByTestId('ps-strip')).toHaveCount(0)
    await expect(page.getByTestId('ss-reader-switch')).toHaveCount(0)
    await expect(room.getByTestId('ss-next')).toHaveCount(0)
    // the header row: "‹ Title" and Play
    const back = room.getByTestId('site-all-books')
    near((await box(back)).y, 128.25)
    near((await box(back.locator('..'))).y, 128.25)
    await expect(back.locator('..').getByTestId('site-play')).toBeVisible()
    near((await box(stage)).y, 180.25)
    await expect(room.getByTestId('site-label')).toHaveText('Page 1 of 22')
    await page.keyboard.press('ArrowRight')
    await expect(room.getByTestId('site-label')).toHaveText('Pages 2–3 of 22')
    await still(room)
    await expect(room.getByTestId('ps-strip')).toHaveCount(0)
    expect(errors).toEqual([])
  })
})

// stand-v8: the landscape phone reads in the book (its leaves turn), never the carousel
test.describe('phone 844×390: reader', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  })

  test('opens the turning book, no carousel, with no URL param', async ({
    page,
  }) => {
    await page.goto(`${SITE}?book=coast&gl=0`)
    const room = page.getByTestId('ss-reader-page')
    await expect(room).toHaveAttribute('data-mode', 'land')
    await expect(room.getByTestId('ps-reader')).toBeVisible()
    await expect(room.getByTestId('ps-strip')).toHaveCount(0)
    await expect(page.getByTestId('ss-reader-switch')).toHaveCount(0)
    const reader = room.getByTestId('ps-reader')
    await expect(reader).toHaveAttribute('data-view', '1')
    await page.keyboard.press('ArrowRight')
    await expect(reader).toHaveAttribute('data-view', '2')
  })
})
