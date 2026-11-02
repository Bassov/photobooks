import type { Page } from '@playwright/test'
import { FLING_LOAF_IGNORE_BLOCKING_MS, PERF_BUDGETS } from './budgets'

/**
 * LoAF gate for the thumb fling scenarios (perf-gate-short-loaf, Owner-approved).
 * Same buckets as `assertNoLoafEntries` in `src/perf/loafObserver.ts`, except
 * entries blocking ≤ `FLING_LOAF_IGNORE_BLOCKING_MS` are not counted, whatever
 * their source. Still fails on any entry > `loafNoiseBlockingMs` (20 ms) and on
 * more than `loafNoiseEntriesMax` (1) entries above the ignore line.
 * Messages keep the shared format so `scripts/perf-lane.mjs` reads the worst ms.
 */
export function judgeFlingLoaf(blockingMs: readonly number[]): void {
  const counted = blockingMs.filter((b) => b > FLING_LOAF_IGNORE_BLOCKING_MS)
  const real = counted.filter((b) => b > PERF_BUDGETS.loafNoiseBlockingMs)
  const noise = counted.length - real.length
  const ignored = blockingMs.filter((b) => b > 0).length - counted.length
  const worstMs = String(blockingMs.reduce((m, b) => Math.max(m, b), 0))
  const tail = `worst blockingDuration ${worstMs}ms, ${String(ignored)} ignored ≤${String(FLING_LOAF_IGNORE_BLOCKING_MS)}ms`
  if (real.length > PERF_BUDGETS.loafEntriesMax) {
    throw new Error(
      `LoAF entries ${String(real.length)} exceed max ${String(PERF_BUDGETS.loafEntriesMax)} (fling, ${tail})`,
    )
  }
  if (noise > PERF_BUDGETS.loafNoiseEntriesMax) {
    throw new Error(
      `LoAF entries ${String(noise)} exceed max ${String(PERF_BUDGETS.loafNoiseEntriesMax)} (fling, repeated spikes >${String(FLING_LOAF_IGNORE_BLOCKING_MS)}ms, ${tail})`,
    )
  }
}

/** `blockingDuration` of each LoAF entry in the open scenario window. */
export function browserLoafBlockingMs(): number[] {
  const perf = window.__photobooksPerf
  if (!perf) {
    throw new Error('window.__photobooksPerf is not available')
  }
  if (!perf.isLoafObserving()) {
    throw new Error('LoAF observer is not active; cannot assert LoAF budget')
  }
  return perf
    .getLoafEntries()
    .map((e) => (e as { blockingDuration: number }).blockingDuration)
}

export async function assertFlingLoafBudget(page: Page): Promise<void> {
  judgeFlingLoaf(await page.evaluate(browserLoafBlockingMs))
}
