import { describe, expect, it, vi } from 'vitest'
import {
  createExportSiteStore,
  EXPORT_DONE_MS,
  EXPORT_PROGRESS_MS,
  EXPORT_SITE_IDLE,
  reduceExportSite,
  type ExportSiteState,
} from './exportSiteStore'

const summary = { books: 1, files: 3, bytes: 10 }
const running: ExportSiteState = {
  kind: 'running',
  phase: 'render',
  percent: 40,
}

describe('reduceExportSite', () => {
  it('starts from idle, done or failed, never twice', () => {
    const started = { kind: 'running', phase: 'prepare', percent: 0 }
    expect(reduceExportSite(EXPORT_SITE_IDLE, { type: 'start' })).toEqual(
      started,
    )
    expect(
      reduceExportSite(
        { kind: 'failed', code: 'quota', folder: 'S' },
        { type: 'start' },
      ),
    ).toEqual(started)
    expect(reduceExportSite(running, { type: 'start' })).toBe(running)
  })

  it('keeps the percent monotonic and ignores progress when not running', () => {
    expect(
      reduceExportSite(running, {
        type: 'progress',
        phase: 'write',
        percent: 30,
      }),
    ).toEqual({ kind: 'running', phase: 'write', percent: 40 })
    expect(
      reduceExportSite(EXPORT_SITE_IDLE, {
        type: 'progress',
        phase: 'write',
        percent: 90,
      }),
    ).toBe(EXPORT_SITE_IDLE)
  })

  it('ends a run as done or failed only while running', () => {
    expect(
      reduceExportSite(running, { type: 'done', summary, folder: 'S' }),
    ).toEqual({ kind: 'done', summary, folder: 'S' })
    expect(
      reduceExportSite(running, {
        type: 'failed',
        code: 'permission',
        folder: 'S',
      }),
    ).toEqual({ kind: 'failed', code: 'permission', folder: 'S' })
    expect(
      reduceExportSite(EXPORT_SITE_IDLE, {
        type: 'done',
        summary,
        folder: 'S',
      }),
    ).toBe(EXPORT_SITE_IDLE)
    expect(
      reduceExportSite(EXPORT_SITE_IDLE, {
        type: 'failed',
        code: 'quota',
        folder: 'S',
      }),
    ).toBe(EXPORT_SITE_IDLE)
  })

  it('expires done and clears a seen failure only', () => {
    const done: ExportSiteState = { kind: 'done', summary, folder: 'S' }
    const failed: ExportSiteState = {
      kind: 'failed',
      code: 'unknown',
      folder: 'S',
    }
    expect(reduceExportSite(done, { type: 'expire' })).toBe(EXPORT_SITE_IDLE)
    expect(reduceExportSite(failed, { type: 'expire' })).toBe(failed)
    expect(reduceExportSite(failed, { type: 'seen' })).toBe(EXPORT_SITE_IDLE)
    expect(reduceExportSite(done, { type: 'seen' })).toBe(done)
  })
})

function fakeClock() {
  let now = 0
  const timers: { at: number; run: () => void; id: number }[] = []
  const frames: (() => void)[] = []
  let nextId = 1
  return {
    clock: {
      now: () => now,
      setTimer: (run: () => void, ms: number) => {
        const id = nextId
        nextId += 1
        timers.push({ at: now + ms, run, id })
        return id
      },
      clearTimer: (handle: unknown) => {
        const index = timers.findIndex((timer) => timer.id === handle)
        if (index >= 0) {
          timers.splice(index, 1)
        }
      },
      requestFrame: (run: () => void) => {
        frames.push(run)
      },
    },
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

describe('createExportSiteStore', () => {
  it('drops a second start while a run is going', () => {
    const { clock } = fakeClock()
    const store = createExportSiteStore(clock)

    expect(store.dispatch({ type: 'start' })).toBe(true)
    expect(store.dispatch({ type: 'start' })).toBe(false)
    expect(store.getSnapshot()).toEqual({
      kind: 'running',
      phase: 'prepare',
      percent: 0,
    })
  })

  it('publishes progress at most every 250 ms, in an animation frame', () => {
    const fake = fakeClock()
    const store = createExportSiteStore(fake.clock)
    const listener = vi.fn()
    store.subscribe(listener)
    store.dispatch({ type: 'start' })
    listener.mockClear()

    store.dispatch({ type: 'progress', phase: 'prepare', percent: 5 })
    store.dispatch({ type: 'progress', phase: 'prepare', percent: 9 })
    fake.advance(EXPORT_PROGRESS_MS - 1)
    fake.frame()
    expect(listener).not.toHaveBeenCalled()

    fake.advance(1)
    expect(listener).not.toHaveBeenCalled()
    fake.frame()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toMatchObject({ percent: 9 })
  })

  it('publishes the end at once and goes idle after 4 s', () => {
    const fake = fakeClock()
    const store = createExportSiteStore(fake.clock)
    store.dispatch({ type: 'start' })
    store.dispatch({ type: 'progress', phase: 'write', percent: 90 })

    store.dispatch({ type: 'done', summary, folder: 'S' })
    expect(store.getSnapshot()).toEqual({ kind: 'done', summary, folder: 'S' })
    fake.advance(EXPORT_PROGRESS_MS)
    fake.frame()
    expect(store.getSnapshot().kind).toBe('done')

    fake.advance(EXPORT_DONE_MS - EXPORT_PROGRESS_MS)
    expect(store.getSnapshot()).toBe(EXPORT_SITE_IDLE)
  })

  it('throttles the next run again after an end', () => {
    const fake = fakeClock()
    const store = createExportSiteStore(fake.clock)
    store.dispatch({ type: 'start' })
    store.dispatch({ type: 'progress', phase: 'prepare', percent: 1 })
    store.dispatch({ type: 'failed', code: 'quota', folder: 'S' })
    store.dispatch({ type: 'seen' })
    store.dispatch({ type: 'start' })

    store.dispatch({ type: 'progress', phase: 'render', percent: 50 })
    fake.advance(EXPORT_PROGRESS_MS)
    fake.frame()

    expect(store.getSnapshot()).toMatchObject({ percent: 50 })
  })

  it('stops notifying after unsubscribe', () => {
    const { clock } = fakeClock()
    const store = createExportSiteStore(clock)
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    stop()

    store.dispatch({ type: 'start' })

    expect(listener).not.toHaveBeenCalled()
  })
})
