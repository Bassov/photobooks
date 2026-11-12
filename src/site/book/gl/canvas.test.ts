import { afterEach, describe, expect, it, vi } from 'vitest'
import { ctx, cv, grain } from './canvas'
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
