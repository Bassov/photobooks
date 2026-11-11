import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeSpread } from '../../../core/testing/fixtures'
import { paintPage } from '../../../render/pagePainter'
import { createFaceSource, paintOrder } from './faces'
import { fakeCanvas2d, type FakeContext } from './testing.test-helpers'

vi.mock('../../../render/pagePainter', () => ({
  paintPage: vi.fn(() => Promise.resolve()),
}))

const painted = vi.mocked(paintPage)
/** 6 spreads = 10 printed pages, 200 × 250 mm */
const book = makeBook({
  spreads: Array.from({ length: 6 }, (_, i) =>
    makeSpread({ id: `s${String(i)}` }),
  ),
  settings: { trim: { widthMm: 200, heightMm: 250 } },
})
let contexts: Map<HTMLCanvasElement, FakeContext>
let log: string[]

beforeEach(() => {
  contexts = fakeCanvas2d()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  painted.mockClear()
  painted.mockImplementation((_, __, page) => {
    log.push(`paint ${String(page)}`)
    return Promise.resolve()
  })
  log = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

const images = (page: number) => {
  log.push(`images ${String(page)}`)
  return Promise.resolve(new Map())
}
const source = () =>
  createFaceSource({
    book,
    images,
    pagePx: 100,
    yieldTask: () => {
      log.push('yield')
      return Promise.resolve()
    },
  })
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
const paints = () => log.filter((l) => l.startsWith('paint '))

describe('paintOrder', () => {
  it('puts the pages within 2 views first, nearest first', () => {
    expect(paintOrder([0, 9, 4], 3)).toEqual([4, 0, 9])
    expect(paintOrder([9, 2, 1, 7], 2)).toEqual([1, 2, 9, 7])
    expect(paintOrder([6, 5], 1)).toEqual([6, 5])
  })
})

describe('createFaceSource', () => {
  it('paints a face at the page size, then grain after a yield', async () => {
    const s = source()

    const c = (await s.face(2)) as HTMLCanvasElement

    expect([c.width, c.height]).toEqual([100, 125])
    const [x, ...args] = painted.mock.calls[0] ?? []
    expect(x).toBe(c.getContext('2d'))
    expect(args).toEqual([book, 3, new Map(), 0.5])
    expect(log.slice(0, 3)).toEqual(['images 3', 'paint 3', 'yield'])
    expect(contexts.get(c)?.calls).toEqual([
      ['getImageData', 0, 0, 100, 125],
      ['putImageData', 'data 50000', 0, 0],
    ])
    expect(s.face(2)).toBe(s.face(2))
  })

  it('paints the requests of one task by distance to the view', async () => {
    const s = source()

    const faces = [s.face(9), s.face(0), s.face(4)]
    await Promise.all(faces)

    expect(paints()).toEqual(['paint 1', 'paint 5', 'paint 10'])
    expect(log.slice(0, 6)).toEqual([
      'images 1',
      'paint 1',
      'yield',
      'yield',
      'images 5',
      'paint 5',
    ])
  })

  it('queues the focused view ± 2 and paints it first', async () => {
    const s = source()

    const far = s.face(9)
    s.focus(3)
    await far

    expect(paints()).toEqual(
      [3, 4, 1, 2, 5, 6, 0, 7, 8, 9].map((p) => `paint ${String(p + 1)}`),
    )
  })

  it('re-ranks the queue when the focus moves', async () => {
    const s = source()
    s.focus(1)
    await s.face(0)

    s.focus(5)
    await s.face(9)
    s.dispose()

    expect(paints()).toEqual(
      [0, 7, 8, 5, 6, 9].map((p) => `paint ${String(p + 1)}`),
    )
  })

  it('keeps queued faces without a reader from rejecting unhandled', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const s = source()

    s.focus(1)
    s.dispose()
    await settle()

    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })

  it('rejects a face that fails and paints on', async () => {
    painted.mockImplementationOnce(() => Promise.reject(new Error('decode')))
    const s = source()

    const bad = s.face(0)
    const good = s.face(1)

    await expect(bad).rejects.toThrow('decode')
    await expect(good).resolves.toBeInstanceOf(HTMLCanvasElement)
  })

  it('rejects the queue on dispose and skips the grain of a face in flight', async () => {
    const s = source()
    const first = s.face(0)
    const queued = s.face(1)
    await Promise.resolve()
    await Promise.resolve()

    s.dispose()

    const c = (await first) as HTMLCanvasElement
    await expect(queued).rejects.toThrow('disposed')
    expect(contexts.get(c)?.calls ?? []).toEqual([])
    await settle()
    expect(paints()).toEqual(['paint 1'])
  })

  it('yields to the next task by default', async () => {
    vi.useFakeTimers()
    const s = createFaceSource({ book, images, pagePx: 40 })
    const done = vi.fn()

    void s.face(0).then(done)
    await vi.advanceTimersByTimeAsync(0)

    expect(done).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
