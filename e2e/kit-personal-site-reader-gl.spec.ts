import type { Locator, Page } from '@playwright/test'
import { animationsSettled } from './fixtures/animationsSettled'
import { expect, test } from './fixtures/coverage'

// personal-site GL reader (Designer Spec site-stand-v2 R, D1, D2): the open book is drawn by three.js into one canvas
// over the reader box; `?gl=0` keeps the CSS reader. Paint is read from clipped screenshots decoded in the page.

const SITE = '/uikit/#/full/personal-site'

interface Clip {
  x: number
  y: number
  width: number
  height: number
}
interface Img {
  w: number
  h: number
  a: number[]
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function shot(page: Page, clip: Clip): Promise<Img> {
  const png = await page.screenshot({ clip })
  return page.evaluate(async (b64) => {
    const im = new Image()
    im.src = `data:image/png;base64,${b64}`
    await im.decode()
    const c = document.createElement('canvas')
    c.width = im.width
    c.height = im.height
    const x = c.getContext('2d')
    if (!x) throw new Error('no 2d')
    x.drawImage(im, 0, 0)
    return {
      w: c.width,
      h: c.height,
      a: [...x.getImageData(0, 0, c.width, c.height).data],
    }
  }, png.toString('base64'))
}
const lumAt = (m: Img, i: number) =>
  0.299 * (m.a[4 * i] ?? 0) +
  0.587 * (m.a[4 * i + 1] ?? 0) +
  0.114 * (m.a[4 * i + 2] ?? 0)
const lums = (m: Img) =>
  Array.from({ length: m.w * m.h }, (_, i) => lumAt(m, i))
/** a pixel off the paper: dark, or coloured */
const inked = (m: Img, i: number) => {
  const r = m.a[4 * i] ?? 0,
    g = m.a[4 * i + 1] ?? 0,
    b = m.a[4 * i + 2] ?? 0
  return lumAt(m, i) < 170 || Math.max(r, g, b) - Math.min(r, g, b) > 30
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** open Lake trip in the reading room; resolves once the reader rests on view 1 */
async function openRoom(page: Page, query = '') {
  await page.goto(`${SITE}${query}`)
  // a click opens the room at the cover, which turns to view 1 at once
  await page
    .locator('[data-testid="ss9-book"][data-id="lake-trip"]')
    .locator('visible=true')
    .click()
  await expect(page.getByTestId('ps-reader')).toHaveAttribute('data-view', '1')
}

/** a 1-px line from outside the book inward: past the background and floor shadow (> 170) and the board (≤ 170; its
   side rims are ~150 on the v8 reader, its tail edge ~55), the page-block band = the run of pixels darker than the paper
   before the paper starts (its shade moves with the book's place in the canvas: 182–208 on the desktop reader, so the
   board, not a background level, anchors it) */
function band(line: number[], paper: number) {
  let i = 0
  while (i < line.length && (line[i] ?? 0) > 170) i++
  while (i < line.length && (line[i] ?? 0) <= 170) i++
  let n = 0
  while (
    i < line.length &&
    (line[i] ?? 0) > 120 &&
    (line[i] ?? 0) < paper - 8
  ) {
    i++
    n++
  }
  return n
}

/** the leaf's photo: the first run (≥ 40 px) of columns from the spine with ink; the page under the leaf starts past a
   gap of leaf paper. A sample is the median of the topmost ink over 5 columns (a grain speck can't move it). Returns 5
   samples across the run and their largest deviation from the chord. */
function topEdge(top: Img) {
  const topInk = (x: number) => {
    for (let yy = 0; yy < top.h; yy++) if (inked(top, yy * top.w + x)) return yy
    return -1
  }
  const edgeY = (x: number) =>
    [-2, -1, 0, 1, 2].map((d) => topInk(x + d)).sort((p, q) => p - q)[2] ?? -1
  const cols: number[] = []
  for (let x = 0; x < top.w; x++) {
    if (topInk(x) >= 0) cols.push(x)
    else if (cols.length >= 40) break
    else cols.length = 0 // a speck (the gutter), not the photo
  }
  const xa = cols[0] ?? 0,
    xb = cols[cols.length - 1] ?? 0
  const xs = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) =>
    Math.round(xa + 4 + (xb - xa - 8) * f),
  )
  const ys = xs.map(edgeY)
  const px = xs[0] ?? 0,
    py = ys[0] ?? 0,
    qx = xs[4] ?? 0,
    qy = ys[4] ?? 0
  const dev = Math.max(
    ...xs.map((x, i) => {
      const t = (x - px) / (qx - px)
      return Math.abs((ys[i] ?? 0) - (py + (qy - py) * t))
    }),
  )
  return { xs, ys, dev }
}

