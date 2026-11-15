import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserJobClock } from './jobStore'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('browserJobClock.requestFrame', () => {
  it('runs in the next animation frame', () => {
    const frames: (() => void)[] = []
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => {
      frames.push(run)
      return 1
    })
    const run = vi.fn()

    browserJobClock.requestFrame(run)

    expect(run).not.toHaveBeenCalled()
    frames[0]?.()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('runs at once without requestAnimationFrame', () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    const run = vi.fn()

    browserJobClock.requestFrame(run)

    expect(run).toHaveBeenCalledTimes(1)
  })
})
