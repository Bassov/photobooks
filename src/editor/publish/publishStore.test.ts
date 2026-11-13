import { fc, test } from '@fast-check/vitest'
import { describe, expect, it, vi } from 'vitest'
import type { ExportSiteClock } from '../export/exportSiteStore'
import {
  createPublishStore,
  PUBLISH_DONE_MS,
  PUBLISH_IDLE,
  PUBLISH_PROGRESS_MS,
  reducePublish,
  type PublishState,
} from './publishStore'
import type { PublishFailure } from './publishText'

const summary = { uploaded: 3, bytes: 1_200_000, removed: 0, unchanged: 7 }
const done = {
  type: 'done',
  summary,
  bookUrl: 'https://books.example.com/books/abc/',
  homeUrl: 'https://books.example.com/',
} as const
const failure: PublishFailure = {
  code: 'timeout',
  message: '',
  sent: 2,
  total: 5,
}
const running: PublishState = { kind: 'running', percent: 40 }

describe('reducePublish', () => {
  it('starts from idle, done or failed, never twice', () => {
    const started = { kind: 'running', percent: 0 }
    expect(reducePublish(PUBLISH_IDLE, { type: 'start' })).toEqual(started)
    expect(
      reducePublish({ kind: 'failed', failure }, { type: 'start' }),
    ).toEqual(started)
    expect(reducePublish(running, { type: 'start' })).toBe(running)
  })

  it('ends a run in done or failed, and only a run', () => {
    expect(reducePublish(running, done)).toEqual({
      kind: 'done',
      summary,
      bookUrl: done.bookUrl,
      homeUrl: done.homeUrl,
    })
    expect(reducePublish(running, { type: 'failed', failure })).toEqual({
      kind: 'failed',
      failure,
    })
    expect(reducePublish(PUBLISH_IDLE, done)).toBe(PUBLISH_IDLE)
    expect(reducePublish(PUBLISH_IDLE, { type: 'failed', failure })).toBe(
      PUBLISH_IDLE,
    )
  })

  it('expires done and clears a seen failure, nothing else', () => {
    const shown = reducePublish(running, done)
    const failed = reducePublish(running, { type: 'failed', failure })
    expect(reducePublish(shown, { type: 'expire' })).toBe(PUBLISH_IDLE)
    expect(reducePublish(failed, { type: 'seen' })).toBe(PUBLISH_IDLE)
    expect(reducePublish(failed, { type: 'expire' })).toBe(failed)
    expect(reducePublish(shown, { type: 'seen' })).toBe(shown)
    expect(reducePublish(running, { type: 'seen' })).toBe(running)
  })

  test.prop([fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 30 })])(
    'the percent never goes back',
    (percents) => {
      let state = reducePublish(PUBLISH_IDLE, { type: 'start' })
      let highest = 0
      for (const percent of percents) {
        state = reducePublish(state, { type: 'progress', percent })
        highest = Math.max(highest, percent)
        expect(state).toEqual({ kind: 'running', percent: highest })
      }
    },
  )

  it('ignores progress when not running', () => {
    expect(reducePublish(PUBLISH_IDLE, { type: 'progress', percent: 5 })).toBe(
      PUBLISH_IDLE,
    )
  })
})

function fakeClock() {
  let now = 0
  let nextId = 1
  const timers: { at: number; run: () => void; id: number }[] = []
  const frames: (() => void)[] = []
  type TimerHandle = ReturnType<typeof setTimeout>
  const clock: ExportSiteClock = {
    now: () => now,
    setTimer: (run, ms) => {
      const id = nextId
      nextId += 1
      timers.push({ at: now + ms, run, id })
      return id as unknown as TimerHandle
    },
    clearTimer: (handle) => {
      const index = timers.findIndex(
        (timer) => timer.id === (handle as unknown as number),
      )
      if (index >= 0) {
        timers.splice(index, 1)
      }
    },
    requestFrame: (run) => {
      frames.push(run)
    },
  }
  return {
    clock,
    timers,
    advance(ms: number) {
      now += ms
      for (const timer of timers.filter((t) => t.at <= now)) {
        timers.splice(timers.indexOf(timer), 1)
        timer.run()
      }
    },
    frame() {
      for (const run of frames.splice(0)) {
        run()
      }
    },
  }
}

describe('createPublishStore', () => {
  it('drops a second start while a run is going', () => {
    const store = createPublishStore(fakeClock().clock)

    expect(store.dispatch({ type: 'start' })).toBe(true)
    expect(store.dispatch({ type: 'start' })).toBe(false)
    expect(store.getSnapshot()).toEqual({ kind: 'running', percent: 0 })
  })

  it('publishes progress at most every 250 ms, in an animation frame', () => {
    const fake = fakeClock()
    const store = createPublishStore(fake.clock)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.dispatch({ type: 'start' })
    listener.mockClear()

    store.dispatch({ type: 'progress', percent: 5 })
    store.dispatch({ type: 'progress', percent: 9 })
    fake.advance(PUBLISH_PROGRESS_MS - 1)
    fake.frame()
    expect(listener).not.toHaveBeenCalled()

    fake.advance(1)
    expect(listener).not.toHaveBeenCalled()
    fake.frame()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toEqual({ kind: 'running', percent: 9 })

    unsubscribe()
    store.dispatch({ type: 'failed', failure })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('publishes the end at once and goes idle 4 s after done', () => {
    const fake = fakeClock()
    const store = createPublishStore(fake.clock)
    store.dispatch({ type: 'start' })
    store.dispatch({ type: 'progress', percent: 90 })

    store.dispatch(done)
    expect(store.getSnapshot().kind).toBe('done')
    fake.advance(PUBLISH_PROGRESS_MS)
    fake.frame()
    expect(store.getSnapshot().kind).toBe('done')

    fake.advance(PUBLISH_DONE_MS - PUBLISH_PROGRESS_MS - 1)
    expect(store.getSnapshot().kind).toBe('done')
    fake.advance(1)
    expect(store.getSnapshot()).toBe(PUBLISH_IDLE)
  })

  it('keeps a failure until it is seen, with no expiry timer', () => {
    const fake = fakeClock()
    const store = createPublishStore(fake.clock)
    store.dispatch({ type: 'start' })
    store.dispatch({ type: 'failed', failure })

    expect(fake.timers).toEqual([])
    fake.advance(PUBLISH_DONE_MS * 2)
    expect(store.getSnapshot()).toEqual({ kind: 'failed', failure })
    expect(store.dispatch({ type: 'seen' })).toBe(true)
    expect(store.getSnapshot()).toBe(PUBLISH_IDLE)
  })

  it('a new run cancels the pending done expiry', () => {
    const fake = fakeClock()
    const store = createPublishStore(fake.clock)
    store.dispatch({ type: 'start' })
    store.dispatch(done)
    store.dispatch({ type: 'start' })

    fake.advance(PUBLISH_DONE_MS)
    expect(store.getSnapshot()).toEqual({ kind: 'running', percent: 0 })
  })
})
