import { expect, test } from './fixtures/coverage'
import { assertFlingLoafBudget } from './perf/flingLoafGate'
import {
  browserBeginLoafScenarioWindow,
  enablePerfScenario,
} from './perf/perfFixture'

/** Busy-loop one rAF callback per entry (ms each), then wait for delivery. */
async function browserFreezeFrames(freezeMs: number[]): Promise<void> {
  for (const ms of freezeMs) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const end = performance.now() + ms
        while (performance.now() < end) {
          // deliberate freeze
        }
        resolve()
      })
    })
    // A separate task per freeze so each lands in its own frame.
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  // LoAF entries are delivered after the frame presents.
  await new Promise((resolve) => setTimeout(resolve, 500))
}

// The LoAF gate must never go blind: a deliberate main-thread freeze has to
// fail it in a real browser, with no CPU throttle and no allowlist.
test.describe('frame-budget gates', () => {
  test('assertNoLoafEntries catches a synthetic busy loop', async ({
    page,
  }) => {
    await enablePerfScenario(page)
    // Open the window in an earlier task: a frame that began before the clear
    // is (correctly) attributed to the previous window.
    await page.evaluate(browserBeginLoafScenarioWindow)
    await page.evaluate(browserFreezeFrames, [200])
    const message = await page.evaluate(() => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      try {
        perf.assertNoLoafEntries(0)
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
      return null
    })
    expect(message).toMatch(/LoAF entries .* exceed max/)
  })

  test('fling gate (≤5 ms ignored) still catches a busy loop and a series of spikes', async ({
    page,
  }) => {
    await enablePerfScenario(page)
    await page.evaluate(browserBeginLoafScenarioWindow)
    await page.evaluate(browserFreezeFrames, [200])
    await expect(assertFlingLoafBudget(page)).rejects.toThrow(
      /^LoAF entries 1 exceed max 0 \(fling, /,
    )

    // ~65 ms tasks block ~15 ms each: a series over 5 ms fails (as repeated
    // spikes, or as real freezes when a loaded runner stretches them past 20).
    await page.evaluate(browserBeginLoafScenarioWindow)
    await page.evaluate(browserFreezeFrames, [65, 65, 65])
    await expect(assertFlingLoafBudget(page)).rejects.toThrow(
      /^LoAF entries [1-3] exceed max [01] \(fling, /,
    )
  })
})