test.describe('desktop 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Pages 4–5: grained paper, page-block edges and tail band; the leaf bends at θ 70°', async ({
    page,
  }) => {
    // six decoded screenshots and a held drag: past 30 s when the lane runs in parallel
    test.setTimeout(90_000)
    const errors = collectErrors(page)
    await openRoom(page)
    const reader = page.getByTestId('ps-reader')
    await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
      'data-gl',
      'ready',
    )
    await page.keyboard.press('ArrowRight')
    await expect(reader).toHaveAttribute('data-view', '2')
    await page.keyboard.press('ArrowRight')
    await expect(reader).toHaveAttribute('data-view', '3')
    await expect(page.getByTestId('ps-leaf')).toHaveCount(0)
    const canvas = page.getByTestId('ps-reader-canvas')
    await expect(canvas).toHaveAttribute('role', 'img')
    await expect(canvas).toHaveAttribute('aria-label', 'Pages 4–5')
    await page.mouse.move(0, 0)
    await reader.evaluate((el) => {
      ;(el as HTMLElement).blur()
    })
    // no turn or corner lift runs, every face drawn has its canvas, the room's transitions are done
    await expect(reader).toHaveAttribute('data-turn', 'rest')
    await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
      'data-faces',
      'done',
    )
    await animationsSettled(reader)
    const b = await box(reader)

    // flat paper in the right page's bottom margin (under the photo): bright, with grain
    const paper = lums(
      await shot(page, {
        x: Math.round(b.x + 0.7 * b.width),
        y: Math.round(b.y + 0.84 * b.height),
        width: 40,
        height: 40,
      }),
    )
    const mean = paper.reduce((s, v) => s + v, 0) / paper.length
    const sd = Math.sqrt(
      paper.reduce((s, v) => s + (v - mean) ** 2, 0) / paper.length,
    )
    console.log(`paper lum ${mean.toFixed(1)} sd ${sd.toFixed(2)}`)
    expect(mean).toBeGreaterThanOrEqual(236)
    // site-stand-v4 D21: a quiet grain, still there
    expect(sd).toBeGreaterThanOrEqual(0.5)
    expect(sd).toBeLessThanOrEqual(1.5)

    // the tail band: under the right page, above the board
    const col = await shot(page, {
      x: Math.round(b.x + 0.7 * b.width),
      y: Math.round(b.y + 0.87 * b.height),
      width: 1,
      height: Math.round(0.1 * b.height),
    })
    const tail = band(lums(col).reverse(), mean)
    // both page-block edges at mid-height: from the canvas side in, the band before the paper
    const y = Math.round(b.y + b.height / 2)
    const right = await shot(page, {
      x: Math.round(b.x + 0.86 * b.width),
      y,
      width: Math.round(0.1 * b.width),
      height: 1,
    })
    const left = await shot(page, {
      x: Math.round(b.x + 0.04 * b.width),
      y,
      width: Math.round(0.1 * b.width),
      height: 1,
    })
    const eR = band(lums(right).reverse(), mean)
    const eL = band(lums(left), mean)
    console.log(
      `tail ${String(tail)} px, edges ${String(eL)} / ${String(eR)} px`,
    )
    expect(tail).toBeGreaterThanOrEqual(4)
    expect(eL).toBeGreaterThanOrEqual(4)
    expect(eR).toBeGreaterThanOrEqual(4)

    // drag the right page to θ 70° and hold: the top edge of the leaf's photo is a curve
    const spine = b.x + b.width / 2
    const x0 = spine + 0.4 * b.width,
      x1 = spine + (b.width / 2) * Math.cos((70 * Math.PI) / 180)
    await page.mouse.move(x0, b.y + b.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(x0 + ((x1 - x0) * i) / 10, b.y + b.height / 2)
    const leaf = page.getByTestId('ps-leaf')
    await expect(leaf).toHaveAttribute('data-leaf', 'paper')
    const th = Number(await leaf.getAttribute('data-theta'))
    expect(Math.abs(th - 70)).toBeLessThanOrEqual(1)
    // the leaf's back and the page under it have their canvases
    await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
      'data-faces',
      'done',
    )
    // from the window top down to mid-page: the lifted leaf rises past the v8 room's header row
    const top = await shot(page, {
      x: Math.round(spine),
      y: 0,
      width: Math.round(0.45 * b.width),
      height: Math.round(b.y + 0.45 * b.height),
    })
    await page.mouse.up()
    const { xs, ys, dev } = topEdge(top)
    console.log(
      `θ ${String(th)}: top edge ${xs.map((x, i) => `${String(x)},${String(ys[i])}`).join(' ')} dev ${dev.toFixed(1)}`,
    )
    expect(ys.every((v) => v > 0)).toBe(true)
    expect(dev).toBeGreaterThanOrEqual(3)
    expect(errors).toEqual([])
  })
})

