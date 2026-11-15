type TimerHandle = ReturnType<typeof setTimeout>

export interface JobClock {
  now: () => number
  setTimer: (run: () => void, ms: number) => TimerHandle
  clearTimer: (handle: TimerHandle | undefined) => void
  requestFrame: (run: () => void) => void
}

export interface JobStore<S, E> {
  getSnapshot: () => S
  subscribe: (listener: () => void) => () => void
  /** `false` when the reducer ignores the event (e.g. a second start). */
  dispatch: (event: E) => boolean
}

/** Progress reaches subscribers at most this often. */
export const JOB_PROGRESS_MS = 250
/** A finished job's outcome stays on its pill this long. */
export const JOB_DONE_MS = 4000

/**
 * Module store over a pure job reducer (Export site, Print). `progress` is
 * published at most every `JOB_PROGRESS_MS`, in an animation frame; other
 * events at once, each arming an `expire` after `JOB_DONE_MS` (the reducer
 * lets it end only a done job).
 */
export function createJobStore<S, E extends { type: string }>(
  // Only reducers that take `expire` fit: the store dispatches it.
  reduce: { type: 'expire' } extends E ? (state: S, event: E) => S : never,
  idle: S,
  clock: JobClock,
): JobStore<S, E> {
  const expire = { type: 'expire' } as E
  let state = idle
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

  const dispatch = (event: E): boolean => {
    const next = reduce(state, event)
    if (next === state) {
      return false
    }
    state = next
    if (event.type === 'progress') {
      if (!flushPending) {
        flushPending = true
        const wait = Math.max(0, publishedAt + JOB_PROGRESS_MS - clock.now())
        clock.setTimer(() => {
          clock.requestFrame(publish)
        }, wait)
      }
      return true
    }
    // Every other change shows at once; only a done job reacts to the expiry.
    clock.clearTimer(expireTimer)
    expireTimer = clock.setTimer(() => {
      dispatch(expire)
    }, JOB_DONE_MS)
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

/** The browser clock: `performance.now`, `setTimeout`, `requestAnimationFrame`. */
export const browserJobClock: JobClock = {
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
}
