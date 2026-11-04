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

// parent-spreads-perf: `&parent=a` makes Master A (one logo) the book default,
// so all 40 painter spreads paint it in their parent layer; `&overrides=n`
// has the first n spreads paint a local copy instead.
const NUDGES = 10
const OVERRIDES = 10

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

test('a master nudge leaves the 10 spreads that override the logo', async ({
  page,
}) => {
  await page.goto(`/?fixture=painter&parent=a&overrides=${String(OVERRIDES)}`)
  const before = await selectMasterLogo(page)

  await page.keyboard.press('Shift+ArrowRight')

  await expect
    .poll(async () => movedLogoCount(page, before))
    .toBe(40 - OVERRIDES)
  const after = await logoLefts(page)
  expect(after.slice(0, OVERRIDES)).toEqual(before.slice(0, OVERRIDES))
})

test.describe('frame-budget gates', () => {
  for (const overrides of [0, OVERRIDES]) {
    const name =
      overrides === 0
        ? 'nudging a master item used by 40 spreads stays within budget'
        : `nudging a master item used by 40 spreads, ${String(overrides)} overriding it, stays within budget`
    test(name, async ({ page }, testInfo) => {
      await nudgeGate(page, testInfo, overrides)
    })
  }
})

/** Nudge the Master A logo `NUDGES` times and assert zero LoAF and the INP budget. */
async function nudgeGate(
  page: Page,
  testInfo: TestInfo,
  overrides: number,
): Promise<void> {
  test.setTimeout(120_000)
  await enablePerfScenario(
    page,
    `/?fixture=painter&perf=1&parent=a&overrides=${String(overrides)}`,
  )
  const before = await selectMasterLogo(page)
  await clearPerfScenario(page)

  // Attribution first, so every entry the gate counts is also logged.
  await page.evaluate(browserStartLoafScripts)
  await page.evaluate(browserBeginLoafScenarioWindow)
  for (let index = 0; index < NUDGES; index += 1) {
    await page.keyboard.press('Shift+ArrowRight')
  }
  // Every spread still on the logo repaints it; then two frames settle.
  await expect
    .poll(async () => movedLogoCount(page, before))
    .toBe(40 - overrides)
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
    `parent-spreads-perf (${String(overrides)} overrides): ${String(rows.length)} LoAF, longest blocking ${String(longest)} ms, nudge INP ${String(inpMs)} ms ${JSON.stringify(rows)}`,
  )
  await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
  await page.evaluate((budgetMs) => {
    window.__photobooksPerf?.assertInpWithinBudget(budgetMs)
  }, PERF_BUDGETS.inpMs * PERF_BUDGETS.cpuThrottleRate)
  await collectFrameStatsArtifact(page, testInfo)
}
