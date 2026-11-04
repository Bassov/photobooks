import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'

// parent-spreads-inspector-guides (Designer MS10): the master's guides on the
// Masters canvas, pulled from its rulers. `&parent=a` puts Master A on all 40
// painter spreads.
const PAINTER = '/?fixture=painter&parent=a'

test.use({ viewport: { width: 1440, height: 900 } })

const masterCanvas = (page: Page) => page.getByTestId('masters-canvas')
const masterSpread = (page: Page) =>
  masterCanvas(page).getByTestId('spread-view')
const masterGuides = (page: Page) =>
  masterCanvas(page).getByTestId('guide-line')
const masterRuler = (page: Page) => masterCanvas(page).getByTestId('ruler-x')
const masterRulerY = (page: Page) => masterCanvas(page).getByTestId('ruler-y')
const canvasSpread = (page: Page, id: string) =>
  page
    .getByTestId('pasteboard-scroll')
    .locator(`[data-testid="spread-view"][data-spread-id="${id}"]`)
/** The painter book is 300 × 300 mm trim: a two-page spread is 600 mm wide. */
const TRIM_MM = 300

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (rect === null) throw new Error('not visible')
  return rect
}

async function middleOf(locator: Locator) {
  const rect = await box(locator)
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
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

async function openMasters(page: Page) {
  await page.getByTestId('left-tab-masters').click()
  await expect(masterSpread(page)).toBeVisible()
}

async function showRulers(page: Page) {
  await page.keyboard.press('Shift+R')
  await expect(masterRuler(page)).toBeVisible()
}

/** Pull a horizontal guide from the master's top ruler to `fraction` of the spread height. */
async function pullOnMaster(page: Page, fraction: number) {
  const spread = await box(masterSpread(page))
  const ruler = await middleOf(masterRuler(page))
  const x = spread.x + spread.width * 0.25
  await drag(
    page,
    { x, y: ruler.y },
    { x, y: spread.y + spread.height * fraction },
  )
}

/** Pull a vertical guide from the master's left ruler to `fraction` of the spread width. */
async function pullVerticalOnMaster(page: Page, fraction: number) {
  const spread = await box(masterSpread(page))
  const ruler = await middleOf(masterRulerY(page))
  const y = spread.y + spread.height * 0.6
  await drag(
    page,
    { x: ruler.x, y },
    { x: spread.x + spread.width * fraction, y },
  )
}

async function offsetMm(line: Locator): Promise<number> {
  return Number(await line.getAttribute('data-offset-mm'))
}

test('Browser check: a top-ruler drag onto Master A adds a master guide, not a spread guide', async ({
  page,
}) => {
  await page.goto(PAINTER)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await openMasters(page)
  await expect(masterCanvas(page)).toHaveAttribute('data-rulers', 'false')
  await expect(masterGuides(page)).toHaveCount(0)

  await showRulers(page)
  await expect(masterCanvas(page)).toHaveAttribute('data-rulers', 'true')
  // Kit `r = RULER`: the fitted spread sits inside the 22 px strips.
  const stage = await box(masterCanvas(page))
  const spread = await box(masterSpread(page))
  expect(spread.x).toBeGreaterThan(stage.x + 22)
  expect(spread.y).toBeGreaterThan(stage.y + 22)
  expect(
    Number(await masterRuler(page).getAttribute('data-origin')),
  ).toBeCloseTo(spread.x - stage.x - 22, 0)

  await pullOnMaster(page, 0.5)
  await expect(masterGuides(page)).toHaveCount(1)
  const line = masterGuides(page)
  await expect(line).toHaveAttribute('data-orientation', 'horizontal')
  // Spread guide look: 1 px, 24 px past the page on both sides, at the drop.
  const drawn = await box(line)
  expect(drawn.height).toBeCloseTo(1, 0)
  expect(drawn.x).toBeCloseTo(spread.x - 24, 0)
  expect(drawn.width).toBeCloseTo(spread.width + 48, 0)
  expect(Math.abs(drawn.y - (spread.y + spread.height * 0.5))).toBeLessThan(2)
  expect(await offsetMm(line)).toBeGreaterThan(0)
  await assertDocumentFitsViewport(page)

  // The guide lives on the parent: Pages shows it as a parent line, no spread guide.
  const placed = await offsetMm(line)
  await page.getByTestId('left-tab-pages').click()
  await expect(masterCanvas(page)).toHaveCount(0)
  await expect(
    page.getByTestId('pasteboard-scroll').getByTestId('guide-line'),
  ).toHaveCount(0)
  const child = canvasSpread(page, 'painter-spread-2')
  await page.getByTestId('spread-list-item-painter-spread-2').click()
  await expect(child.getByTestId('guide-line-parent')).toHaveCount(1)
  const parentLine = child.getByTestId('guide-line-parent')
  expect(await offsetMm(parentLine)).toBe(placed)
  const childBox = await box(child)
  const at = await middleOf(parentLine)
  expect(at.y).toBeCloseTo(childBox.y + (placed / TRIM_MM) * childBox.height, 0)
  await openMasters(page)
  await expect(masterGuides(page)).toHaveCount(1)
})

const parentLines = (page: Page, id: string) =>
  canvasSpread(page, id).getByTestId('guide-line-parent')
const ownLines = (page: Page, id: string) =>
  canvasSpread(page, id).getByTestId('guide-line')

async function showSpread(page: Page, id: string) {
  await page.getByTestId(`spread-list-item-${id}`).click()
  await expect(canvasSpread(page, id)).toBeVisible()
}

/** Middle of the first right-page photo frame, as fractions of the spread box. */
async function rightPageFrame(page: Page, id: string) {
  const spread = await box(canvasSpread(page, id))
  const frames = await canvasSpread(page, id)
    .locator('button.spread-frame')
    .evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          height: rect.height,
        }
      }),
    )
  const frame = frames.find(
    (f) => f.x > spread.x + spread.width / 2 && f.height > spread.height * 0.2,
  )
  if (frame === undefined) throw new Error('no right-page frame')
  return {
    fx: (frame.x - spread.x) / spread.width,
    fy: (frame.y - spread.y) / spread.height,
  }
}

