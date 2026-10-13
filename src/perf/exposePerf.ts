import {
  assertNoExcessiveBlocking,
  clearLoafEntries,
  getLoafEntries,
  startLoafObserver,
} from './loafObserver'

export interface PhotobooksPerfApi {
  clearLoafEntries: typeof clearLoafEntries
  getLoafEntries: typeof getLoafEntries
  assertNoExcessiveBlocking: typeof assertNoExcessiveBlocking
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
  }
}
