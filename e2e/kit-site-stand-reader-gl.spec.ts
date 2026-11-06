import type { Locator, Page } from '@playwright/test'
import { animationsSettled } from './fixtures/animationsSettled'
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

/** demo 9 (the light room; demo 6's is dark): open Lake trip in the reading room; resolves once the GL reader rests on view 1 */
async function openRoom(page: Page, query = '') {
  await page.goto(`/uikit/#/full/site-demo-9${query}`)
  // a click opens the room at the cover, which turns to view 1 at once
  await page
    .locator('[data-testid="ss9-book"][data-id="lake-trip"]')
    .locator('visible=true')
    .click()
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
    // the leaf's back and the page under it have their canvases
    await expect(page.getByTestId('ps-reader-gl')).toHaveAttribute(
      'data-faces',
      'done',
    )
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

// site-stand-v6 G (D28): the phone Page turn draws its sheets in WebGL (`pt-gl`), at rest too; the DOM sheets stay hidden
test.describe('phone 390×844: page turn GL', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const turnUrl = (gl: boolean) =>
    `/uikit/#/full/site-demo-6?book=lake-trip${gl ? '' : '&gl=0'}&reader=turn`
  const near = (a: number, b: number, d = 0.5) => {
    expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(
      d,
    )
  }
  /** Next (a 600 ms turn, the label moves at its commit) until the label reads `label`; then the stage rests */
  async function nextTo(page: Page, label: string) {
    const room = page.getByTestId('ss-reader-page')
    const lbl = room.getByTestId('ss-label')
    while ((await lbl.innerText()) !== label) {
      const was = await lbl.innerText()
      await room.getByTestId('ss-next').click()
      await expect(lbl).not.toHaveText(was)
    }
    await expect(room.getByTestId('pt-stage')).toHaveAttribute('data-xm', '')
  }
  /** a held one-finger touch (CDP) */
  async function touch(page: Page, x: number, y: number) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    })
    let at = { x, y }
    return {
      async move(tx: number, ty: number) {
        const from = at
        for (let i = 1; i <= 12; i++) {
          at = {
            x: from.x + ((tx - from.x) * i) / 12,
            y: from.y + ((ty - from.y) * i) / 12,
          }
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ ...at, id: 1 }],
          })
        }
      },
      async up() {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        })
        await cdp.detach()
      },
    }
  }
  /** mean |Δ| per channel of two same-size images */
  const meanDelta = (a: Img, b: Img) => {
    const s = [0, 0, 0]
    for (let i = 0; i < a.w * a.h; i++)
      for (let c = 0; c < 3; c++)
        s[c] =
          (s[c] ?? 0) + Math.abs((a.a[4 * i + c] ?? 0) - (b.a[4 * i + c] ?? 0))
    return s.map((v) => v / (a.w * a.h))
  }
  const differing = (a: Img, b: Img) => {
    let n = 0
    for (let i = 0; i < a.w * a.h; i++)
      if (Math.abs(lumAt(a, i) - lumAt(b, i)) > 8) n++
    return n / (a.w * a.h)
  }

  test('the canvas draws the sheet at rest as the DOM does, the curl under a drag, a flat sheet after the commit', async ({
    page,
  }) => {
    // two pages (GL and the DOM fold), CDP touch drags on the GL curl: ~18 s alone, past 30 s beside other workers
    test.slow()
    const errors = collectErrors(page)
    await page.goto(turnUrl(true))
    const room = page.getByTestId('ss-reader-page')
    const stage = room.getByTestId('pt-stage')
    const lbl = room.getByTestId('ss-label')
    const canvas = stage.getByTestId('pt-gl')
    await expect(stage).toHaveAttribute('data-gl', '1', { timeout: 3000 })
    const c = await box(canvas)
    near(c.x, 0)
    near(c.y, 174.25)
    near(c.width, 390)
    near(c.height, 495.5)
    await expect(canvas).toBeVisible()
    for (const s of await stage.getByTestId('pt-sheet').all())
      await expect(s).toHaveCSS('visibility', 'hidden')

    // the title page's paper (Page 1), 40 × 40 above the title
    await expect(lbl).toHaveText('Page 1 of 22')
    const s = await box(stage)
    const title = lums(
      await shot(page, { x: 40, y: s.y + 40, width: 40, height: 40 }),
    )
    const tMean = title.reduce((a, v) => a + v, 0) / title.length
    expect(tMean).toBeGreaterThanOrEqual(250)

    // at rest on Page 4 = the DOM sheet at gl=0
    await nextTo(page, 'Page 4 of 22')
    await expect(canvas).toBeVisible()
    const clip = { x: 0, y: s.y, width: 390, height: s.height }
    const glRest = await shot(page, clip)
    const dom = await page.context().newPage()
    await dom.goto(turnUrl(false))
    await expect(dom.getByTestId('pt-stage')).toHaveAttribute('data-gl', '0')
    await nextTo(dom, 'Page 4 of 22')
    let delta = [255, 255, 255]
    await expect
      .poll(async () => {
        delta = meanDelta(glRest, await shot(dom, clip))
        return Math.max(...delta)
      })
      .toBeLessThanOrEqual(3)
    await dom.close()

    // a held edge drag 370 → 200 on Page 5: the flipped back at (221, 420), the stage differs from rest
    await nextTo(page, 'Page 5 of 22')
    await expect(canvas).toBeVisible()
    const rest = await shot(page, clip)
    const f = await touch(page, 370, 420)
    await f.move(200, 420)
    await expect
      .poll(async () => Number(await stage.getAttribute('data-xm')))
      .toBeCloseTo(222.4, 0)
    await expect(stage).toHaveAttribute('data-gl', '1')
    await expect(stage.getByTestId('pt-flap')).toHaveCount(0)
    const held = await shot(page, clip)
    const back = lumAt(
      await shot(page, { x: 221, y: 420, width: 1, height: 1 }),
      0,
    )
    expect(back).toBeGreaterThanOrEqual(200)
    expect(back).toBeLessThanOrEqual(250)
    const diff = differing(rest, held)
    expect(diff).toBeGreaterThanOrEqual(0.05)
    await page.screenshot({ path: test.info().outputPath('turn-gl-held.png') })

    // on past half way and released: the next slide, the canvas a flat sheet again
    await f.move(30, 420)
    await f.up()
    await expect(lbl).toHaveText('Page 6 of 22')
    await expect(stage).toHaveAttribute('data-xm', '')
    await expect(canvas).toBeVisible()
    const after = await shot(page, clip)
    // flat: the margins left and right of the sheet are the room's again, as at rest
    for (const x of [4, 384]) {
      const col = (m: Img) => ({
        w: 1,
        h: m.h,
        a: Array.from({ length: m.h }, (_, y) =>
          m.a.slice(4 * (y * m.w + x), 4 * (y * m.w + x) + 4),
        ).flat(),
      })
      expect(Math.max(...meanDelta(col(rest), col(after)))).toBeLessThanOrEqual(
        1,
      )
    }
    test.info().annotations.push({
      type: 'paint',
      description: `title paper lum ${tMean.toFixed(1)}; rest vs gl=0 mean |Δ| ${delta.map((v) => v.toFixed(2)).join('/')}; held back lum ${back.toFixed(1)}, ${(diff * 100).toFixed(1)} % of the stage differs`,
    })
    expect(errors).toEqual([])
  })

  test('gl=0: no canvas, the CSS fold', async ({ page }) => {
    await page.goto(turnUrl(false))
    const stage = page.getByTestId('pt-stage')
    await expect(stage).toHaveAttribute('data-gl', '0')
    await expect(stage.getByTestId('pt-gl')).toHaveCount(0)
  })
})
