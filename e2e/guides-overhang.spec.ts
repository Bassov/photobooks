import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'

// parent-guides-prod-overhang (PG1): a guide runs 24 px past the page on
// every side, own and parent alike, on the pasteboard and the Masters canvas,
// while the paper keeps clipping its own content at the slot box.
// `&parent=a` puts Master A on all 40 painter spreads (300 mm trim).
const PAINTER = '/?fixture=painter&parent=a'
const OVERHANG_PX = 24

test.use({ viewport: { width: 1440, height: 900 } })

const slot = (page: Page, id: string) =>
  page
    .getByTestId('pasteboard-scroll')
    .locator(`[data-pasteboard-slot][data-spread-id="${id}"]`)
const paperOf = (page: Page, id: string) =>
  slot(page, id).getByTestId('spread-view')
const masterCanvas = (page: Page) => page.getByTestId('masters-canvas')

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (rect === null) throw new Error('not visible')
  return rect
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
}

/**
 * Pull one guide of each orientation from `host`'s rulers onto `paper`: a
 * horizontal at `across` of the height, a vertical at `down` of the width.
 */
async function pullBoth(
  page: Page,
  host: Locator,
  paper: Locator,
  { across, down }: { across: number; down: number },
) {
  // A spread-list reveal may still be scrolling: wait for the paper to rest.
  await expect
    .poll(() =>
      paper.evaluate(async (el) => {
        const before = el.getBoundingClientRect().top
        await new Promise((done) => {
          requestAnimationFrame(() => requestAnimationFrame(done))
        })
        return el.getBoundingClientRect().top === before
      }),
    )
    .toBe(true)
  const spread = await box(paper)
  const rulerX = await box(host.getByTestId('ruler-x'))
  const rulerY = await box(host.getByTestId('ruler-y'))
  const x = spread.x + spread.width * 0.4
  await drag(
    page,
    { x, y: rulerX.y + rulerX.height / 2 },
    { x, y: spread.y + spread.height * across },
  )
  const y = spread.y + spread.height * 0.55
  await drag(
    page,
    { x: rulerY.x + rulerY.width / 2, y },
    { x: spread.x + spread.width * down, y },
  )
}

type End = 'start' | 'end'

/**
 * One end of a line, 12 px past the page edge: how far the line runs past the
 * page there, and whether a hit test there finds the line (clips included).
 * A point outside the scrollport is scrolled to its middle first.
 */
async function probeEnd(line: Locator, end: End) {
  return line.evaluate(async (el, which) => {
    const paper = el
      .closest('.spread-stage')
      ?.querySelector('[data-testid="spread-view"]')
    if (paper == null) throw new Error('no paper beside the line')
    const vertical = el.getAttribute('data-orientation') === 'vertical'
    const start = which === 'start'
    const measure = () => {
      const p = paper.getBoundingClientRect()
      const l = el.getBoundingClientRect()
      return {
        x: vertical ? l.left + l.width / 2 : start ? p.left - 12 : p.right + 12,
        y: vertical
          ? start
            ? p.top - 12
            : p.bottom + 12
          : l.top + l.height / 2,
        overhang: vertical
          ? start
            ? p.top - l.top
            : l.bottom - p.bottom
          : start
            ? p.left - l.left
            : l.right - p.right,
      }
    }
    const frames = () =>
      new Promise((done) => {
        requestAnimationFrame(() => requestAnimationFrame(done))
      })
    const port = el.closest('[data-testid="pasteboard-scroll"]')
    const scrolled = { left: port?.scrollLeft ?? 0, top: port?.scrollTop ?? 0 }
    if (port !== null) {
      const at = measure()
      const r = port.getBoundingClientRect()
      const inside =
        at.x > r.left + 4 &&
        at.x < r.right - 4 &&
        at.y > r.top + 4 &&
        at.y < r.bottom - 4
      if (!inside) {
        port.scrollBy({
          left: at.x - (r.left + r.width / 2),
          top: at.y - (r.top + r.height / 2),
          behavior: 'instant',
        })
        await frames()
      }
    }
    const at = measure()
    const probe = {
      overhang: Math.round(at.overhang),
      hit: document.elementFromPoint(at.x, at.y) === el,
    }
    // Leave the view as it was, so later pulls land where they aim.
    port?.scrollTo({ ...scrolled, behavior: 'instant' })
    await frames()
    return probe
  }, end)
}

/** Every line in `lines` reaches 24 px past the page at both ends, visibly. */
async function expectOverhangEverywhere(lines: Locator, orientations = 2) {
  await expect(lines).toHaveCount(orientations)
  for (const line of await lines.all()) {
    for (const end of ['start', 'end'] as const) {
      const probe = await probeEnd(line, end)
      const where = `${String(await line.getAttribute('data-orientation'))} ${end}`
      expect(probe, where).toEqual({ overhang: OVERHANG_PX, hit: true })
    }
  }
}

async function zoomIn(page: Page, paper: Locator) {
  const fit = await box(paper)
  await dispatchCtrlWheel(page, -120, 6)
  await expect
    .poll(async () => (await box(paper)).width)
    .toBeGreaterThan(fit.width * 1.5)
}

/**
 * Parent lines are pointer-transparent: let the hit test see them while
 * probing (clips still apply), then restore them.
 */