test('?gl=0 keeps the CSS reader', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openRoom(page, '?gl=0')
  const reader = page.getByTestId('ps-reader')
  await expect(reader.locator('.sd-pg')).toHaveCount(2)
  await expect(page.getByTestId('ps-reader-canvas')).toHaveCount(0)
  const b = await box(reader)
  await reader.click({ position: { x: b.width * 0.75, y: b.height / 2 } })
  await expect(
    reader.locator('[data-testid="ps-leaf"][data-leaf="paper"]'),
  ).toBeAttached()
  await expect(reader).toHaveAttribute('data-view', '2')
  await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
})

// Designer Spec site-stand-v7 T (D33): the landing leaf is not overdrawn by the old page (T1); the leaf is not cut at
// the canvas top (T2). Paint is read from the reader canvas (a 2D copy of the GL frame).

type Probe = Window & {
  /** css px from the canvas top to its first row with alpha ≥ 200; Infinity when empty */
  alphaTop: () => number
  /** the viewport box of the canvas pixels with alpha ≥ 200 (the visible book); null when empty */
  alphaBox: () => { x: number; y: number; r: number; b: number } | null
  /** mean RGB of the 3×3 backing pixels at a viewport point */
  rgbAt: (x: number, y: number) => number[]
  tops?: number[]
  halt?: boolean
  restore?: () => void
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
  w.alphaBox = () => {
    const g = canvas()
    if (!g) return null
    const { c, x } = g,
      rc = c.getBoundingClientRect(),
      k = rc.width / c.width
    const d = x.getImageData(0, 0, c.width, c.height).data
    let x0 = c.width,
      y0 = c.height,
      x1 = -1,
      y1 = -1
    for (let y = 0; y < c.height; y++)
      for (let i = 0; i < c.width; i++)
        if ((d[4 * (y * c.width + i) + 3] ?? 0) >= 200) {
          if (i < x0) x0 = i
          if (i > x1) x1 = i
          if (y < y0) y0 = y
          y1 = y
        }
    if (x1 < 0) return null
    return {
      x: rc.x + x0 * k,
      y: rc.y + y0 * k,
      r: rc.x + (x1 + 1) * k,
      b: rc.y + (y1 + 1) * k,
    }
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

/** the T tests need WebGL2 (the CSS reader has no GL turn); the lane has it, as every GL test here assumes */
async function needWebGl2(page: Page) {
  const ok = await page.evaluate(
    () => !!document.createElement('canvas').getContext('webgl2'),
  )
  expect(ok, 'WebGL2 (the GL reader)').toBe(true)
}

/** open a book's room, resting on view 1 with every face drawn */
async function openBook(page: Page, id: string) {
  await page.addInitScript(installProbe)
  await page.goto(SITE)
  await needWebGl2(page)
  await page
    .locator(`[data-testid="ss9-book"][data-id="${id}"]`)
    .locator('visible=true')
    .first()
    .click()
  await settle(page, 1)
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
  return { spine: b.x + b.width / 2, pw: b.width / 2, y: b.y + b.height / 2 }
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

/** ΔRGB of a held pixel to the same row of the landed view, best within ±8 px: the tilted leaf maps its texture a few px
   off the flat page, which near a photo edge alone moves the colour past 12 */
async function nearest(page: Page, p: number[], x: number, y: number) {
  let best = Number.POSITIVE_INFINITY
  for (let dx = -8; dx <= 8; dx++)
    best = Math.min(best, dRgb(p, await rgbAt(page, x + dx, y)))
  return best
}

test.describe('desktop 1440×900: GL turn fixes (site-stand-v7 T)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('T1: the landing leaf shows its own page, not the old view (forward at view 9, backward at view 3)', async ({
    page,
  }) => {
    // eleven settled turns and two held drags
    test.setTimeout(120_000)
    const errors = collectErrors(page)
    await openBook(page, 'lake-trip')

    // forward: view 9 → 10, held at θ 165 and 175; the probe sits on the left page near the spine
    await goToView(page, 9)
    let g = await geometry(page)
    const left = { x: g.spine - 0.1 * g.pw, y: g.y }
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
    console.log(
      `T1 fwd: old ${old.map(Math.round).join(',')} held ${held.map((p) => p.map(Math.round).join(',')).join(' / ')} ΔRGB to landed ${fwd.map((d) => d.toFixed(1)).join(' / ')}`,
    )
    for (const d of fwd) expect(d).toBeLessThanOrEqual(12)
    // and not the old view's left page (this fixture's two pages differ there)
    for (const p of held) expect(dRgb(p, old)).toBeGreaterThan(12)

    // backward: view 3 → 2, held at θ 5; the probe sits on the right page near the spine
    await goToView(page, 3)
    g = await geometry(page)
    const right = { x: g.spine + 0.1 * g.pw, y: g.y }
    const old2 = await rgbAt(page, right.x, right.y)
    await page.mouse.move(g.spine - 0.8 * g.pw, g.y)
    await page.mouse.down()
    await holdAt(page, g, 5)
    const back = await rgbAt(page, right.x, right.y)
    await page.mouse.up()
    await settle(page, 2)
    await animationsSettled(page.getByTestId('ps-reader'))
    const bwd = await nearest(page, back, right.x, right.y)
    console.log(
      `T1 back: old ${old2.map(Math.round).join(',')} held ${back.map(Math.round).join(',')} ΔRGB to landed ${bwd.toFixed(1)}`,
    )
    expect(bwd).toBeLessThanOrEqual(12)
    expect(dRgb(back, old2)).toBeGreaterThan(12)
    expect(errors).toEqual([])
  })

  for (const id of ['coast', 'lake-trip', 'summer-family'])
    test(`T2: ${id}: the leaf stays below the canvas top, opening and θ 45…135`, async ({
      page,
    }) => {
      // a 6× slowed opening sampled per frame, then 19 held θ: past 90 s when the lane runs in parallel
      test.setTimeout(180_000)
      const errors = collectErrors(page)
      await page.addInitScript(installProbe)
      await page.goto(SITE)
      await needWebGl2(page)
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
      await page
        .locator(`[data-testid="ss9-book"][data-id="${id}"]`)
        .locator('visible=true')
        .first()
        .click()
      await settle(page, 1, 30_000)
      const opening = await page.evaluate(() => {
        const w = window as unknown as Probe
        w.halt = true
        w.restore?.()
        return (w.tops ?? []).filter((t) => Number.isFinite(t))
      })
      const g = await geometry(page)
      const turn = await sweep(page, g)
      // the leaf may rise over the head (stand-v8 drops D31's viewport floor): only the canvas must not cut it
      const cy = (await box(page.getByTestId('ps-reader-canvas'))).y
      const floor = 2
      console.log(
        `T2 ${id}: W ${(2 * g.pw).toFixed(1)}, canvas y ${cy.toFixed(1)}, opening ${String(opening.length)} frames min ${Math.min(...opening).toFixed(1)}, leaf ${turn.map((t) => t.toFixed(1)).join(' ')}`,
      )
      expect(opening.length).toBeGreaterThanOrEqual(15)
      expect(Math.min(...opening)).toBeGreaterThanOrEqual(floor)
      expect(Math.min(...turn)).toBeGreaterThanOrEqual(floor)
      expect(errors).toEqual([])
    })
})