test('Browser check: master guides show dashed and read-only on every spread using it', async ({
  page,
}) => {
  await page.goto(PAINTER)
  const [first, none, two, three] = [0, 1, 2, 3].map(
    (n) => `painter-spread-${String(n)}`,
  ) as [string, string, string, string]
  await showSpread(page, two)
  const { fx, fy } = await rightPageFrame(page, two)
  await showSpread(page, none)
  await page
    .getByRole('radiogroup', { name: 'Master' })
    .getByRole('radio', { name: 'None', exact: true })
    .check({ force: true })

  // Two master guides: one across, one down through a right-page frame.
  await openMasters(page)
  await showRulers(page)
  await pullOnMaster(page, 0.3)
  await pullVerticalOnMaster(page, fx)
  await expect(masterGuides(page)).toHaveCount(2)
  const down = await offsetMm(
    masterGuides(page).and(page.locator('[data-orientation="vertical"]')),
  )
  expect(down).toBeGreaterThan(TRIM_MM)

  // Pages: every Master A spread shows both, dashed, at the master's mm.
  await page.getByTestId('left-tab-pages').click()
  await showSpread(page, two)
  for (const id of [two, three]) {
    await expect(parentLines(page, id)).toHaveCount(2)
    await expect(ownLines(page, id)).toHaveCount(0)
  }
  await expect(parentLines(page, none)).toHaveCount(0)
  const spread = await box(canvasSpread(page, two))
  const vertical = parentLines(page, two).and(
    page.locator('[data-orientation="vertical"]'),
  )
  const line = await middleOf(vertical)
  expect(line.x).toBeCloseTo(
    spread.x + (down / (2 * TRIM_MM)) * spread.width,
    0,
  )
  const look = await vertical.evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      width: style.width,
      height: el.getBoundingClientRect().height,
      image: style.backgroundImage,
      pointerEvents: style.pointerEvents,
    }
  })
  expect(look.width).toBe('1px')
  expect(look.height).toBeCloseTo(spread.height + 48, 0)
  expect(look.image).toContain('repeating-linear-gradient')
  expect(look.image).toContain('rgb(163, 161, 162)')
  expect(look.pointerEvents).toBe('none')

  // Read-only: a press on the parent line reaches the frame under it.
  const press = { x: line.x, y: spread.y + spread.height * fy }
  const hit = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return {
        frame: el?.closest('button.spread-frame') !== null,
        guide: el?.closest('.guide-line') !== null,
      }
    },
    [press.x, press.y] as const,
  )
  expect(hit).toEqual({ frame: true, guide: false })
  await page.mouse.click(press.x, press.y)
  await expect(
    canvasSpread(page, two).locator('button.spread-frame[aria-pressed="true"]'),
  ).toHaveCount(1)

  // A spread-only guide shows on that spread alone, above the parent lines.
  const ruler = await middleOf(page.getByTestId('ruler-x'))
  await drag(
    page,
    { x: spread.x + spread.width * 0.5, y: ruler.y },
    { x: spread.x + spread.width * 0.5, y: spread.y + spread.height * 0.7 },
  )
  await expect(ownLines(page, two)).toHaveCount(1)
  await expect(ownLines(page, three)).toHaveCount(0)
  expect(
    await canvasSpread(page, two)
      .locator('.guide-line')
      .last()
      .getAttribute('data-testid'),
  ).toBe('guide-line')

  // Ctrl+; hides both kinds.
  await page.keyboard.press('Control+;')
  await expect(parentLines(page, two)).toHaveCount(0)
  await expect(ownLines(page, two)).toHaveCount(0)
  await page.keyboard.press('Control+;')
  await expect(parentLines(page, two)).toHaveCount(2)

  // Page 1 is a right page: only the right-page vertical, shifted by the trim.
  await showSpread(page, first)
  await expect(parentLines(page, first)).toHaveCount(2)
  const firstBox = await box(canvasSpread(page, first))
  const shifted = await middleOf(
    parentLines(page, first).and(page.locator('[data-orientation="vertical"]')),
  )
  expect(shifted.x).toBeCloseTo(
    firstBox.x + ((down - TRIM_MM) / TRIM_MM) * firstBox.width,
    0,
  )
  await assertDocumentFitsViewport(page)
})

