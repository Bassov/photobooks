import {
  assertNoExcessiveBlocking,
  clearLoafEntries,
  getLoafEntries,
  isLoafObserving,
  LOAF_BLOCKING_BUDGET_MS,
  startLoafObserver,
  stopLoafObserver,
} from './loafObserver'

export interface PhotobooksPerfApi {
  clearLoafEntries: typeof clearLoafEntries
  getLoafEntries: typeof getLoafEntries
  assertNoExcessiveBlocking: typeof assertNoExcessiveBlocking
  isLoafObserving: typeof isLoafObserving
  stopLoafObserver: typeof stopLoafObserver
  loafBlockingBudgetMs: typeof LOAF_BLOCKING_BUDGET_MS
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
  return new URLSearchParams(window.location.search).get('loaf') === '1'
}

export function enablePerfHooks(): void {
  startLoafObserver()
  window.__photobooksPerf = {
    clearLoafEntries,
    getLoafEntries,
    assertNoExcessiveBlocking,
    isLoafObserving,
    stopLoafObserver,
    loafBlockingBudgetMs: LOAF_BLOCKING_BUDGET_MS,
  }
}
