import { afterEach, describe, expect, it, vi } from 'vitest'

import { createProgressBatcher } from './progressBatch'

describe('createProgressBatcher', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('coalesces running ticks onto one rAF and flushes terminal states', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb)
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      callbacks[id - 1] = () => undefined
    })

    const publish = vi.fn()
    const batcher = createProgressBatcher(publish)

    batcher.schedule({ total: 10, completed: 0, running: true })
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenLastCalledWith({
      total: 10,
      completed: 0,
      running: true,
    })

    batcher.schedule({ total: 10, completed: 1, running: true })
    batcher.schedule({ total: 10, completed: 2, running: true })
    batcher.schedule({ total: 10, completed: 3, running: true })
    expect(publish).toHaveBeenCalledTimes(1)
    expect(callbacks).toHaveLength(1)

    callbacks[0]?.(0)
    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish).toHaveBeenLastCalledWith({
      total: 10,
      completed: 3,
      running: true,
    })

    batcher.schedule({ total: 10, completed: 10, running: false })
    expect(publish).toHaveBeenCalledTimes(3)
    expect(publish).toHaveBeenLastCalledWith({
      total: 10,
      completed: 10,
      running: false,
    })

    batcher.schedule(null)
    expect(publish).toHaveBeenLastCalledWith(null)
  })

  it('flush and reset are no-ops without pending work', () => {
    const publish = vi.fn()
    const batcher = createProgressBatcher(publish)
    batcher.flush()
    batcher.reset()
    expect(publish).not.toHaveBeenCalled()
  })

  it('cancel is a no-op when no rAF is scheduled and reset drops pending', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb)
      return callbacks.length
    })
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)

    const publish = vi.fn()
    const batcher = createProgressBatcher(publish)

    batcher.reset()
    expect(cancel).not.toHaveBeenCalled()

    batcher.schedule({ total: 4, completed: 1, running: true })
    expect(callbacks).toHaveLength(1)
    batcher.reset()
    expect(cancel).toHaveBeenCalledWith(1)
    expect(publish).not.toHaveBeenCalled()

    batcher.schedule({ total: 4, completed: 2, running: true })
    batcher.flush()
    expect(publish).toHaveBeenCalledWith({
      total: 4,
      completed: 2,
      running: true,
    })
  })

  it('second mid-scan tick reuses the same rAF slot', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb)
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const publish = vi.fn()
    const batcher = createProgressBatcher(publish)
    batcher.schedule({ total: 5, completed: 1, running: true })
    batcher.schedule({ total: 5, completed: 2, running: true })
    expect(callbacks).toHaveLength(1)
    callbacks[0]?.(0)
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenLastCalledWith({
      total: 5,
      completed: 2,
      running: true,
    })
  })
})
