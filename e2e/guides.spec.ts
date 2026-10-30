import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { applyCpuThrottling, clearPerfScenario } from './perf/perfFixture'
import type { Locator, Page } from '@playwright/test'

const ACTIVE_SPREAD = '[data-active="true"] [data-testid="spread-view"]'
/** The session book is 300 mm trim, so the spread is 300 mm tall. */
const SPREAD_HEIGHT_MM = 300

async function spreadBox(page: Page) {
  const box = await page.locator(ACTIVE_SPREAD).boundingBox()
  if (box === null) throw new Error('no active spread')
  return box
}

async function centerOf(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox()
  if (box === null) throw new Error(`${testId} not visible`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function middleOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not visible')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
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

/** Pull a horizontal guide from the top ruler to `dy` px below the spread top. */
async function pullHorizontal(page: Page, dy: number, x = 0.5) {
  const spread = await spreadBox(page)
  const ruler = await centerOf(page, 'ruler-x')
  await drag(
    page,
    { x: spread.x + spread.width * x, y: ruler.y },
    { x: spread.x + spread.width * x, y: spread.y + dy },
  )
}

/** Pull a vertical guide from the left ruler to `dx` px right of the spread left. */
async function pullVertical(page: Page, dx: number) {
  const spread = await spreadBox(page)
  const ruler = await centerOf(page, 'ruler-y')
  const y = spread.y + 80
  await drag(page, { x: ruler.x, y }, { x: spread.x + dx, y })
}

async function openWithRulers(page: Page) {
  await openSessionEditor(page)
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('ruler-x')).toBeVisible()
}

/** Every guide sits at `offsetMm` from the spread edge on its axis. */
async function expectGuidesAligned(page: Page) {
  await expect
    .poll(async () => {
      const lines = page.getByTestId('guide-line')
      let worst = 0
      for (let i = 0; i < (await lines.count()); i += 1) {
        const line = lines.nth(i)
        // The guide's own spread (the active one can change while zooming).
        const spread = await line
          .locator('xpath=ancestor::*[@data-testid="spread-view"]')
          .boundingBox()
        const box = await line.boundingBox()
        if (spread === null) return Infinity
        const mmPx = spread.height / SPREAD_HEIGHT_MM
        const mm = Number(await line.getAttribute('data-offset-mm'))
        const horizontal =
          (await line.getAttribute('data-orientation')) === 'horizontal'
        if (box === null) return Infinity
        const actual = horizontal
          ? box.y + box.height / 2 - spread.y
          : box.x + box.width / 2 - spread.x
        worst = Math.max(worst, Math.abs(actual - mm * mmPx))
      }
      return worst
    })
    .toBeLessThan(1.5)
}

test('pull guides from both rulers; they sit at the dropped mm', async ({
  page,
}) => {
  await openWithRulers(page)
  await expect(page.getByTestId('guide-line')).toHaveCount(0)
  await assertDocumentFitsViewport(page)

  await pullHorizontal(page, 60)
  const horizontal = page.locator(
    '[data-testid="guide-line"][data-orientation="horizontal"]',
  )
  await expect(horizontal).toHaveCount(1)
  const spread = await spreadBox(page)
  const mm = Number(await horizontal.getAttribute('data-offset-mm'))
  expect(mm).toBeCloseTo((60 / spread.height) * SPREAD_HEIGHT_MM, 0)

  await pullVertical(page, 80)
  await expect(
    page.locator('[data-testid="guide-line"][data-orientation="vertical"]'),
  ).toHaveCount(1)
  await expect(page.getByTestId('guide-line')).toHaveCount(2)
  await expectGuidesAligned(page)
  await assertDocumentFitsViewport(page)
})

test('a new guide dropped back on its ruler is abandoned', async ({ page }) => {
  await openWithRulers(page)
  const spread = await spreadBox(page)
  const ruler = await centerOf(page, 'ruler-x')
  await drag(
    page,
    { x: spread.x + 100, y: ruler.y },
    { x: spread.x + 100, y: ruler.y + 1 },
  )
  await expect(page.getByTestId('guide-line')).toHaveCount(0)
  await expect(page.getByTestId('guide-line-new')).toHaveCount(0)
})

test('a placed guide moves, and dragging it back onto the ruler deletes it; undo restores it', async ({
  page,
}) => {
  await openWithRulers(page)
  await pullHorizontal(page, 60)
  const line = page.getByTestId('guide-line')
  await expect(line).toHaveCount(1)
  const before = Number(await line.getAttribute('data-offset-mm'))

  const grab = await middleOf(line)
  // 25 mm of drag whatever zoom Fit chose (the kit fits the spread, not 13%).
  const spread = await spreadBox(page)
  await drag(page, grab, {
    x: grab.x,
    y: grab.y + (25 / SPREAD_HEIGHT_MM) * spread.height,
  })
  await expect
    .poll(async () => Number(await line.getAttribute('data-offset-mm')))
    .toBeGreaterThan(before + 20)
  await expectGuidesAligned(page)

  const moved = await middleOf(line)
  const ruler = await centerOf(page, 'ruler-x')
  await drag(page, moved, { x: moved.x, y: ruler.y })
  await expect(line).toHaveCount(0)

  await page.keyboard.press('Control+z')
  await expect(line).toHaveCount(1)
})

test('guides stay aligned with the rulers through scroll and zoom', async ({
  page,
}) => {
  await openWithRulers(page)
  await pullHorizontal(page, 60)
  await pullVertical(page, 80)
  await expectGuidesAligned(page)

  await dispatchCtrlWheel(page, -120, 3)
  await expectGuidesAligned(page)
  await expect(page.getByTestId('guide-line')).toHaveCount(2)

  // Ruler mm 0 and a guide at X mm line up on screen: the ruler origin equals the spread edge.
  const spread = await spreadBox(page)
  const rx = await page.getByTestId('ruler-x').boundingBox()
  const ox = Number(
    await page.getByTestId('ruler-x').getAttribute('data-origin'),
  )
  expect(Math.abs((rx?.x ?? 0) + ox - spread.x)).toBeLessThan(1.5)
  await assertDocumentFitsViewport(page)
})

test('the Guides toggle and Ctrl+; hide and show guides without deleting them', async ({
  page,
}) => {
  await openWithRulers(page)
  await pullHorizontal(page, 60)
  // Kit bar has no Guides toggle (uikit/src/sandbox/chrome.tsx:168-180): View menu.
  const expectChecked = async (checked: 'true' | 'false'): Promise<void> => {
    await page.getByTestId('view-menu').click()
    await expect(page.getByTestId('view-guides-item')).toHaveAttribute(
      'aria-checked',
      checked,
    )
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('view-guides-item')).toHaveCount(0)
  }
  await expectChecked('true')
  await expect(page.getByTestId('guide-line')).toHaveCount(1)

  await page.getByTestId('view-menu').click()
  await page.getByTestId('view-guides-item').click()
  await expectChecked('false')
  await expect(page.getByTestId('guide-line')).toHaveCount(0)

  await page.keyboard.press('Control+;')
  await expectChecked('true')
  await expect(page.getByTestId('guide-line')).toHaveCount(1)
  await page.keyboard.press('Control+;')
  await expect(page.getByTestId('guide-line')).toHaveCount(0)

  // Pulling a new guide shows the hidden ones again.
  await pullVertical(page, 80)
  await expect(page.getByTestId('guide-line')).toHaveCount(2)
})

