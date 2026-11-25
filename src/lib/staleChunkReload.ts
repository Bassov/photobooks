/**
 * Recovery from a stale lazy chunk: after a redeploy an open tab asks for a
 * hashed `/assets/*` file that no longer exists. The fix is one page reload
 * (the new index.html names the new chunks), but only after pending edits are
 * saved, and never twice in a row: a chunk that is still missing after the
 * reload must not turn into a reload loop.
 */

/** sessionStorage key holding the time of the last automatic reload. */
export const STALE_CHUNK_RELOAD_KEY = 'photobooks:stale-chunk-reload'

/** A second chunk failure within this window after a reload is not retried. */
export const STALE_CHUNK_RELOAD_WINDOW_MS = 60_000

// Chrome / Firefox / Safari dynamic-import failures and Vite's CSS preload.
const CHUNK_LOAD_MESSAGE =
  /dynamically imported module|importing a module script failed|unable to preload css/i

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_MESSAGE.test(error.message)
}

/** `reloading`: the page is reloading. `failed`: show a manual Reload. */
export type StaleChunkOutcome = 'reloading' | 'failed'

export interface StaleChunkDeps {
  readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  readonly now: () => number
  /** Saves pending edits; false when they could not be saved. */
  readonly flush: () => Promise<boolean>
  readonly reload: () => void
}

export interface StaleChunkRecovery {
  /** Automatic path: save, then reload at most once per window. */
  recover(): Promise<StaleChunkOutcome>
  /** The user's Reload: save, then reload regardless of the guard (and
   * mark it, so a still-missing chunk then shows the error, not a loop).
   * `discardUnsaved` reloads even when the save failed. */
  reloadNow(discardUnsaved?: boolean): Promise<StaleChunkOutcome>
}

function reloadedRecently(deps: StaleChunkDeps): boolean {
  const last = Number(deps.storage.getItem(STALE_CHUNK_RELOAD_KEY))
  return last > 0 && deps.now() - last < STALE_CHUNK_RELOAD_WINDOW_MS
}

export function createStaleChunkRecovery(
  deps: StaleChunkDeps,
): StaleChunkRecovery {
  let pending: Promise<StaleChunkOutcome> | null = null

  // The mark is written before the reload, so the reloaded page sees it.
  const saveThenReload = async (
    discardUnsaved = false,
  ): Promise<StaleChunkOutcome> => {
    if (!discardUnsaved && !(await deps.flush())) {
      return 'failed'
    }
    deps.storage.setItem(STALE_CHUNK_RELOAD_KEY, String(deps.now()))
    deps.reload()
    return 'reloading'
  }

  // No sessionStorage or a throwing save: no guard, so no reload.
  const guarded = async (
    run: () => Promise<StaleChunkOutcome>,
  ): Promise<StaleChunkOutcome> => {
    try {
      return await run()
    } catch {
      return 'failed'
    }
  }

  return {
    recover() {
      pending ??= guarded(() =>
        reloadedRecently(deps) ? Promise.resolve('failed') : saveThenReload(),
      )
      return pending
    },
    reloadNow(discardUnsaved = false) {
      return guarded(() => saveThenReload(discardUnsaved))
    },
  }
}