/** A point on bare paper of the spread above `belowY` (client px), scanned on a 2 % grid. */
async function barePaper(page: Page, id: string, belowY: number) {
  const spread = await box(canvasSpread(page, id))
  const point = await page.evaluate(
    ([sx, sy, sw, top, spreadId]) => {
      for (let fy = 0.02; fy < 1; fy += 0.02) {
        const y = sy + (top - sy) * fy
        for (let fx = 0.04; fx < 0.96; fx += 0.02) {
          const x = sx + sw * fx
          const el = document.elementFromPoint(x, y)
          const view = el?.closest('[data-testid="spread-view"]')
          if (
            view?.getAttribute('data-spread-id') === spreadId &&
            el?.closest('button, .guide-line') === null
          ) {
            return { x, y }
          }
        }
      }
      return null
    },
    [spread.x, spread.y, spread.width, belowY - 40, id] as const,
  )
  if (point === null) throw new Error('no bare paper')
  return point
}

test('Browser check: a frame drawn near a master guide snaps to it; hidden guides do not snap', async ({
  page,
}) => {
  await page.goto(PAINTER)
  const two = 'painter-spread-2'
  await openMasters(page)
  await showRulers(page)
  await pullOnMaster(page, 0.3)
  await expect(masterGuides(page)).toHaveCount(1)
  await page.getByTestId('left-tab-pages').click()
  await showSpread(page, two)
  await expect(parentLines(page, two)).toHaveCount(1)
  const lineY = (await middleOf(parentLines(page, two))).y
  const start = await barePaper(page, two, lineY)
  const end = { x: start.x + 60, y: lineY - 3 }
  const snapLines = page.getByTestId('snap-line')
  const drawn = canvasSpread(page, two).locator(
    'button.spread-frame[aria-pressed="true"]',
  )

  const drawToLine = async (midDrag: () => Promise<void>) => {
    await page.keyboard.press('f')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 6 })
    await midDrag()
    await page.mouse.up()
    await expect(drawn).toHaveCount(1)
    const rect = await box(drawn)
    return rect.y + rect.height
  }

  // Shown: the bottom edge lands on the dashed master line.
  const snapped = await drawToLine(async () => {
    await expect(snapLines.filter({ hasText: 'snap · guide' })).toHaveCount(1)
  })
  expect(snapped).toBeCloseTo(lineY, 0)
  await page.keyboard.press('Control+z')
  await expect(drawn).toHaveCount(0)

  // Ctrl+; hides guides: the same draw keeps the edge at the pointer.
  await page.keyboard.press('Control+;')
  await expect(parentLines(page, two)).toHaveCount(0)
  const raw = await drawToLine(async () => {
    await expect(snapLines).toHaveCount(0)
  })
  expect(raw).toBeCloseTo(end.y, 0)
  await page.keyboard.press('Control+;')
})

