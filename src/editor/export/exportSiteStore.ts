import type { SiteExportErrorCode } from '../../site/export/writeSiteTree'
import type { ExportSitePhase, ExportSiteSummary } from './exportSiteText'

/** Designer spec static-export §1: pill / dialog run state. */
export type ExportSiteState =
  | { kind: 'idle' }
  | { kind: 'running'; phase: ExportSitePhase; percent: number }
  | { kind: 'done'; summary: ExportSiteSummary; folder: string }
  | { kind: 'failed'; code: SiteExportErrorCode; folder: string }

export type ExportSiteEvent =
  | { type: 'start' }
  | { type: 'progress'; phase: ExportSitePhase; percent: number }
  | { type: 'done'; summary: ExportSiteSummary; folder: string }
  | { type: 'failed'; code: SiteExportErrorCode; folder: string }
  /** "Exported" has been shown long enough. */
  | { type: 'expire' }
  /** The user opened the failure. */
  | { type: 'seen' }

export const EXPORT_SITE_IDLE: ExportSiteState = { kind: 'idle' }

/** Progress reaches subscribers at most this often. */
export const EXPORT_PROGRESS_MS = 250
/** "Exported" stays on the pill this long. */
export const EXPORT_DONE_MS = 4000

/** Pure transitions; one run at a time, percent never goes back. */
export function reduceExportSite(
  state: ExportSiteState,
  event: ExportSiteEvent,
): ExportSiteState {
  switch (event.type) {
    case 'start':
      return state.kind === 'running'
        ? state
        : { kind: 'running', phase: 'prepare', percent: 0 }
    case 'progress':
      return state.kind === 'running'
        ? {
            kind: 'running',
            phase: event.phase,
            percent: Math.max(state.percent, event.percent),
          }
        : state
    case 'done':
      return state.kind === 'running'
        ? { kind: 'done', summary: event.summary, folder: event.folder }
        : state
    case 'failed':
      return state.kind === 'running'
        ? { kind: 'failed', code: event.code, folder: event.folder }
        : state
    case 'expire':
      return state.kind === 'done' ? EXPORT_SITE_IDLE : state
    case 'seen':
      return state.kind === 'failed' ? EXPORT_SITE_IDLE : state
  }
}

type TimerHandle = ReturnType<typeof setTimeout>

export interface ExportSiteClock {
  now: () => number
  setTimer: (run: () => void, ms: number) => TimerHandle
  clearTimer: (handle: TimerHandle | undefined) => void
  requestFrame: (run: () => void) => void
}

export interface ExportSiteStore {
  getSnapshot: () => ExportSiteState
  subscribe: (listener: () => void) => () => void
  /** `false` when a run is already going (the event is dropped). */
  dispatch: (event: ExportSiteEvent) => boolean
}

/**
 * Module store over `reduceExportSite`. Progress is published at most every
 * `EXPORT_PROGRESS_MS`, in an animation frame; other events at once. `done`
 * expires after `EXPORT_DONE_MS`.
 */
export function createExportSiteStore(clock: ExportSiteClock): ExportSiteStore {
  let state = EXPORT_SITE_IDLE
  let published = state
  let publishedAt = Number.NEGATIVE_INFINITY
  let flushPending = false
  let expireTimer: TimerHandle | undefined
  const listeners = new Set<() => void>()

  const publish = () => {
    flushPending = false
    if (published === state) {
      return
    }
    published = state
    publishedAt = clock.now()
    for (const listener of listeners) {
      listener()
    }
  }

  const dispatch = (event: ExportSiteEvent): boolean => {
    const next = reduceExportSite(state, event)
    if (next === state) {
      return false
    }
    state = next
    if (event.type === 'progress') {
      if (!flushPending) {
        flushPending = true
        const wait = Math.max(0, publishedAt + EXPORT_PROGRESS_MS - clock.now())
        clock.setTimer(() => {
          clock.requestFrame(publish)
        }, wait)
      }
      return true
    }
    // Every other change shows at once; only `done` reacts to the expiry.
    clock.clearTimer(expireTimer)
    expireTimer = clock.setTimer(() => {
      dispatch({ type: 'expire' })
    }, EXPORT_DONE_MS)
    publish()
    return true
  }

  return {
    getSnapshot: () => published,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispatch,
  }
}

export const exportSiteStore = createExportSiteStore({
  now: () => performance.now(),
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: globalThis.clearTimeout.bind(globalThis),
  requestFrame: (run) => {
    requestAnimationFrame(() => {
      run()
    })
  },
})
