import type { Page } from '@playwright/test'
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

// parent-spreads-perf: `&parent=a` makes Master A (one logo) the book default,
// so all 40 painter spreads paint it in their parent layer.
const NUDGES = 10

const pasteboardLogos = (page: Page) =>
  page
    .getByTestId('pasteboard-scroll')
    .locator('[data-testid="parent-layer"] .spread-frame')

/** Left of every pasteboard logo (px), one per spread. */
async function logoLefts(page: Page): Promise<number[]> {
  return pasteboardLogos(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().left),
  )
}

/** Zoom out so all 40 spreads mount, then select the Master A logo in Masters mode. */
async function selectMasterLogo(page: Page): Promise<number[]> {
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await dispatchCtrlWheel(page, 500, 24)
  await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
  await expect(pasteboardLogos(page)).toHaveCount(40)
  await expect
    .poll(async () =>
      page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
    )
    .toBeNull()

  await page.getByTestId('left-tab-masters').click()
  const logo = page
    .getByTestId('masters-canvas')
    .locator('button.spread-frame')
    .first()
  await logo.click()
  await expect(logo).toHaveAttribute('aria-pressed', 'true')
  return logoLefts(page)
}

/** Spreads whose pasteboard logo sits right of where it was. */
async function movedLogoCount(page: Page, before: number[]): Promise<number> {
  const after = await logoLefts(page)
  return after.filter((left, i) => left > (before[i] ?? left)).length
}

test('a master nudge repaints the logo on all 40 spreads using it', async ({
  page,
}) => {
  await page.goto('/?fixture=painter&parent=a')
  const before = await selectMasterLogo(page)

  await page.keyboard.press('Shift+ArrowRight')

  await expect.poll(async () => movedLogoCount(page, before)).toBe(40)
})

test.describe('frame-budget gates', () => {
  test('nudging a master item used by 40 spreads stays within budget', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1&parent=a')
    const before = await selectMasterLogo(page)
    await clearPerfScenario(page)

    // Attribution first, so every entry the gate counts is also logged.
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    for (let index = 0; index < NUDGES; index += 1) {
      await page.keyboard.press('Shift+ArrowRight')
    }
    // Every spread repaints the moved logo; then two frames settle.
    await expect.poll(async () => movedLogoCount(page, before)).toBe(40)
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
    const longest = Math.max(0, ...rows.map((row) => row.blocking))
    const inpMs = await page.evaluate(() => {
      const perf = window.__photobooksPerf
      perf?.flushEventTimingEntries()
      return perf?.getInpMs() ?? null
    })
    console.log(
      `parent-spreads-perf: ${String(rows.length)} LoAF, longest blocking ${String(longest)} ms, nudge INP ${String(inpMs)} ms ${JSON.stringify(rows)}`,
    )
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
    await page.evaluate((budgetMs) => {
      window.__photobooksPerf?.assertInpWithinBudget(budgetMs)
    }, PERF_BUDGETS.inpMs * PERF_BUDGETS.cpuThrottleRate)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
