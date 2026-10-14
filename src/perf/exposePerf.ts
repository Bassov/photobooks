import { PERF_BUDGETS } from './budgets'
import {
  assertInpWithinBudget,
  clearEventTimingEntries,
  flushEventTimingEntries,
  getEventTimingEntries,
  getInpMs,
  isEventTimingObserving,
  startEventTimingObserver,
} from './eventTiming'
import {
  assertFramePacingWithinBudget,
  clearFramePacingSamples,
  getFramePacingStats,
  isFramePacingSampling,
  startFramePacingSampler,
} from './framePacing'
import {
  assertNoLoafEntries,
  clearLoafEntries,
  getLoafEntries,
  isLoafObserving,
  startLoafObserver,
  stopLoafObserver,
} from './loafObserver'
import {
  assertHandlerP95WithinBudget,
  clearHandlerMeasures,
  getHandlerMeasureDurations,
  measureHandler,
  measureHandlerSync,
} from './measureHandler'

export interface PhotobooksPerfApi {
  clearAll: () => void
  clearLoafEntries: typeof clearLoafEntries
  getLoafEntries: typeof getLoafEntries
  assertNoLoafEntries: typeof assertNoLoafEntries
  isLoafObserving: typeof isLoafObserving
  stopLoafObserver: typeof stopLoafObserver
  getFramePacingStats: typeof getFramePacingStats
  assertFramePacingWithinBudget: typeof assertFramePacingWithinBudget
  isFramePacingSampling: typeof isFramePacingSampling
  getEventTimingEntries: typeof getEventTimingEntries
  flushEventTimingEntries: typeof flushEventTimingEntries
  getInpMs: typeof getInpMs
  assertInpWithinBudget: typeof assertInpWithinBudget
  isEventTimingObserving: typeof isEventTimingObserving
  measureHandler: typeof measureHandler
  measureHandlerSync: typeof measureHandlerSync
  getHandlerMeasureDurations: typeof getHandlerMeasureDurations
  assertHandlerP95WithinBudget: typeof assertHandlerP95WithinBudget
  clearHandlerMeasures: typeof clearHandlerMeasures
  budgets: typeof PERF_BUDGETS
}

declare global {
  interface Window {
    __photobooksPerf?: PhotobooksPerfApi
  }
}

export function shouldEnablePerfHooks(): boolean {
  if (import.meta.env.DEV) {
    return true
  }
  const params = new URLSearchParams(window.location.search)
  return params.get('perf') === '1' || params.get('loaf') === '1'
}

function clearAll(): void {
  clearLoafEntries()
  clearFramePacingSamples()
  clearEventTimingEntries()
  clearHandlerMeasures()
}

export function enablePerfHooks(): void {
  startLoafObserver()
  startFramePacingSampler()
  startEventTimingObserver()
  window.__photobooksPerf = {
    clearAll,
    clearLoafEntries,
    getLoafEntries,
    assertNoLoafEntries,
    isLoafObserving,
    stopLoafObserver,
    getFramePacingStats,
    assertFramePacingWithinBudget,
    isFramePacingSampling,
    getEventTimingEntries,
    flushEventTimingEntries,
    getInpMs,
    assertInpWithinBudget,
    isEventTimingObserving,
    measureHandler,
    measureHandlerSync,
    getHandlerMeasureDurations,
    assertHandlerP95WithinBudget,
    clearHandlerMeasures,
    budgets: PERF_BUDGETS,
  }
}
