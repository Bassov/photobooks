// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PUBLISH_PROGRESS_MS, publishStore } from './publishStore'
import type { PublishFailure } from './publishText'

const failure: PublishFailure = {
  code: 'timeout',
  message: '',
  sent: 0,
  total: 1,
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  publishStore.dispatch({ type: 'failed', failure })
  publishStore.dispatch({ type: 'seen' })
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('publishStore without requestAnimationFrame', () => {
  it('flushes progress with no error', () => {
    expect(globalThis.requestAnimationFrame).toBeUndefined()
    const listener = vi.fn()
    const unsubscribe = publishStore.subscribe(listener)
    publishStore.dispatch({ type: 'start' })
    listener.mockClear()

    publishStore.dispatch({ type: 'progress', percent: 30 })

    expect(() => {
      vi.advanceTimersByTime(PUBLISH_PROGRESS_MS)
    }).not.toThrow()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(publishStore.getSnapshot()).toEqual({ kind: 'running', percent: 30 })
    unsubscribe()
  })

  it('still waits for a frame once one exists', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
      frames.push(run)
      return frames.length
    })
    const listener = vi.fn()
    const unsubscribe = publishStore.subscribe(listener)
    publishStore.dispatch({ type: 'start' })
    listener.mockClear()

    publishStore.dispatch({ type: 'progress', percent: 60 })
    vi.advanceTimersByTime(PUBLISH_PROGRESS_MS)
    expect(listener).not.toHaveBeenCalled()

    for (const run of frames.splice(0)) {
      run(0)
    }
    expect(listener).toHaveBeenCalledTimes(1)
    expect(publishStore.getSnapshot()).toEqual({ kind: 'running', percent: 60 })
    unsubscribe()
  })
})
