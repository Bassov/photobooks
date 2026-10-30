import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { PERF_BUDGETS } from './perf/budgets'
import { applyCpuThrottling, clearPerfScenario } from './perf/perfFixture'

const spreadView = (page: Page) => page.getByTestId('spread-view').first()
const frames = (page: Page) => spreadView(page).getByTestId('spread-frame')
const snapLabel = (page: Page) => page.getByTestId('snap-label')
const snapLines = (page: Page) => page.getByTestId('snap-line')
const gridToggle = (page: Page) => page.getByTestId('grid-topbar-toggle')
const snapToggle = (page: Page) => page.getByTestId('snap-topbar-toggle')

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) {
    throw new Error('not visible')
  }
  return b
}

async function openRightPanel(page: Page): Promise<void> {
  const open = await page.getByTestId('panel-r').getAttribute('data-open')
  if (open !== 'true') {
    await page.getByTestId('toggle-r').click()
  }
}

async function clearSpread(page: Page): Promise<void> {
  for (let guard = 0; guard < 8; guard += 1) {
    if ((await frames(page).count()) === 0) {
      return
    }
    await frames(page).first().click()
    await page.keyboard.press('Delete')
  }
  await expect(frames(page)).toHaveCount(0)
}

/** Draw an empty frame (Alt: no snap) from / to fractions of the spread box. */
async function drawFrame(
  page: Page,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  const b = await box(spreadView(page))
  await page.keyboard.press('f')
  await page.mouse.move(b.x + from[0] * b.width, b.y + from[1] * b.height)
  await page.mouse.down()
  await page.keyboard.down('Alt')
  await page.mouse.move(b.x + to[0] * b.width, b.y + to[1] * b.height, {
    steps: 6,
  })
  await page.keyboard.up('Alt')
  await page.mouse.up()
}

/** Drag the first frame so its left edge ends `offsetPx` right of `edgeX`. */
async function dragLeftEdgeTo(
  page: Page,
  edgeX: number,
  offsetPx: number,
  midDrag: () => Promise<void>,
  keys: string[] = [],
): Promise<void> {
  const frame = await box(frames(page).first())
  const from = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (const key of keys) {
    await page.keyboard.down(key)
  }
  await page.mouse.move(from.x + (edgeX + offsetPx - frame.x), from.y, {
    steps: 6,
  })
  await midDrag()
  for (const key of keys) {
    await page.keyboard.up(key)
  }
  await page.mouse.up()
}

test('grid on + snap on: a drag snaps to a column with the pill; hidden / Alt / snap off do not', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openSessionEditor(page)
  await clearSpread(page)
  // Large enough that the center grab point clears the selection handles, and
  // clear of the page-center anchors (which keep priority over the grid).
  await drawFrame(page, [0.25, 0.15], [0.55, 0.6])
  await expect(frames(page)).toHaveCount(1)
  await gridToggle(page).click()
  await expect(gridToggle(page)).toHaveAttribute('aria-pressed', 'true')
  const column = page.getByTestId('grid-overlay-column').first()
  const columnX = (await box(column)).x
  await expect(snapToggle(page)).toHaveAttribute('aria-pressed', 'true')

  // Grid on + snap on: label and one vertical line while snapped.
  await dragLeftEdgeTo(page, columnX, 6, async () => {
    await expect(snapLabel(page)).toHaveText(/^snap · column \d+$/)
    // At most one guide line per axis.
    await expect(
      snapLines(page).and(page.locator('[data-axis="x"]')),
    ).toHaveCount(1)
    expect(await snapLines(page).count()).toBeLessThanOrEqual(2)
  })
  await expect(snapLabel(page)).toHaveCount(0)
  await expect(snapLines(page)).toHaveCount(0)
  const snapped = await box(frames(page).first())
  expect(Math.abs(snapped.x - columnX)).toBeLessThan(1.5)

  // Alt-drag: no label.
  await dragLeftEdgeTo(
    page,
    columnX,
    12,
    async () => {
      await expect(snapLabel(page)).toHaveCount(0)
      await expect(snapLines(page)).toHaveCount(0)
    },
    ['Alt'],
  )
  expect((await box(frames(page).first())).x).toBeGreaterThan(columnX + 8)

  // Snap off: no lines or label near a column.
  await page.keyboard.press('Shift+S')
  await expect(snapToggle(page)).toHaveAttribute('aria-pressed', 'false')
  await dragLeftEdgeTo(page, columnX, 5, async () => {
    await expect(snapLabel(page)).toHaveCount(0)
    await expect(snapLines(page)).toHaveCount(0)
  })
  await page.keyboard.press('Shift+S')
  await expect(snapToggle(page)).toHaveAttribute('aria-pressed', 'true')

  // Hidden grid: dragging near the (former) column does not snap.
  await gridToggle(page).click()
  await expect(gridToggle(page)).toHaveAttribute('aria-pressed', 'false')
  await dragLeftEdgeTo(page, columnX, 10, async () => {
    // Frame / page snaps may still draw a line; the grid must not pull.
    await expect(snapLabel(page)).toHaveCount(0)
  })
  expect((await box(frames(page).first())).x).toBeGreaterThan(columnX + 8)
  await assertDocumentFitsViewport(page)
})

test('dragging a frame across a 12-column grid with snapping stays within frame-budget gates', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await page.goto('/?perf=1')
  await page.waitForFunction(() => window.__photobooksPerf !== undefined)
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await page.getByTestId('editor-shell').waitFor({ state: 'visible' })

  await openRightPanel(page)
  await page.getByTestId('book-title').click()
  const columns = page.getByTestId('grid-field-columns').getByRole('textbox')
  await columns.fill('12')
  await columns.blur()
  await expect(page.getByTestId('grid-summary')).toHaveText('12×2')
  await gridToggle(page).click()
  await expect(page.getByTestId('grid-overlay-column').first()).toBeAttached()

  await clearSpread(page)
  await drawFrame(page, [0.25, 0.3], [0.7, 0.8])
  await expect(frames(page)).toHaveCount(1)
  await page.waitForTimeout(300)
  const spread = await box(spreadView(page))
  const frame = await box(frames(page).first())
  const cx = frame.x + frame.width / 2
  const cy = frame.y + frame.height / 2

  await applyCpuThrottling(page)
  await clearPerfScenario(page)
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  const start = Date.now()
  let tick = 0
  while (Date.now() - start < 4_000) {
    tick += 1
    await page.mouse.move(
      Math.min(
        Math.max(cx + Math.sin(tick / 10) * spread.width * 0.3, spread.x + 20),
        spread.x + spread.width - 20,
      ),
      cy,
    )
    await page.waitForTimeout(8)
  }
  await page.mouse.up()

  await page.evaluate((handlerBudgetMs) => {
    const perf = window.__photobooksPerf
    if (!perf) {
      throw new Error('window.__photobooksPerf is not available')
    }
    perf.assertNoLoafEntries(0)
    perf.assertHandlerP95WithinBudget('frame-gesture', handlerBudgetMs)
  }, PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate)
})
