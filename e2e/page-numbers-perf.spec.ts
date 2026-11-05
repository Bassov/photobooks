import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
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

// Designer page-numbers perf: `&parent=a` puts Master A on all 40 painter
// spreads; Show on paints a folio on every page, then one spread moves and
// every spread from there renumbers. Zero LoAF over both edits.
const SPREADS = 40

const slots = (page: Page) =>
  page.getByTestId('pasteboard-scroll').locator('[data-pasteboard-slot]')

/** Folio texts per mounted slot, in stack order. */
async function folioTexts(page: Page): Promise<string[][]> {
  return slots(page).evaluateAll((els) =>
    els.map((el) =>
      [...el.querySelectorAll('[data-testid="page-number"]')].map(
        (node) => node.textContent,
      ),
    ),
  )
}

async function slotIds(page: Page): Promise<string[]> {
  return slots(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-spread-id') ?? ''),
  )
}

/** Zoom out so all 40 spreads mount, then open Master A in Masters mode. */
async function mountAllAndOpenMaster(page: Page): Promise<void> {
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await dispatchCtrlWheel(page, 500, 24)
  await expect(page.getByTestId('pasteboard-slot')).toHaveCount(SPREADS)
  await expect
    .poll(async () =>
      page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
    )
    .toBeNull()
  await page.getByTestId('left-tab-masters').click()
  await expect(page.getByTestId('master-pn-toggle')).toBeVisible()
}

/** Show on in Masters mode; the pasteboard under it numbers every page. */
async function showOn(page: Page): Promise<void> {
  await page.getByTestId('master-pn-toggle').click()
  await expect
    .poll(async () => (await folioTexts(page)).flat().length)
    .toBeGreaterThan(2 * SPREADS - 3)
}

/** Move the first spread down one (spread list); wait for the renumber. */
async function reorderFirst(page: Page): Promise<string[]> {
  const [first, second] = await slotIds(page)
  await page.getByTestId(`spread-list-item-${first ?? ''}`).focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect
    .poll(async () => (await slotIds(page)).slice(0, 2))
    .toEqual([second ?? '', first ?? ''])
  await expect.poll(async () => (await folioTexts(page))[1]).toEqual(['2', '3'])
  return (await folioTexts(page)).flat()
}

async function openPages(page: Page): Promise<void> {
  await page.getByTestId('left-tab-pages').click()
  await expect(page.getByTestId('masters-canvas')).toHaveCount(0)
}

test('Show on numbers all 40 spreads; a reorder renumbers them in page order', async ({
  page,
}) => {
  await page.goto('/?fixture=painter&parent=a')
  await mountAllAndOpenMaster(page)

  await showOn(page)
  await openPages(page)
  const texts = await reorderFirst(page)

  expect(texts).toEqual(texts.map((_, index) => String(index + 1)))
})

test.describe('frame-budget gates', () => {
  test('Show on for a master used by 40 spreads, then a reorder, stays within budget', async ({
    page,
  }, testInfo) => {
    await pageNumbersGate(page, testInfo)
  })
})

/** Two settled frames after the edit's own work. */
async function settle(page: Page): Promise<void> {
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
}

/** Run `edit` in a fresh LoAF window; assert zero LoAF and the INP budget. */
async function gateWindow(
  page: Page,
  label: string,
  edit: () => Promise<void>,
): Promise<void> {
  await clearPerfScenario(page)
  // Attribution first, so every entry the gate counts is also logged.
  await page.evaluate(browserStartLoafScripts)
  await page.evaluate(browserBeginLoafScenarioWindow)
  await edit()
  await settle(page)
  const rows = await page.evaluate(browserTakeLoafScripts)
  const longest = Math.max(0, ...rows.map((row) => row.blocking))
  const inpMs = await page.evaluate(() => {
    const perf = window.__photobooksPerf
    perf?.flushEventTimingEntries()
    return perf?.getInpMs() ?? null
  })
  console.log(
    `page-numbers-perf ${label}: ${String(rows.length)} LoAF, longest blocking ${String(longest)} ms, INP ${String(inpMs)} ms ${JSON.stringify(rows)}`,
  )
  await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
  await page.evaluate((budgetMs) => {
    window.__photobooksPerf?.assertInpWithinBudget(budgetMs)
  }, PERF_BUDGETS.inpMs * PERF_BUDGETS.cpuThrottleRate)
}

/**
 * Show on (all 40 spreads repaint their folios), then one reorder (every
 * spread after it renumbers): each edit in its own window. The Masters →
 * Pages tab switch between them is not part of the scenario.
 */
async function pageNumbersGate(page: Page, testInfo: TestInfo): Promise<void> {
  test.setTimeout(120_000)
  await enablePerfScenario(page, '/?fixture=painter&perf=1&parent=a')
  await mountAllAndOpenMaster(page)

  await gateWindow(page, 'show on', async () => {
    await showOn(page)
  })
  await openPages(page)
  await gateWindow(page, 'reorder', async () => {
    await reorderFirst(page)
  })
  await collectFrameStatsArtifact(page, testInfo)
}
