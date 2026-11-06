import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { white } from './fixtures/sitePagePaint'

// GL core (Designer Spec site-stand-v2 G, D1): the closed book is drawn by one shared three.js renderer into a canvas
// over the host box; `?gl=0` keeps the CSS book. Paint is read from clipped screenshots decoded in the page.

interface Img {
  w: number
  h: number
  a: number[]
}
interface Clip {
  x: number
  y: number
  width: number
  height: number
}
type Rgb = [number, number, number]

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
const at = (a: number[], i: number) => a[i] ?? 0
const px = (m: Img, x: number, y: number): Rgb => {
  const i = (y * m.w + x) * 4
  return [at(m.a, i), at(m.a, i + 1), at(m.a, i + 2)]
}
const lum = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b
const dist = (p: Rgb, q: Rgb) =>
  Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2])
const far = (p: Rgb, q: Rgb) => dist(p, q) > 12

/** the first visible GL book, drawn */
async function glBook(page: Page): Promise<Locator> {
  const book = page
    .locator('[data-testid="book3d"][data-gl="ready"]')
    .locator('visible=true')
    .first()
  await expect(book).toBeVisible()
  await page.waitForTimeout(300)
  return book
}
/** the host box grown by the canvas overhang (left .15 W, right .35 W, top .1 H, bottom .12 H) */
async function around(book: Locator): Promise<Clip> {
  const r = await book.boundingBox()
  if (!r) throw new Error('no book box')
  return {
    x: r.x - 0.15 * r.width,
    y: r.y - 0.1 * r.height,
    width: r.width * 1.5,
    height: r.height * 1.22,
  }
}

/** Spec G head check: dashes in the 120×40 crop at the top-right corner (a pixel > 240 between neighbours < 200), the
   bg → book transition per column (the run until the column settles), and the page block's light run at 35/50/65 %. */
function headStats(m: Img) {
  const bg = px(m, 0, 0)
  const top = [...Array(m.w).keys()].map(
    (x) =>
      [...Array(Math.floor(m.h * 0.4)).keys()].find((y) =>
        far(px(m, x, y), bg),
      ) ?? -1,
  )
  const cols = top.flatMap((y, x) => (y >= 0 ? [x] : []))
  const left = at(cols, 0),
    right = at(cols, cols.length - 1)
  const x0 = right - 119,
    y0 = Math.min(...top.slice(x0, right + 1).filter((y) => y >= 0)) - 4
  let dashes = 0
  for (let y = y0; y < y0 + 40; y++)
    for (let x = x0 + 1; x < right; x++)
      if (
        lum(px(m, x, y)) > 240 &&
        lum(px(m, x - 1, y)) < 200 &&
        lum(px(m, x + 1, y)) < 200
      )
        dashes++
  const trans: number[] = []
  for (let x = x0; x <= right; x++) {
    const y = at(top, x)
    let n = 1
    while (
      n < 8 &&
      Math.abs(lum(px(m, x, y + n)) - lum(px(m, x, y + n - 1))) >= 4
    )
      n++
    trans.push(n)
  }
  // a near-flat edge crosses a pixel boundary in a few columns: the edge width is the median column
  trans.sort((p, q) => p - q)
  const counts = trans.reduce<Record<number, number>>(
    (c, n) => ({ ...c, [n]: (c[n] ?? 0) + 1 }),
    {},
  )
  const head = [0.35, 0.5, 0.65].map((f) => {
    const x = Math.round(left + (right - left) * f)
    let run = 0,
      best = 0
    for (let y = at(top, x); y < at(top, x) + 40; y++) {
      const p = px(m, x, y)
      run =
        Math.min(...p) > 140 && Math.max(...p) - Math.min(...p) < 30
          ? run + 1
          : 0
      best = Math.max(best, run)
    }
    return best
  })
  return {
    dashes,
    transMin: at(trans, 0),
    median: at(trans, trans.length >> 1),
    counts,
    head,
  }
}
/** share of pixels unlike the crop's top-left (background) pixel, and the host-centre pixel */
function paint(m: Img) {
  const bg = px(m, 0, 0)
  let n = 0
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) if (far(px(m, x, y), bg)) n++
  return {
    share: n / (m.w * m.h),
    centre: px(
      m,
      Math.round((m.w * 0.65) / 1.5),
      Math.round((m.h * 0.6) / 1.22),
    ),
  }
}
const moved = (a: Img, b: Img) => {
  let n = 0
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) if (dist(px(a, x, y), px(b, x, y)) > 30) n++
  return n / (a.w * a.h)
}
const loaded = (page: Page) =>
  page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name),
  )
const isThree = (f: string) => /three\.module\.min\.js(\?|$)/.test(f)

test('demo 7 (1440): the closed book head has no dashes, a soft top edge and a ≥ 4 px page block', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/full/site-demo-7')
  const s = headStats(await shot(page, await around(await glBook(page))))
  test.info().annotations.push({ type: 'head', description: JSON.stringify(s) })
  expect(s.dashes).toBe(0)
  expect(s.median).toBeGreaterThanOrEqual(2)
  expect(Math.min(...s.head)).toBeGreaterThanOrEqual(4)
})

