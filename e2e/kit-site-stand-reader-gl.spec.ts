import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// GL reader (Designer Spec site-stand-v2 R, D1, D2): the open book is drawn by three.js into one canvas over the reader
// box; `?gl=0` keeps the CSS reader. Paint is read from clipped screenshots decoded in the page.

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

/** demo 7: open the first book (Lake trip) in the reading room; resolves once the GL reader rests on view 1 */
async function openRoom(page: Page, query = '') {
  await page.goto(`/uikit/#/full/site-demo-7${query}`)
  // a click opens the room at the cover, which turns to view 1 at once
  await page.getByTestId('ss7-book').locator('visible=true').first().click()
  await expect(page.getByTestId('ps-reader')).toHaveAttribute('data-view', '1')
}

/** a 1-px line from outside the book inward: past the background and floor shadow (> 200) and the board (≤ 120), the
   page-block band = the run of pixels darker than the paper before the paper starts */
function band(line: number[], paper: number) {
  let i = 0
  while (i < line.length && (line[i] ?? 0) > 200) i++
  while (i < line.length && (line[i] ?? 0) <= 120) i++
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
    await page.waitForTimeout(1000)
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
    expect(sd).toBeGreaterThanOrEqual(2)

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
    await page.screenshot({ path: test.info().outputPath('gl-rest.png') })

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
    await page.waitForTimeout(500)
    // from under the site header down to mid-page
    const top = await shot(page, {
      x: Math.round(spine),
      y: 60,
      width: Math.round(0.45 * b.width),
      height: Math.round(b.y + 0.45 * b.height - 60),
    })
    await page.screenshot({ path: test.info().outputPath('gl-70.png') })
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

test.describe('phone 390×844', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('the pager pans the GL camera over one page', async ({ page }) => {
    const errors = collectErrors(page)
    await openRoom(page)
    const pager = page.getByTestId('ps-pager')
    await expect(pager).toHaveAttribute('data-side', 'R')
    await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
      'data-gl',
      'ready',
    )
    const canvas = page.getByTestId('ps-reader-canvas')
    const pb = await box(pager),
      cb = await box(canvas)
    // the canvas covers the pager box
    expect(Math.abs(cb.x - pb.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(cb.width - pb.width)).toBeLessThanOrEqual(1)
    await page.waitForTimeout(800)
    const centre = async () =>
      lums(
        await shot(page, {
          x: Math.round(pb.x + pb.width / 2 - 20),
          y: Math.round(pb.y + pb.height * 0.3),
          width: 40,
          height: 40,
        }),
      )
    // Page 1 (title page) fills the centre with paper
    const p1 = await centre()
    expect(Math.min(...p1)).toBeGreaterThanOrEqual(200)
    await page.screenshot({ path: test.info().outputPath('gl-phone-p1.png') })
    await page.getByTestId('ss-next').click()
    await expect(page.getByTestId('ss-label')).toHaveText(/^Page 2 of \d+$/)
    await expect(pager).toHaveAttribute('data-side', 'L')
    await page.waitForTimeout(800)
    // Page 2 is centred now: the camera moved with the pager (the canvas did not)
    const cb2 = await box(canvas)
    expect(Math.abs(cb2.x - pb.x)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: test.info().outputPath('gl-phone-p2.png') })
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