test('guides never appear in presentation mode', async ({ page }) => {
  await openWithRulers(page)
  await pullHorizontal(page, 60)
  await expect(page.getByTestId('guide-line')).toHaveCount(1)
  await page.getByTestId('present').click()
  await expect(page.getByTestId('presentation')).toBeVisible()
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await expect(page.getByTestId('guide-line')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('guide-line')).toHaveCount(1)
})

test.describe('frame-budget gates', () => {
  test('dragging a guide with rulers visible stays within frame-budget gates', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.goto('/?perf=1')
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    await page.evaluate(() => {
      window.__photobooksProject?.startSessionEditor()
    })
    await page.getByTestId('editor-shell').waitFor({ state: 'visible' })
    await page.keyboard.press('Shift+R')
    await expect(page.getByTestId('ruler-x')).toBeVisible()
    await pullHorizontal(page, 70)
    await expect(page.getByTestId('guide-line')).toHaveCount(1)

    await applyCpuThrottling(page)
    await clearPerfScenario(page)
    const line = page.getByTestId('guide-line')
    const grab = await middleOf(line)
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    for (let step = 0; step < 40; step += 1) {
      await page.mouse.move(grab.x, grab.y - 20 + (step % 20) * 2)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()

    await page.evaluate(() => {
      window.__photobooksPerf?.assertNoLoafEntries(0)
    })
  })
})
