import type { Locator, Page } from '@playwright/test'
import { animationsSettled } from './fixtures/animationsSettled'
import { expect, test } from './fixtures/coverage'

// The site room's GL reader (Designer personal-site P5; kit reader-gl T1 / T2): the open book is drawn by three.js
// into one canvas over the reader box. Paint is read from that canvas's 2D copy.

const HOME = '/site.html'
/** the sample site's shelf order */
const BOOKS = { alps: 0, sea: 1 } as const

type Probe = Window & {
  /** css px from the canvas top to its first row with alpha ≥ 200; Infinity when empty */
  alphaTop: () => number
  /** mean RGB of the 3×3 backing pixels at a viewport point */
  rgbAt: (x: number, y: number) => number[]
  tops?: number[]
  halt?: boolean
  restore?: () => void
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

function installProbe() {
  const w = window as unknown as Probe
  const canvas = () => {
    const c = document.querySelector<HTMLCanvasElement>(
      '[data-testid="ps-reader-canvas"]',
    )
    const x = c?.getContext('2d')
    return c && x && c.width ? { c, x } : null
  }
  w.alphaTop = () => {
    const g = canvas()
    if (!g) return Number.POSITIVE_INFINITY
    const { c, x } = g
    const k = c.getBoundingClientRect().height / c.height
    for (let y0 = 0; y0 < c.height; y0 += 32) {
      const d = x.getImageData(0, y0, c.width, Math.min(32, c.height - y0)).data
      for (let i = 3; i < d.length; i += 4)
        if ((d[i] ?? 0) >= 200)
          return (y0 + Math.floor((i - 3) / 4 / c.width)) * k
    }
    return Number.POSITIVE_INFINITY
  }
  w.rgbAt = (px, py) => {
    const g = canvas()
    if (!g) return [-1, -1, -1]
    const { c, x } = g,
      r = c.getBoundingClientRect(),
      k = c.width / r.width
    const d = x.getImageData(
      Math.round((px - r.x) * k) - 1,
      Math.round((py - r.y) * k) - 1,
      3,
      3,
    ).data
    return [0, 1, 2].map((ch) => {
      let s = 0
      for (let i = 0; i < 9; i++) s += d[4 * i + ch] ?? 0
      return s / 9
    })
  }
}

/** the T tests need WebGL2 (the CSS reader has no GL turn); CI's Chromium has it (SwiftShader) */
async function needWebGl2(page: Page) {
  const ok = await page.evaluate(
    () => !!document.createElement('canvas').getContext('webgl2'),
  )
  expect(ok, 'WebGL2 (the GL reader)').toBe(true)
}

async function settle(page: Page, view: number, timeout = 5_000) {
  const reader = page.getByTestId('ps-reader')
  await expect(reader).toHaveAttribute('data-view', String(view), { timeout })
  await expect(reader).toHaveAttribute('data-turn', 'rest', { timeout })
  await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
    'data-faces',
    'done',
  )
}

/** open a book over the home: the cover turns at once, resting on view 1 */
async function openBook(page: Page, id: keyof typeof BOOKS, timeout = 10_000) {
  await page.getByTestId('ss9-book').nth(BOOKS[id]).click()
  await settle(page, 1, timeout)
}

async function goToView(page: Page, view: number) {
  const reader = page.getByTestId('ps-reader')
  for (;;) {
    const at = Number(await reader.getAttribute('data-view'))
    if (at === view) break
    await page.keyboard.press(at < view ? 'ArrowRight' : 'ArrowLeft')
    await settle(page, at < view ? at + 1 : at - 1)
  }
  await page.mouse.move(0, 0)
  await animationsSettled(reader)
}

/** the reader's spine, page width and middle row (viewport px) */
async function geometry(page: Page) {
  const b = await box(page.getByTestId('ps-reader'))
  return {
    spine: b.x + b.width / 2,
    pw: b.width / 2,
    y: b.y + b.height / 2,
    h: b.height,
  }
}

const xAt = (g: { spine: number; pw: number }, th: number) =>
  g.spine + g.pw * Math.cos((th * Math.PI) / 180)

/** move the held pointer to θ and wait until the leaf reports it and a frame is drawn */
async function holdAt(
  page: Page,
  g: { spine: number; pw: number; y: number },
  th: number,
) {
  await page.mouse.move(xAt(g, th), g.y, { steps: 4 })
  const leaf = page.getByTestId('ps-leaf')
  await expect
    .poll(async () =>
      Math.abs(Number(await leaf.getAttribute('data-theta')) - th),
    )
    .toBeLessThanOrEqual(1.5)
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
}

const rgbAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([px, py]) => (window as unknown as Probe).rgbAt(px ?? 0, py ?? 0),
    [x, y],
  )
const alphaTop = (page: Page) =>
  page.evaluate(() => (window as unknown as Probe).alphaTop())
const dRgb = (p: number[], q: number[]) =>
  Math.max(...p.map((v, i) => Math.abs(v - (q[i] ?? 0))))

/** drag the right page through θ 45…135 in 5° holds, the alpha top at each; then let it fall back */
async function sweep(page: Page, g: { spine: number; pw: number; y: number }) {
  await page.mouse.move(g.spine + 0.8 * g.pw, g.y)
  await page.mouse.down()
  const tops: number[] = []
  for (let th = 45; th <= 135; th += 5) {
    await holdAt(page, g, th)
    tops.push(await alphaTop(page))
  }
  await page.mouse.move(g.spine + 0.8 * g.pw, g.y, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByTestId('ps-reader')).toHaveAttribute(
    'data-turn',
    'rest',
  )
  return tops
}

