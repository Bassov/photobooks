import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants } from '../index'
import type { Frame } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

function rectOf(x: number, y: number, width = 20, height = 10) {
  return { x, y, width, height }
}

function book(frames: Frame[]) {
  return makeBook({
    spreads: [makeSpread({ templateId: 'one-per-page', frames })],
  })
}

function frameOf(b: ReturnType<typeof book>, id: string): Frame {
  const frame = b.spreads[0]?.frames.find((f) => f.id === id)
  if (frame === undefined) {
    throw new Error(`no ${id}`)
  }
  return frame
}

const A = makeFrame({ id: 'a', rect: rectOf(10, 10) })
const LOCKED = makeFrame({ id: 'a', rect: rectOf(10, 10), locked: true })

describe('moveFrame', () => {
  it('translates an unlocked frame and detaches the template', () => {
    const next = applyBookOp(book([A]), {
      type: 'moveFrame',
      spreadId: 'spread-1',
      frameId: 'a',
      dx: 5,
      dy: -2,
    })
    expect(frameOf(next, 'a').rect).toEqual(rectOf(15, 8))
    expect(next.spreads[0]?.templateId).toBeUndefined()
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it.each([
    ['zero delta', 0, 0],
    ['NaN', Number.NaN, 1],
    ['Infinity', 1, Number.POSITIVE_INFINITY],
  ])('%s → unchanged', (_name, dx, dy) => {
    const before = book([A])
    expect(
      applyBookOp(before, {
        type: 'moveFrame',
        spreadId: 'spread-1',
        frameId: 'a',
        dx,
        dy,
      }),
    ).toBe(before)
  })

  it('skips a locked frame and unknown ids', () => {
    const before = book([LOCKED])
    for (const frameId of ['a', 'nope']) {
      expect(
        applyBookOp(before, {
          type: 'moveFrame',
          spreadId: 'spread-1',
          frameId,
          dx: 5,
          dy: 5,
        }),
      ).toBe(before)
    }
  })
})

describe('resizeFrame', () => {
  const op = (rect: Frame['rect']) =>
    ({ type: 'resizeFrame', spreadId: 'spread-1', frameId: 'a', rect }) as const

  it('sets the rect of an unlocked frame', () => {
    const next = applyBookOp(book([A]), op(rectOf(8, 9, 30, 12)))
    expect(frameOf(next, 'a').rect).toEqual(rectOf(8, 9, 30, 12))
    expect(next.spreads[0]?.templateId).toBeUndefined()
  })

  it.each([
    ['narrow', rectOf(10, 10, 4.9, 10)],
    ['short', rectOf(10, 10, 20, 4.9)],
    ['NaN', rectOf(Number.NaN, 10)],
    ['same rect', rectOf(10, 10)],
  ])('%s → unchanged', (_name, rect) => {
    const before = book([A])
    expect(applyBookOp(before, op(rect))).toBe(before)
  })

  it('accepts exactly the minimum edge', () => {
    const next = applyBookOp(book([A]), op(rectOf(10, 10, 5, 5)))
    expect(frameOf(next, 'a').rect.width).toBe(5)
  })

  it('skips a locked frame', () => {
    const before = book([LOCKED])
    expect(applyBookOp(before, op(rectOf(0, 0, 50, 50)))).toBe(before)
  })
})

describe('rotateFrame', () => {
  const op = (rotationDeg: number) =>
    ({
      type: 'rotateFrame',
      spreadId: 'spread-1',
      frameId: 'a',
      rotationDeg,
    }) as const

  it('sets rotation and detaches the template', () => {
    const next = applyBookOp(book([A]), op(30))
    expect(frameOf(next, 'a').rotationDeg).toBe(30)
    expect(next.spreads[0]?.templateId).toBeUndefined()
  })

  it.each([
    [370, 10],
    [-90, 270],
    [360, 0],
  ])('normalises %d° to [0, 360) → %d', (input, expected) => {
    const start = book([{ ...A, rotationDeg: 45 }])
    expect(frameOf(applyBookOp(start, op(input)), 'a').rotationDeg).toBe(
      expected,
    )
  })

  it('same angle (absent counts as 0), NaN and locked → unchanged', () => {
    const plain = book([A])
    expect(applyBookOp(plain, op(0))).toBe(plain)
    expect(applyBookOp(plain, op(360))).toBe(plain)
    expect(applyBookOp(plain, op(Number.NaN))).toBe(plain)
    const locked = book([LOCKED])
    expect(applyBookOp(locked, op(45))).toBe(locked)
  })
})

describe('alignFrames', () => {
  const fa = makeFrame({ id: 'a', rect: rectOf(10, 10, 20, 10) })
  const fb = makeFrame({ id: 'b', rect: rectOf(50, 40, 30, 20) })
  const fc = makeFrame({ id: 'c', rect: rectOf(100, 5, 10, 10) })
  const f = [fa, fb, fc]
  const run = (
    frames: Frame[],
    edge: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY',
    ids = ['a', 'b', 'c'],
  ) =>
    applyBookOp(book(frames), {
      type: 'alignFrames',
      spreadId: 'spread-1',
      frameIds: ids,
      edge,
    })

  it.each([
    ['left', 'b', { x: 10 }],
    ['right', 'a', { x: 90 }],
    ['top', 'b', { y: 5 }],
    ['bottom', 'a', { y: 50 }],
    ['centerX', 'c', { x: 55 }],
    ['centerY', 'a', { y: 27.5 }],
  ] as const)('%s', (edge, id, expected) => {
    const rect = frameOf(run(f, edge), id).rect
    expect(rect).toMatchObject(expected)
  })

  it('locked frames neither move nor widen the bounds', () => {
    const lockedC = { ...fc, locked: true }
    const next = run([fa, fb, lockedC], 'right')
    expect(frameOf(next, 'a').rect.x).toBe(60)
    expect(frameOf(next, 'c')).toEqual(lockedC)
  })

  it('under two unlocked targets → unchanged', () => {
    const before = book([fa, { ...fb, locked: true }])
    expect(
      applyBookOp(before, {
        type: 'alignFrames',
        spreadId: 'spread-1',
        frameIds: ['a', 'b'],
        edge: 'left',
      }),
    ).toBe(before)
  })

  it('already aligned → unchanged', () => {
    const aligned = book([
      makeFrame({ id: 'a', rect: rectOf(10, 0) }),
      makeFrame({ id: 'b', rect: rectOf(10, 30) }),
    ])
    expect(
      applyBookOp(aligned, {
        type: 'alignFrames',
        spreadId: 'spread-1',
        frameIds: ['a', 'b'],
        edge: 'left',
      }),
    ).toBe(aligned)
  })
})

describe('distributeFrames', () => {
  const fa = makeFrame({ id: 'a', rect: rectOf(0, 0, 10, 10) })
  const fb = makeFrame({ id: 'b', rect: rectOf(15, 30, 10, 10) })
  const fc = makeFrame({ id: 'c', rect: rectOf(50, 70, 10, 10) })
  const f = [fa, fb, fc]
  const run = (frames: Frame[], axis: 'horizontal' | 'vertical') =>
    applyBookOp(book(frames), {
      type: 'distributeFrames',
      spreadId: 'spread-1',
      frameIds: ['a', 'b', 'c'],
      axis,
    })

  it('evens horizontal gaps, keeping the outer two', () => {
    const next = run(f, 'horizontal')
    expect(frameOf(next, 'a').rect.x).toBe(0)
    expect(frameOf(next, 'b').rect.x).toBe(25)
    expect(frameOf(next, 'c').rect.x).toBe(50)
    expect(next.spreads[0]?.templateId).toBeUndefined()
  })

  it('evens vertical gaps', () => {
    expect(frameOf(run(f, 'vertical'), 'b').rect.y).toBe(35)
  })

  it('a locked middle frame leaves two targets → unchanged', () => {
    const before = book([fa, { ...fb, locked: true }, fc])
    expect(
      applyBookOp(before, {
        type: 'distributeFrames',
        spreadId: 'spread-1',
        frameIds: ['a', 'b', 'c'],
        axis: 'horizontal',
      }),
    ).toBe(before)
  })

  it('already even → unchanged', () => {
    const even = book([
      makeFrame({ id: 'a', rect: rectOf(0, 0, 10, 10) }),
      makeFrame({ id: 'b', rect: rectOf(20, 0, 10, 10) }),
      makeFrame({ id: 'c', rect: rectOf(40, 0, 10, 10) }),
    ])
    expect(
      applyBookOp(even, {
        type: 'distributeFrames',
        spreadId: 'spread-1',
        frameIds: ['a', 'b', 'c'],
        axis: 'horizontal',
      }),
    ).toBe(even)
  })
})
