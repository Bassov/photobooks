import type { ExportSiteClock } from '../export/exportSiteStore'
import type { PublishFailure, PublishSummary } from './publishText'

/** Designer spec in-app-publish §1: pill / dialog run state. */
export type PublishState =
  | { kind: 'idle' }
  | { kind: 'running'; percent: number }
  | { kind: 'done'; summary: PublishSummary; bookUrl: string; homeUrl: string }
  | { kind: 'failed'; failure: PublishFailure }

export type PublishEvent =
  | { type: 'start' }
  | { type: 'progress'; percent: number }
  | { type: 'done'; summary: PublishSummary; bookUrl: string; homeUrl: string }
  | { type: 'failed'; failure: PublishFailure }
  /** "Published" has been shown long enough. */
  | { type: 'expire' }
  /** The user opened the failure. */
  | { type: 'seen' }

export const PUBLISH_IDLE: PublishState = { kind: 'idle' }

/** Progress reaches subscribers at most this often. */
export const PUBLISH_PROGRESS_MS = 250
/** The check stays on the pill this long. */
export const PUBLISH_DONE_MS = 4000

/** Pure transitions; one run at a time, percent never goes back. */
export function reducePublish(
  state: PublishState,
  event: PublishEvent,
): PublishState {
  switch (event.type) {
    case 'start':
      return state.kind === 'running' ? state : { kind: 'running', percent: 0 }
    case 'progress':
      return state.kind === 'running' && event.percent > state.percent
        ? { kind: 'running', percent: event.percent }
        : state
    case 'done': {
      const { summary, bookUrl, homeUrl } = event
      return state.kind === 'running'
        ? { kind: 'done', summary, bookUrl, homeUrl }
        : state
    }
    case 'failed':
      return state.kind === 'running'
        ? { kind: 'failed', failure: event.failure }
        : state
    case 'expire':
      return state.kind === 'done' ? PUBLISH_IDLE : state
    case 'seen':
      return state.kind === 'failed' ? PUBLISH_IDLE : state
  }
}

export interface PublishStore {
  getSnapshot: () => PublishState
  subscribe: (listener: () => void) => () => void
  /** `false` when the event changes nothing (e.g. a second `start`). */
  dispatch: (event: PublishEvent) => boolean
}

type TimerHandle = ReturnType<typeof setTimeout>

/**
 * Module store over `reducePublish`. Progress is published at most every
 * `PUBLISH_PROGRESS_MS`, in an animation frame; other events at once. `done`
 * expires after `PUBLISH_DONE_MS`.
 */
export function createPublishStore(clock: ExportSiteClock): PublishStore {
  let state = PUBLISH_IDLE
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

  const dispatch = (event: PublishEvent): boolean => {
    const next = reducePublish(state, event)
    if (next === state) {
      return false
    }
    state = next
    if (event.type === 'progress') {
      if (!flushPending) {
        flushPending = true
        const wait = Math.max(
          0,
          publishedAt + PUBLISH_PROGRESS_MS - clock.now(),
        )
        clock.setTimer(() => {
          clock.requestFrame(publish)
        }, wait)
      }
      return true
    }
    clock.clearTimer(expireTimer)
    if (next.kind === 'done') {
      expireTimer = clock.setTimer(() => {
        dispatch({ type: 'expire' })
      }, PUBLISH_DONE_MS)
    }
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

export const publishStore = createPublishStore({
  now: () => performance.now(),
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: globalThis.clearTimeout.bind(globalThis),
  // Looked up per flush: node (and a test env after teardown) has no
  // `requestAnimationFrame`, so the flush runs at once there.
  requestFrame: (run) => {
    const frame = globalThis.requestAnimationFrame as
      typeof requestAnimationFrame | undefined
    if (typeof frame !== 'function') {
      run()
      return
    }
    frame(() => {
      run()
    })
  },
})

/** P7: whether a publish runs (the Export site pill waits for it). */
export function isPublishRunning(): boolean {
  return publishStore.getSnapshot().kind === 'running'
}
