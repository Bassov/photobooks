import { afterEach, describe, expect, it, vi } from 'vitest'
import { ctx, cv, grain, GRAIN_BAND_PX, nextTask, rowBands } from './canvas'
import { fakeCanvas2d } from './testing.test-helpers'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cv', () => {
  it('rounds the size and keeps at least 1 px', () => {
    const c = cv(10.6, 0.2)

    expect([c.width, c.height]).toEqual([11, 1])
    expect(c.tagName).toBe('CANVAS')
  })
})

describe('ctx', () => {
  it('throws without a 2D context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    expect(() => ctx(cv(1, 1))).toThrow('no 2D context')
  })

  it('returns the 2D context', () => {
    const contexts = fakeCanvas2d()
    const c = cv(2, 2)

    expect(ctx(c)).toBe(c.getContext('2d'))
    expect(contexts.has(c)).toBe(true)
  })
})

describe('grain', () => {
  it('adds the same noise to r, g, b per cell, rows renewed every cell', () => {
    const contexts = fakeCanvas2d()
    const c = cv(3, 4)
    const noise = [0.9, 0.1, 0.6, 0.3, 0.75, 0.25]
    let n = 0
    vi.spyOn(Math, 'random').mockImplementation(() => noise[n++ % 6] ?? 0)

    grain(ctx(c), 3, 4, 10, 2)

    const put = contexts.get(c)?.put
    const px = (x: number, y: number) =>
      Array.from(put?.slice((y * 3 + x) * 4, (y * 3 + x) * 4 + 4) ?? [])
    expect(n).toBe(4)
    expect(px(0, 0)).toEqual([132, 132, 132, 128])
    expect(px(1, 0)).toEqual([132, 132, 132, 128])
    expect(px(2, 0)).toEqual([124, 124, 124, 128])
    expect(px(0, 1)).toEqual([132, 132, 132, 128])
    expect(px(0, 2)).toEqual([129, 129, 129, 128])
    expect(px(2, 3)).toEqual([126, 126, 126, 128])
    expect(contexts.get(c)?.calls[0]).toEqual(['getImageData', 0, 0, 3, 4])
  })

  it('grains rows y0 … y1 only, noise renewed from y0', () => {
    const contexts = fakeCanvas2d()
    const c = cv(2, 5)
    const noise = [0.9, 0.1]
    let n = 0
    vi.spyOn(Math, 'random').mockImplementation(() => noise[n++ % 2] ?? 0)

    grain(ctx(c), 2, 5, 10, 2, 1, 4)

    const calls = contexts.get(c)?.calls
    expect(calls?.[0]).toEqual(['getImageData', 0, 1, 2, 3])
    expect(calls?.[1]).toEqual(['putImageData', 'data 24', 0, 1])
    expect(n).toBe(2)
    expect(Array.from(contexts.get(c)?.put ?? [])).toEqual([
      132, 132, 132, 128, 132, 132, 132, 128, 132, 132, 132, 128, 132, 132, 132,
      128, 124, 124, 124, 128, 124, 124, 124, 128,
    ])
  })

  it('defaults to 1-texel cells', () => {
    const contexts = fakeCanvas2d()
    const c = cv(2, 1)
    const noise = [1, 0]
    let n = 0
    vi.spyOn(Math, 'random').mockImplementation(() => noise[n++] ?? 0)

    grain(ctx(c), 2, 1, 4)

    expect(Array.from(contexts.get(c)?.put ?? [])).toEqual([
      130, 130, 130, 128, 126, 126, 126, 128,
    ])
  })
})

describe('rowBands', () => {
  it('splits a 2× page grain into 8 whole-cell bands of at most GRAIN_BAND_PX texels', () => {
    const bands = rowBands(1200, 1600, GRAIN_BAND_PX, 2)

    expect(bands).toHaveLength(8)
    expect(bands[0]).toEqual([0, 218])
    expect(bands.at(-1)).toEqual([1526, 1600])
    for (const [y0, y1] of bands) {
      expect(y0 % 2).toBe(0)
      expect((y1 - y0) * 1200).toBeLessThanOrEqual(GRAIN_BAND_PX)
    }
    expect(bands.flatMap(([y0, y1]) => [y0, y1]).slice(1, -1)).toEqual(
      bands.slice(1).flatMap(([y0]) => [y0, y0]),
    )
  })

  it('keeps one band for a small canvas and one cell row for a very wide one', () => {
    expect(rowBands(100, 125, GRAIN_BAND_PX, 2)).toEqual([[0, 125]])
    expect(rowBands(GRAIN_BAND_PX, 3, GRAIN_BAND_PX, 2)).toEqual([
      [0, 2],
      [2, 3],
    ])
  })

  it('defaults to 1-row cells', () => {
    expect(rowBands(1200, 1600, 1 << 19)).toEqual([
      [0, 436],
      [436, 872],
      [872, 1308],
      [1308, 1600],
    ])
    expect(rowBands(10, 3, 5)).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ])
  })
})

describe('nextTask', () => {
  it('resolves on the next timer task', async () => {
    vi.useFakeTimers()
    const done = vi.fn()

    void nextTask().then(done)
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)

    expect(done).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