/** the probe on the left (−1) or right (1) page: the point where views `to` and `from` differ most (the sample's
   pages share their paper margins); rests on `from` */
async function probe(page: Page, side: -1 | 1, to: number, from: number) {
  await goToView(page, to)
  const g = await geometry(page)
  // near the spine: the tilted leaf's texture drifts off the flat page further out
  const points = [0.1, 0.15, 0.2].flatMap((k) =>
    Array.from({ length: 25 }, (_, i) => ({
      x: g.spine + side * k * g.pw,
      y: g.y + (i - 12) * 0.03 * g.h,
    })),
  )
  const landed: number[][] = []
  for (const p of points) landed.push(await rgbAt(page, p.x, p.y))
  await goToView(page, from)
  const diffs: number[] = []
  for (const [i, p] of points.entries())
    diffs.push(dRgb(await rgbAt(page, p.x, p.y), landed[i] ?? []))
  return points[diffs.indexOf(Math.max(...diffs))] ?? { x: g.spine, y: g.y }
}

/** ΔRGB of a held pixel to the same row of the landed view, best within ±8 px: the tilted leaf maps its texture a few px
   off the flat page, which near a photo edge alone moves the colour past 12 */
async function nearest(page: Page, p: number[], x: number, y: number) {
  let best = Number.POSITIVE_INFINITY
  for (let dx = -8; dx <= 8; dx++)
    best = Math.min(best, dRgb(p, await rgbAt(page, x + dx, y)))
  return best
}

test.describe('site room 1440×900: GL turn (kit reader-gl T1 / T2)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installProbe)
    await page.goto(HOME)
    await needWebGl2(page)
    await expect(page.getByTestId('site-case')).toHaveAttribute('data-laid')
  })

  test('T1: the landing leaf shows its own page, not the old view (forward at view 9, backward at view 3)', async ({
    page,
  }) => {
    // eleven settled turns and two held drags in software GL
    test.setTimeout(120_000)
    const errors = collectErrors(page)
    await openBook(page, 'alps')

    // forward: view 9 → 10, held at θ 165 and 175; the probe sits on the left page
    const g = await geometry(page)
    const left = await probe(page, -1, 10, 9)
    const old = await rgbAt(page, left.x, left.y)
    await page.mouse.move(g.spine + 0.8 * g.pw, g.y)
    await page.mouse.down()
    const held: number[][] = []
    for (const th of [165, 175]) {
      await holdAt(page, g, th)
      held.push(await rgbAt(page, left.x, left.y))
    }
    await page.mouse.up()
    await settle(page, 10)
    await animationsSettled(page.getByTestId('ps-reader'))
    const fwd = await Promise.all(
      held.map((p) => nearest(page, p, left.x, left.y)),
    )
    for (const d of fwd) expect(d).toBeLessThanOrEqual(12)
    // and not the old view's left page
    for (const p of held) expect(dRgb(p, old)).toBeGreaterThan(12)

    // backward: view 3 → 2, held at θ 5; the probe sits on the right page
    const right = await probe(page, 1, 2, 3)
    const old2 = await rgbAt(page, right.x, right.y)
    await page.mouse.move(g.spine - 0.8 * g.pw, g.y)
    await page.mouse.down()
    await holdAt(page, g, 5)
    const back = await rgbAt(page, right.x, right.y)
    await page.mouse.up()
    await settle(page, 2)
    await animationsSettled(page.getByTestId('ps-reader'))
    expect(await nearest(page, back, right.x, right.y)).toBeLessThanOrEqual(12)
    expect(dRgb(back, old2)).toBeGreaterThan(12)
    expect(errors).toEqual([])
  })

  for (const id of ['alps', 'sea'] as const)
    test(`T2: ${id}: the leaf stays below the canvas top, opening and θ 45…135`, async ({
      page,
    }) => {
      // a 6× slowed opening sampled per frame, then 19 held θ
      test.setTimeout(180_000)
      const errors = collectErrors(page)
      // the cover opening (view 0 → 1): sampled on every frame from before the click until the reader rests
      await page.evaluate(() => {
        const w = window as unknown as Probe
        w.tops = []
        w.halt = false
        // the turn runs on performance.now() and rAF timestamps: both slowed 6× so the frames cover the cover's peak
        const now = performance.now.bind(performance),
          raf = window.requestAnimationFrame.bind(window),
          t0 = now(),
          slow = (t: number) => t0 + (t - t0) / 6
        performance.now = () => slow(now())
        window.requestAnimationFrame = (cb) =>
          raf((t) => {
            cb(slow(t))
          })
        w.restore = () => {
          performance.now = now
          window.requestAnimationFrame = raf
        }
        const loop = () => {
          if (w.halt) return
          w.tops?.push(w.alphaTop())
          requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
      })
      await openBook(page, id, 30_000)
      const opening = await page.evaluate(() => {
        const w = window as unknown as Probe
        w.halt = true
        w.restore?.()
        return (w.tops ?? []).filter((t) => Number.isFinite(t))
      })
      const turn = await sweep(page, await geometry(page))
      // the leaf may rise over the head: only the canvas must not cut it
      expect(opening.length).toBeGreaterThanOrEqual(15)
      expect(Math.min(...opening)).toBeGreaterThanOrEqual(2)
      expect(Math.min(...turn)).toBeGreaterThanOrEqual(2)
      expect(errors).toEqual([])
    })
})