async function expectParentOverhang(page: Page, lines: Locator) {
  const style = await page.addStyleTag({
    content:
      '.guide-line[data-layer="parent"] { pointer-events: auto !important; }',
  })
  await expectOverhangEverywhere(lines)
  await style.evaluate((el) => {
    el.parentNode?.removeChild(el)
  })
}

test('Browser check: guides overhang the page by 24 px on all four sides — Masters, parent, own, page 1, Fit and zoomed', async ({
  page,
}) => {
  await page.goto(PAINTER)
  const two = 'painter-spread-2'
  await page.getByTestId(`spread-list-item-${two}`).click()
  await expect(paperOf(page, two)).toBeVisible()
  // Empty: no guide anywhere yet, so nothing overhangs.
  await expect(page.locator('.guide-line')).toHaveCount(0)

  // Masters canvas: two master guides, both overhang all around.
  await page.getByTestId('left-tab-masters').click()
  const master = masterCanvas(page)
  await expect(master.getByTestId('spread-view')).toBeVisible()
  await page.keyboard.press('Shift+R')
  // The vertical lands on the right page, so page 1 shows it too.
  await pullBoth(page, master, master.getByTestId('spread-view'), {
    across: 0.3,
    down: 0.75,
  })
  await expectOverhangEverywhere(master.getByTestId('guide-line'))

  // A Master A child shows them dashed: same overhang at Fit.
  await page.getByTestId('left-tab-pages').click()
  await page.getByTestId(`spread-list-item-${two}`).click()
  const parents = slot(page, two).getByTestId('guide-line-parent')
  await expectParentOverhang(page, parents)
  await assertDocumentFitsViewport(page)

  // Own guides beside them, at Fit.
  const scroll = page.getByTestId('pasteboard-scroll').locator('..')
  await pullBoth(page, scroll, paperOf(page, two), { across: 0.45, down: 0.6 })
  const own = slot(page, two).getByTestId('guide-line')
  await expectOverhangEverywhere(own)

  // Page 1 (right half of its slot): the master's right-page vertical and
  // its horizontal overhang on all sides too.
  const first = 'painter-spread-0'
  await page.getByTestId(`spread-list-item-${first}`).click()
  await expectParentOverhang(
    page,
    slot(page, first).getByTestId('guide-line-parent'),
  )

  // Zoomed far past Fit: own and parent still overhang 24 screen px.
  await page.getByTestId(`spread-list-item-${two}`).click()
  await zoomIn(page, paperOf(page, two))
  await expectOverhangEverywhere(own)
  await expectParentOverhang(page, parents)
  await assertDocumentFitsViewport(page)
})

test('the paper still clips its own content at the slot box', async ({
  page,
}) => {
  await page.goto(PAINTER)
  const id = 'painter-spread-2'
  await page.getByTestId(`spread-list-item-${id}`).click()
  const paper = paperOf(page, id)
  await expect(paper).toBeVisible()
  // The paper's clip is the slot box it had before the guide margin: page
  // edges, the gap below, and on page 1 the empty left half.
  for (const [spreadId, left] of [
    [id, 0],
    ['painter-spread-0', -100],
  ] as const) {
    const clip = await paperOf(page, spreadId).evaluate((el) => {
      const slotEl = el.closest<HTMLElement>('[data-pasteboard-slot]')
      if (slotEl === null) throw new Error('no slot')
      const s = slotEl.getBoundingClientRect()
      const p = el.getBoundingClientRect()
      const inset = getComputedStyle(el).clipPath
      return {
        insets: inset.slice('inset('.length, -1).split(' '),
        gap: s.bottom - p.bottom,
        slotClipMargin: getComputedStyle(slotEl).overflowClipMargin,
      }
    })
    const [top, right, bottom, leftInset = right] = clip.insets
    expect([top, right, leftInset]).toEqual([
      '0px',
      '0px',
      left === 0 ? '0px' : '-100%',
    ])
    expect(Number.parseFloat(bottom ?? '')).toBeCloseTo(-clip.gap, 1)
    expect(clip.slotClipMargin).toBe(`${String(OVERHANG_PX)}px`)
  }

  // A frame moved 10 mm past the page top: its part above the page is cut
  // (the hit test there misses it), its part on the page is not.
  const frame = paper.locator('button.spread-frame').first()
  await frame.click()
  await page.getByRole('button', { name: 'Position & size' }).click()
  const y = page.getByRole('textbox', { name: 'Y', exact: true })
  await y.fill('-10')
  await y.press('Enter')
  await expect
    .poll(async () => (await box(frame)).y < (await box(paper)).y - 12)
    .toBe(true)
  const hits = await frame.evaluate((el) => {
    const paperEl = el.closest('[data-testid="spread-view"]')
    if (paperEl === null) throw new Error('no paper')
    const p = paperEl.getBoundingClientRect()
    const f = el.getBoundingClientRect()
    // Away from the selection handles at the frame's corners and middles.
    const x = f.left + f.width / 4
    const inFrame = (yAt: number) =>
      document.elementFromPoint(x, yAt)?.closest('button.spread-frame') === el
    return { above: inFrame(p.top - 6), on: inFrame(p.top + 6) }
  })
  expect(hits).toEqual({ above: false, on: true })
})
