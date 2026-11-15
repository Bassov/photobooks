import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import { holdPdf, openPrintFixture, releasePdf } from './fixtures/printJob'
import { PERF_BUDGETS } from './perf/budgets'
import {
  applyCpuThrottling,
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
} from './perf/perfFixture'

// pdf-export PE10 / Spec §2.6: the 40-spread painter book prints while the
// user drags a frame and zooms. Painting runs in the PDF worker; its paint
// messages pass a page-side gate, released a few at a time during the
// gestures so every progress update and the final write land inside the
// LoAF window.

const pill = (page: Page) => page.getByTestId('print')
const frame = (page: Page) =>
  page.getByTestId('spread-view').first().getByTestId('spread-frame').nth(1)

async function centerOf(page: Page) {
  const box = await frame(page).boundingBox()
  if (box === null) throw new Error('frame not visible')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Two animation frames: late LoAF entries of the last task arrive first. */
const twoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      }),
  )

/** Open Print, Export PDF with paint messages held, then Hide. */
async function exportHidden(page: Page): Promise<void> {
  await pill(page).click()
  await expect(page.getByTestId('print-check')).not.toHaveAttribute(
    'data-state',
    'checking',
  )
  await holdPdf(page)
  await page.getByTestId('print-go').click()
  await page.getByTestId('print-hide').click()
  await expect(pill(page)).toHaveAttribute('data-state', 'running')
}

/** Drag the frame in small steps, letting `perStep` paint messages through each. */
async function dragWhilePainting(page: Page, perStep: number): Promise<void> {
  const { x, y } = await centerOf(page)
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let step = 1; step <= 40; step += 1) {
    await releasePdf(page, perStep)
    await page.mouse.move(x + step * 2, y + step)
    await twoFrames(page)
  }
  await page.mouse.up()
}

test('the PDF finishes while a frame is dragged and the view zooms', async ({
  page,
}, testInfo) => {
  await openPrintFixture(page, `print-perf-${String(testInfo.workerIndex)}`)
  const before = await centerOf(page)
  await exportHidden(page)

  await dragWhilePainting(page, 2)
  await dispatchCtrlWheel(page, -100, 4)
  await releasePdf(page)

  await expect(pill(page)).toHaveAttribute('data-state', 'done', {
    timeout: 60_000,
  })
  expect((await centerOf(page)).x).not.toBe(before.x)
})

test.describe('frame-budget gates', () => {
  test('dragging a frame and zooming while a 40-spread PDF builds stays within budget', async ({
    page,
  }, testInfo) => {
    test.setTimeout(150_000)
    await openPrintFixture(
      page,
      `print-perf-gate-${String(testInfo.workerIndex)}`,
      '&perf=1',
    )
    await page.waitForFunction(() => window.__photobooksPerf !== undefined)
    // The first drag after load costs one LoAF whatever runs beside it.
    const warm = await centerOf(page)
    await page.mouse.move(warm.x, warm.y)
    await page.mouse.down()
    await page.mouse.move(warm.x + 6, warm.y + 4, { steps: 4 })
    await page.mouse.up()
    await exportHidden(page)
    await applyCpuThrottling(page)
    await clearPerfScenario(page)

    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    await dragWhilePainting(page, 2)
    await dispatchCtrlWheel(page, -100, 4, { settle: false })
    await releasePdf(page)
    await expect(pill(page)).toHaveAttribute('data-state', 'done', {
      timeout: 120_000,
    })
    await twoFrames(page)

    const rows = await page.evaluate(browserTakeLoafScripts)
    console.log(
      `print-perf: ${String(rows.length)} LoAF ${JSON.stringify(rows)}`,
    )
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
  })
})