// demo 7's phone home lists thumbs (no Book3D); fresh C left the stand (site-stand-v2 D9)
for (const [w, h, slug] of [
  [1440, 900, 'site-demo-6'],
  [1440, 900, 'site-demo-7'],
  [390, 844, 'site-demo-6'],
] as const) {
  test(`${slug} (${String(w)}): the GL book paints, three loads as its own file, no console errors`, async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`/uikit/#/full/${slug}`)
    const book = await glBook(page)
    await expect(page.locator('.sd-b3')).toHaveCount(0)
    const p = paint(await shot(page, await around(book)))
    test
      .info()
      .annotations.push({ type: 'paint', description: JSON.stringify(p) })
    expect(p.share).toBeGreaterThan(0.3)
    expect(white(p.centre)).toBe(false)
    expect((await loaded(page)).some(isThree)).toBe(true)
    expect(errors).toEqual([])
  })
}

test('demo 6: hover turns, lifts and peeks the GL book', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/full/site-demo-6')
  const clip = await around(await glBook(page))
  const rest = await shot(page, clip)
  await page.getByTestId('ss6-book').locator('visible=true').first().hover()
  await page.waitForTimeout(900)
  expect(moved(rest, await shot(page, clip))).toBeGreaterThan(0.05)
})

/** the lowest viewport y in `clip` where the GL canvases paint: the clip shot with the canvases shown vs hidden */
async function lowestBookY(page: Page, clip: Clip) {
  const on = await shot(page, clip)
  const hide = await page.addStyleTag({
    content: '[data-testid="book3d-gl"]{visibility:hidden!important}',
  })
  const off = await shot(page, clip)
  await hide.evaluate((n) => {
    n.parentNode?.removeChild(n)
  })
  for (let y = on.h - 1; y >= 0; y--)
    for (let x = 0; x < on.w; x++)
      if (dist(px(on, x, y), px(off, x, y)) > 60) return clip.y + y
  return -Infinity
}
async function boxOf(l: Locator): Promise<Clip> {
  const r = await l.boundingBox()
  if (!r) throw new Error('no box')
  return r
}
/** rows in `clip` that carry caption ink (a pixel far brighter than the row's background) */
async function inkRows(page: Page, clip: Clip) {
  const m = await shot(page, clip)
  const rows: number[] = []
  for (let y = 0; y < m.h; y++) {
    const bg = lum(px(m, 0, y))
    for (let x = 0; x < m.w; x++)
      if (lum(px(m, x, y)) - bg > 40) {
        rows.push(y)
        break
      }
  }
  return rows
}

// site-stand-v3 W3 / D10: one caption row (meta only) at floor + ⌈0.09 · w_max · s⌉ + 20, clear of every book by ≥ 20
test('demo 6 (1440): one meta-only caption row 20 px clear of the lowest book pixel, at rest and on hover', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/full/site-demo-6')
  await glBook(page)
  const books = page.getByTestId('ss6-book').locator('visible=true')
  const labels = page.locator('.ss6-label').locator('visible=true')
  const tops = await labels.evaluateAll((ls) =>
    ls.map((l) => Math.round(l.getBoundingClientRect().top)),
  )
  expect(new Set(tops)).toEqual(new Set([698]))
  const capY = 698
  const floor = Math.round((640 * 900) / 900)
  const strip = { x: 0, y: floor + 1, width: 1440, height: capY - floor - 1 }
  const rest = await lowestBookY(page, strip)
  const hovered: number[] = []
  for (let i = 0; i < (await books.count()); i++) {
    await books.nth(i).hover()
    await page.waitForTimeout(700)
    hovered.push(await lowestBookY(page, strip))
  }
  test.info().annotations.push({
    type: 'paint',
    description: JSON.stringify({ capY, rest, hovered }),
  })
  expect(rest + 20).toBeLessThanOrEqual(capY)
  expect(Math.max(...hovered) + 20).toBeLessThanOrEqual(capY)
  await page.mouse.move(720, 120)
  const box = await boxOf(labels.first())
  const ink = await inkRows(page, {
    x: box.x,
    y: capY - 4,
    width: box.width,
    height: 60,
  })
  expect(ink.length).toBeGreaterThan(0)
  expect(Math.max(...ink) - Math.min(...ink)).toBeLessThan(16)
  await expect(labels.first()).not.toContainText(
    (await books.first().getAttribute('aria-label'))?.split(',')[0] ?? '?',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1440,
  )
  expect(errors).toEqual([])
})

test('demo 6 (390): the phone caption is the meta line only, 20 px clear of the book', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/uikit/#/full/site-demo-6')
  await glBook(page)
  const screen = page.locator('.ss6-screen').first()
  await expect(screen.locator('.m28')).toHaveCount(0)
  const meta = screen.locator('.t13.g').first()
  const box = await boxOf(meta)
  const base = Math.round((520 * 844) / 844)
  const low = await lowestBookY(page, {
    x: 0,
    y: base + 1,
    width: 390,
    height: box.y - base - 1,
  })
  const ink = await inkRows(page, {
    x: box.x,
    y: box.y - 4,
    width: box.width,
    height: box.height + 8,
  })
  test.info().annotations.push({
    type: 'paint',
    description: JSON.stringify({ capY: box.y, low, ink: ink.length }),
  })
  expect(low + 20).toBeLessThanOrEqual(box.y)
  expect(ink.length).toBeGreaterThan(0)
  expect(Math.max(...ink) - Math.min(...ink)).toBeLessThan(16)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  )
  expect(errors).toEqual([])
})

test('?gl=0 keeps the CSS book and never loads three', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/full/site-demo-7?gl=0')
  await expect(page.getByTestId('ss7-preview').locator('.sd-b3')).toHaveCount(1)
  await expect(page.getByTestId('book3d-gl')).toHaveCount(0)
  expect((await loaded(page)).some(isThree)).toBe(false)
})
