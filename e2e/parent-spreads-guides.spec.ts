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

  // The guide lives on the parent: Pages shows no spread guide.
  await page.getByTestId('left-tab-pages').click()
  await expect(masterCanvas(page)).toHaveCount(0)
  await expect(
    page.getByTestId('pasteboard-scroll').getByTestId('guide-line'),
  ).toHaveCount(0)
  await openMasters(page)
  await expect(masterGuides(page)).toHaveCount(1)
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
    await collectFrameStatsArtifact(page, testInfo)
  })
})