/** the viewport box of the reader canvas's painted pixels (alpha ≥ 200) */
async function paintBox(page: Page) {
  const bb = await page.evaluate(() => (window as unknown as Probe).alphaBox())
  if (!bb) throw new Error('nothing painted')
  return bb
}

/** the rows of `b` where no pixel moved more than 12 in any channel from `a` (same clip) */
function stillRows(a: Img, b: Img) {
  const out: number[] = []
  for (let y = 0; y < b.h; y++) {
    const row = 4 * y * b.w
    const moved = b.a
      .slice(row, row + 4 * b.w)
      .some((v, i) => i % 4 < 3 && Math.abs(v - (a.a[row + i] ?? 0)) > 12)
    if (!moved) out.push(y)
  }
  return out
}

// stand-v8 (Owner 2026-11-07): the open book (its painted GL pixels) sits in the exact centre of the area between the
// head (bottom y 44) and the foot row (top h − 54), as large as fits ≥ 32 above / below and ≥ 64 each side
for (const [vw, vh] of [
  [1440, 900],
  [1280, 800],
  [1920, 1080],
] as const)
  test.describe(`desktop ${String(vw)}×${String(vh)}: the book centred (stand-v8)`, () => {
    test.use({ viewport: { width: vw, height: vh } })
    for (const id of ['coast', 'lake-trip', 'summer-family'])
      test(`${id}: centred, equal margins, as large as fits`, async ({
        page,
      }) => {
        const errors = collectErrors(page)
        await page.addInitScript(installProbe)
        await page.goto(`${SITE}?book=${id}`)
        await needWebGl2(page)
        await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
          'data-faces',
          'done',
          { timeout: 20_000 },
        )
        // a direct link rests on the cover (D41); Next turns to view 1
        await settle(page, 0)
        await page.getByTestId('ss-next').click()
        await settle(page, 1)
        await page.mouse.move(0, 0)
        await animationsSettled(page.getByTestId('ps-reader'))
        const foot = (await box(page.getByTestId('site-label').locator('..'))).y
        expect(foot).toBeCloseTo(vh - 54, 0)
        const bb = await paintBox(page)
        const above = bb.y - 44,
          below = foot - bb.b,
          left = bb.x,
          right = vw - bb.r
        const rb = await box(page.getByTestId('ps-reader')),
          W = rb.width
        console.log(
          `v8 ${String(vw)}×${String(vh)} ${id}: W ${W.toFixed(1)} kx ${((bb.r - bb.x) / W).toFixed(5)} ky ${((bb.b - bb.y) / rb.height).toFixed(5)} ty ${((bb.y - rb.y) / rb.height).toFixed(5)} cx ${((bb.x + bb.r) / 2 - rb.x - W / 2).toFixed(2)}, book ${(bb.r - bb.x).toFixed(1)} × ${(bb.b - bb.y).toFixed(1)}, margins ${above.toFixed(1)} / ${below.toFixed(1)}, sides ${left.toFixed(1)} / ${right.toFixed(1)}`,
        )
        expect(Math.abs((bb.x + bb.r) / 2 - vw / 2)).toBeLessThanOrEqual(1)
        expect(
          Math.abs((bb.y + bb.b) / 2 - (44 + foot) / 2),
        ).toBeLessThanOrEqual(1)
        expect(Math.abs(above - below)).toBeLessThanOrEqual(1)
        expect(Math.min(above, below)).toBeGreaterThanOrEqual(31)
        expect(Math.min(left, right)).toBeGreaterThanOrEqual(63)
        // as large as fits: one of the two limits is reached
        expect(Math.min(above - 32, left - 64)).toBeLessThanOrEqual(1)
        expect(errors).toEqual([])
      })
  })

