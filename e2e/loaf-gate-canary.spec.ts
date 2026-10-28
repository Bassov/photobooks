import { expect, test } from './fixtures/coverage'
import {
  browserBeginLoafScenarioWindow,
  enablePerfScenario,
} from './perf/perfFixture'

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
    const message = await page.evaluate(async () => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          const end = performance.now() + 200
          while (performance.now() < end) {
            // deliberate freeze
          }
          resolve()
        })
      })
      // LoAF entries are delivered after the frame presents.
      await new Promise((resolve) => setTimeout(resolve, 500))
      try {
        perf.assertNoLoafEntries(0)
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
      return null
    })
    expect(message).toMatch(/LoAF entries .* exceed max/)
  })
})
