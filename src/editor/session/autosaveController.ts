import type { ProjectSessionTimers } from './browserProjectSessionPlatform'

export type SavePhase = 'idle' | 'pending' | 'saving' | 'error'

export interface AutosaveControllerDeps {
  timers: ProjectSessionTimers
  debounceMs: number
  isGestureActive: () => boolean
  awaitPendingHashes: () => Promise<void>
}

export interface AutosaveController {
  getSavePhase: () => SavePhase
  setDebounceMs: (ms: number) => void
  setTimers: (next: ProjectSessionTimers) => void
  cancel: () => void
  /**
   * When `canArm` is true and phase is not `saving`/`error`, set `pending`,
   * (re)schedule debounce, and call `onFire` when still pending, dirty, and
   * not gesturing.
   */
  arm: (canArm: boolean, isDirty: () => boolean, onFire: () => void) => boolean
  /** After gesture ends: re-arm when still pending and dirty. */
  onGestureIdle: (isDirty: () => boolean, onFire: () => void) => boolean
  markPendingFromError: () => void
  /** Enter `saving` and cancel timer. Returns false if already saving. */
  beginSaving: () => boolean
  /** Cancel timer and set `saving` even if already saving (flush path). */
  ensureSaving: () => void
  /** If currently `saving`, move to `pending` or `idle`. */
  completeSavingIfSaving: (stillDirty: boolean) => void
  /** Unconditional post-persist settle (matches prior direct phase writes). */
  settleAfterPersist: (stillDirty: boolean) => void
  failSaving: () => void
  /** Cancel timer and set `idle`. */
  reset: () => void
  /** Single pending-hash wait seam before session persist body. */
  waitForPendingHashes: () => Promise<void>
}

export function createAutosaveController(
  deps: AutosaveControllerDeps,
): AutosaveController {
  let timers = deps.timers
  let debounceMs = deps.debounceMs
  let savePhase: SavePhase = 'idle'
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancel(): void {
    if (timer !== null) {
      timers.clearTimeout(timer)
      timer = null
    }
  }

  function arm(
    canArm: boolean,
    isDirty: () => boolean,
    onFire: () => void,
  ): boolean {
    if (!canArm || savePhase === 'error' || savePhase === 'saving') {
      return false
    }
    savePhase = 'pending'
    cancel()
    timer = timers.setTimeout(() => {
      timer = null
      if (savePhase !== 'pending' || !isDirty() || deps.isGestureActive()) {
        return
      }
      onFire()
    }, debounceMs)
    return true
  }

  return {
    getSavePhase: () => savePhase,
    setDebounceMs(ms: number): void {
      debounceMs = ms
    },
    setTimers(next: ProjectSessionTimers): void {
      timers = next
    },
    cancel,
    arm,
    onGestureIdle(isDirty: () => boolean, onFire: () => void): boolean {
      if (savePhase === 'pending' && isDirty()) {
        return arm(true, isDirty, onFire)
      }
      return false
    },
    markPendingFromError(): void {
      if (savePhase === 'error') {
        savePhase = 'pending'
      }
    },
    beginSaving(): boolean {
      if (savePhase === 'saving') {
        return false
      }
      cancel()
      savePhase = 'saving'
      return true
    },
    ensureSaving(): void {
      cancel()
      savePhase = 'saving'
    },
    completeSavingIfSaving(stillDirty: boolean): void {
      if (savePhase !== 'saving') {
        return
      }
      savePhase = stillDirty ? 'pending' : 'idle'
    },
    settleAfterPersist(stillDirty: boolean): void {
      savePhase = stillDirty ? 'pending' : 'idle'
    },
    failSaving(): void {
      savePhase = 'error'
    },
    reset(): void {
      cancel()
      savePhase = 'idle'
    },
    waitForPendingHashes(): Promise<void> {
      return deps.awaitPendingHashes()
    },
  }
}