// stand-v8: the centred book leaves its leaf room to rise over the head and past the window top; the canvas overhang
// (0.21·W) never cuts it, so at θ 90 every row from the book's top edge up to y 0 shows the leaf over the spine
test.describe('desktop 1440×900: the leaf at θ 90 (stand-v8)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  for (const id of ['coast', 'lake-trip'])
    test(`${id}: the leaf is painted from the book up to the window top`, async ({
      page,
    }) => {
      const errors = collectErrors(page)
      await page.addInitScript(installProbe)
      await page.goto(`${SITE}?book=${id}`)
      await needWebGl2(page)
      await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
        'data-faces',
        'done',
        { timeout: 20_000 },
      )
      // a direct link rests on the cover (D41); Next turns to view 1
      await settle(page, 0)
      await page.getByTestId('ss-next').click()
      await settle(page, 1)
      await page.mouse.move(0, 0)
      await animationsSettled(page.getByTestId('ps-reader'))
      const bb = await paintBox(page)
      const g = await geometry(page)
      const clip = {
        x: Math.round(g.spine - g.pw / 4),
        y: 0,
        width: Math.round(g.pw / 2),
        height: Math.floor(bb.y) - 4,
      }
      const rest = await shot(page, clip)
      await page.mouse.move(g.spine + 0.8 * g.pw, g.y)
      await page.mouse.down()
      await holdAt(page, g, 90)
      const held = await shot(page, clip)
      await page.mouse.move(g.spine + 0.8 * g.pw, g.y, { steps: 6 })
      await page.mouse.up()
      const bare = stillRows(rest, held)
      console.log(
        `v8 leaf90 ${id}: book top ${bb.y.toFixed(1)}, rows without leaf ${String(bare.length)} / ${String(held.h)}`,
      )
      expect(bare).toEqual([])
      expect(errors).toEqual([])
    })
})