test('a master guide move is one undo step; dropped on its ruler it is removed', async ({
  page,
}) => {
  await page.goto(PAINTER)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await openMasters(page)
  await showRulers(page)
  await pullOnMaster(page, 0.3)
  const line = masterGuides(page)
  await expect(line).toHaveCount(1)
  const placed = await offsetMm(line)

  const spread = await box(masterSpread(page))
  const grab = await middleOf(line)
  await drag(page, grab, { x: grab.x, y: grab.y + spread.height * 0.3 })
  await expect.poll(async () => offsetMm(line)).toBeGreaterThan(placed + 1)

  await page.keyboard.press('Control+z')
  await expect.poll(async () => offsetMm(line)).toBe(placed)
  await expect(line).toHaveCount(1)

  await drag(page, await middleOf(line), await middleOf(masterRuler(page)))
  await expect(line).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(line).toHaveCount(1)
})

test('a master guide survives save and reload', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await createBookViaLibrary(page, 'Master guides')
  await page.getByTestId('left-tab-masters').click()
  await page.getByRole('button', { name: 'New master' }).click()
  await expect(masterSpread(page)).toBeVisible()
  await showRulers(page)
  await pullOnMaster(page, 0.4)
  await expect(masterGuides(page)).toHaveCount(1)
  const placed = await offsetMm(masterGuides(page))

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 15_000,
  })
  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await openMasters(page)
  await expect(masterGuides(page)).toHaveCount(1)
  expect(await offsetMm(masterGuides(page))).toBe(placed)
})

test.describe('frame-budget gates', () => {
  test('dragging a guide on a master used by 40 spreads stays within budget', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, `${PAINTER}&perf=1`)
    // As the #405 nudge gate: all 40 spreads using Master A are mounted.
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
    await dispatchCtrlWheel(page, 500, 24)
    await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
    await expect
      .poll(async () =>
        page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
      )
      .toBeNull()
    await openMasters(page)
    await showRulers(page)
    await pullOnMaster(page, 0.3)
    const line = masterGuides(page)
    await expect(line).toHaveCount(1)
    const placed = await offsetMm(line)
    await clearPerfScenario(page)

    // Attribution first, so every entry the gate counts is also logged.
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    const grab = await middleOf(line)
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    for (let step = 1; step <= 40; step += 1) {
      await page.mouse.move(grab.x, grab.y + step * 3)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()
    // One commit at the gesture end; then two frames settle.
    await expect.poll(async () => offsetMm(line)).toBeGreaterThan(placed)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
        }),
    )
    const rows = await page.evaluate(browserTakeLoafScripts)
    console.log(
      `parent-spreads-guides: ${String(rows.length)} LoAF ${JSON.stringify(rows)}`,
    )
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
    const moved = await offsetMm(line)

    // Pages: the spreads using Master A show the moved guide. The switch
    // remounts the 40-spread pasteboard, which blocks on main too (8–39 ms
    // per switch, parent-guides PR), so its LoAF is logged, not gated.
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    await page.getByTestId('left-tab-pages').click()
    await expect(masterCanvas(page)).toHaveCount(0)
    const inherited = page
      .getByTestId('pasteboard-scroll')
      .getByTestId('guide-line-parent')
    await expect(inherited.first()).toBeVisible()
    // One horizontal guide on each of the 40 mounted spreads.
    await expect(inherited).toHaveCount(40)
    expect(await offsetMm(inherited.first())).toBe(moved)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
        }),
    )
    const switchRows = await page.evaluate(browserTakeLoafScripts)
    console.log(
      `parent-spreads-guides switch: ${String(switchRows.length)} LoAF ${JSON.stringify(switchRows)}`,
    )
    await collectFrameStatsArtifact(page, testInfo)
  })
})
