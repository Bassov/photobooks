import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants } from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const RECT = { x: 10, y: 20, width: 40, height: 30 }

function book() {
  return makeBook({
    spreads: [
      makeSpread({
        templateId: 'one-per-page',
        frames: [makeFrame({ id: 'frame-1', z: 3 })],
      }),
    ],
  })
}

describe('addFrame', () => {
  it('appends an empty frame on top and clears the template binding', () => {
    const next = applyBookOp(book(), {
      type: 'addFrame',
      spreadId: 'spread-1',
      rect: RECT,
    })
    const spread = next.spreads[0]
    expect(spread?.templateId).toBeUndefined()
    expect(spread?.frames).toHaveLength(2)
    expect(spread?.frames[1]).toEqual({ id: 'frame-2', rect: RECT, z: 4 })
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it.each([
    { width: 4.9, height: 30 },
    { width: 30, height: 4.9 },
  ])('rejects an edge under 5 mm: %o', (size) => {
    const before = book()
    expect(
      applyBookOp(before, {
        type: 'addFrame',
        spreadId: 'spread-1',
        rect: { ...RECT, ...size },
      }),
    ).toBe(before)
  })

  it('accepts exactly 5 mm and ignores a duplicate id or unknown spread', () => {
    const before = book()
    const small = { x: 0, y: 0, width: 5, height: 5 }
    expect(
      applyBookOp(before, {
        type: 'addFrame',
        spreadId: 'spread-1',
        rect: small,
        id: 'mine',
      }).spreads[0]?.frames,
    ).toHaveLength(2)
    expect(
      applyBookOp(before, {
        type: 'addFrame',
        spreadId: 'spread-1',
        rect: small,
        id: 'frame-1',
      }),
    ).toBe(before)
    expect(
      applyBookOp(before, { type: 'addFrame', spreadId: 'nope', rect: small }),
    ).toBe(before)
  })
})

describe('removeFrames', () => {
  it('removes the frames and clears the template binding', () => {
    const next = applyBookOp(book(), {
      type: 'removeFrames',
      spreadId: 'spread-1',
      frameIds: ['frame-1'],
    })
    expect(next.spreads[0]?.frames).toEqual([])
    expect(next.spreads[0]?.templateId).toBeUndefined()
  })

  it('is a no-op when nothing matches', () => {
    const before = book()
    expect(
      applyBookOp(before, {
        type: 'removeFrames',
        spreadId: 'spread-1',
        frameIds: ['ghost'],
      }),
    ).toBe(before)
  })
})

describe('setFrameRect', () => {
  it('moves the frame and clears the template binding', () => {
    const next = applyBookOp(book(), {
      type: 'setFrameRect',
      spreadId: 'spread-1',
      frameId: 'frame-1',
      rect: RECT,
    })
    expect(next.spreads[0]?.frames[0]?.rect).toEqual(RECT)
    expect(next.spreads[0]?.frames[0]?.z).toBe(3)
    expect(next.spreads[0]?.templateId).toBeUndefined()
  })

  it('is a no-op for the same rect, a degenerate rect or an unknown frame', () => {
    const before = book()
    const same = before.spreads[0]?.frames[0]?.rect ?? RECT
    for (const [frameId, rect] of [
      ['frame-1', same],
      ['frame-1', { ...RECT, width: 0 }],
      ['ghost', RECT],
    ] as const) {
      expect(
        applyBookOp(before, {
          type: 'setFrameRect',
          spreadId: 'spread-1',
          frameId,
          rect,
        }),
      ).toBe(before)
    }
  })
})
