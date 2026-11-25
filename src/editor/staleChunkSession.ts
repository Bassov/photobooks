import {
  createStaleChunkRecovery,
  type StaleChunkRecovery,
} from '../lib/staleChunkReload'
import { flushBeforeReload } from './projectSession'

let recovery: StaleChunkRecovery | null = null

/** The editor's one stale-chunk recovery (save, then reload once). */
export function staleChunkRecovery(): StaleChunkRecovery {
  recovery ??= createStaleChunkRecovery({
    // Lazy: the `sessionStorage` getter itself throws when storage is blocked.
    storage: {
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => {
        window.sessionStorage.setItem(key, value)
      },
    },
    now: () => Date.now(),
    flush: flushBeforeReload,
    reload: () => {
      window.location.reload()
    },
  })
  return recovery
}

/**
 * Vite dispatches `vite:preloadError` when a dynamic import (or its CSS)
 * fails to load. Start the recovery without `preventDefault()`: the import
 * still rejects, so its caller (e.g. the Preview error boundary) shows the
 * manual Reload when the guard declines.
 */
export function installStaleChunkReload(): () => void {
  const onPreloadError = () => {
    void staleChunkRecovery().recover()
  }
  window.addEventListener('vite:preloadError', onPreloadError)
  return () => {
    window.removeEventListener('vite:preloadError', onPreloadError)
  }
}
