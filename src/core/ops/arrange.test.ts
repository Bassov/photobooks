import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants, layerOf } from '../index'
import type { Frame } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import type { ZMove } from './arrange'

function book(frames: Frame[]) {
  return makeBook({
    spreads: [makeSpread({ templateId: 'one-per-page', frames })],
  })
}

const trio = () => [
  makeFrame({ id: 'a', z: 1 }),
  makeFrame({ id: 'b', z: 2 }),
  makeFrame({ id: 'c', z: 3 }),
]

function stackOf(b: ReturnType<typeof book>): string[] {
  const frames = b.spreads[0]?.frames ?? []
  return [...frames].sort((x, y) => x.z - y.z).map((f) => f.id)
}

function reorder(b: ReturnType<typeof book>, frameId: string, move: ZMove) {
  return applyBookOp(b, {
    type: 'reorderFrame',
    spreadId: 'spread-1',
    frameId,
    move,
  })
}

describe('reorderFrame', () => {
  it.each<[string, ZMove, string[]]>([
    ['a', 'front', ['b', 'c', 'a']],
    ['c', 'back', ['c', 'a', 'b']],
    ['a', 'forward', ['b', 'a', 'c']],
    ['c', 'backward', ['a', 'c', 'b']],
  ])('%s %s → %j', (id, move, expected) => {
    const next = reorder(book(trio()), id, move)
    expect(stackOf(next)).toEqual(expected)
    expect(next.spreads[0]?.templateId).toBeUndefined()
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it('renumbers z as 1..n and keeps the frame array order', () => {
    const start = book([
      makeFrame({ id: 'a', z: 10 }),
      makeFrame({ id: 'b', z: 20 }),
    ])
    const next = reorder(start, 'a', 'front')
    expect(next.spreads[0]?.frames.map((f) => [f.id, f.z])).toEqual([
      ['a', 2],
      ['b', 1],
    ])
  })

  it('ties on z fall back to array order', () => {
    const start = book([
      makeFrame({ id: 'a', z: 0 }),
      makeFrame({ id: 'b', z: 0 }),
    ])
    expect(stackOf(reorder(start, 'a', 'front'))).toEqual(['b', 'a'])
  })

  it('keeps the original order among three frames sharing a z', () => {
    const start = book([
      makeFrame({ id: 'a', z: 0 }),
      makeFrame({ id: 'b', z: 0 }),
      makeFrame({ id: 'c', z: 0 }),
    ])
    expect(stackOf(reorder(start, 'a', 'forward'))).toEqual(['b', 'a', 'c'])
    expect(stackOf(reorder(start, 'c', 'back'))).toEqual(['c', 'a', 'b'])
  })

  it.each<[string, ZMove]>([
    ['c', 'front'],
    ['c', 'forward'],
    ['a', 'back'],
    ['a', 'backward'],
    ['nope', 'front'],
  ])('%s %s at the end or unknown → unchanged', (id, move) => {
    const start = book(trio())
    expect(reorder(start, id, move)).toBe(start)
  })

  it('moves locked frames too (stacking is not geometry)', () => {
    const start = book([
      makeFrame({ id: 'a', z: 1, locked: true }),
      makeFrame({ id: 'b', z: 2 }),
    ])
    expect(stackOf(reorder(start, 'a', 'front'))).toEqual(['b', 'a'])
  })
})

function reorderSet(
  b: ReturnType<typeof book>,
  frameIds: readonly string[],
  move: ZMove,
) {
  return applyBookOp(b, {
    type: 'reorderFrames',
    spreadId: 'spread-1',
    frameIds,
    move,
  })
}

const five = () =>
  ['a', 'b', 'c', 'd', 'e'].map((id, index) => makeFrame({ id, z: index + 1 }))

describe('reorderFrames', () => {
  it.each<[string[], ZMove, string[]]>([
    [['a', 'c'], 'front', ['b', 'd', 'e', 'a', 'c']],
    [['b', 'e'], 'back', ['b', 'e', 'a', 'c', 'd']],
    // A block steps past one unselected frame and keeps its order.
    [['a', 'b'], 'forward', ['c', 'a', 'b', 'd', 'e']],
    [['d', 'e'], 'backward', ['a', 'b', 'd', 'e', 'c']],
    // Each frame steps past its own next unselected frame.
    [['a', 'c'], 'forward', ['b', 'a', 'd', 'c', 'e']],
    [['b', 'd'], 'backward', ['b', 'a', 'd', 'c', 'e']],
    // A frame already at the top does not hold back the one below it.
    [['c', 'e'], 'forward', ['a', 'b', 'd', 'c', 'e']],
    [['a', 'c'], 'backward', ['a', 'c', 'b', 'd', 'e']],
  ])('%j %s → %j', (ids, move, expected) => {
    const next = reorderSet(book(five()), ids, move)
    expect(stackOf(next)).toEqual(expected)
    expect(next.spreads[0]?.frames.map((f) => f.z)).toEqual(
      next.spreads[0]?.frames.map((f) => expected.indexOf(f.id) + 1),
    )
    expect(next.spreads[0]?.templateId).toBeUndefined()
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it.each<[string[], ZMove]>([
    [['d', 'e'], 'front'],
    [['d', 'e'], 'forward'],
    [['a', 'b'], 'back'],
    [['a', 'b'], 'backward'],
    [['nope'], 'front'],
    [[], 'back'],
  ])('%j %s at the end or unknown → unchanged', (ids, move) => {
    const start = book(five())
    expect(reorderSet(start, ids, move)).toBe(start)
  })

  it('matches reorderFrame for a single frame', () => {
    for (const move of ['front', 'forward', 'backward', 'back'] as const) {
      for (const id of ['a', 'c', 'e']) {
        expect(stackOf(reorderSet(book(five()), [id], move))).toEqual(
          stackOf(reorder(book(five()), id, move)),
        )
      }
    }
  })

  it('keeps relative order of both groups; front / back leave the set contiguous at that end', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ids),
        fc.subarray(ids),
        fc.constantFrom<ZMove>('front', 'back', 'forward', 'backward'),
        (stack, picked, move) => {
          const frames = stack.map((id, index) =>
            makeFrame({ id, z: index + 1 }),
          )
          const before = stackOf(book(frames))
          const after = stackOf(reorderSet(book(frames), picked, move))
          const inSet = (id: string) => picked.includes(id)
          expect(after.filter(inSet)).toEqual(before.filter(inSet))
          expect(after.filter((id) => !inSet(id))).toEqual(
            before.filter((id) => !inSet(id)),
          )
          const count = before.filter(inSet).length
          if (move === 'front') {
            expect(after.slice(after.length - count).every(inSet)).toBe(true)
          }
          if (move === 'back') {
            expect(after.slice(0, count).every(inSet)).toBe(true)
          }
          // Each selected frame moves at most one unselected frame along.
          for (const id of before.filter(inSet)) {
            const shift = after.indexOf(id) - before.indexOf(id)
            if (move === 'forward') expect(shift).toBeGreaterThanOrEqual(0)
            if (move === 'backward') expect(shift).toBeLessThanOrEqual(0)
          }
        },
      ),
    )
  })
})

describe('setFramesLocked', () => {
  const op = (frameIds: string[], locked: boolean) =>
    ({
      type: 'setFramesLocked',
      spreadId: 'spread-1',
      frameIds,
      locked,
    }) as const

  it('locks and unlocks every named frame in one step', () => {
    const locked = applyBookOp(book(trio()), op(['a', 'c'], true))
    expect(locked.spreads[0]?.frames.map((f) => f.locked)).toEqual([
      true,
      undefined,
      true,
    ])
    const open = applyBookOp(locked, op(['a', 'b', 'c'], false))
    expect(open.spreads[0]?.frames.some((f) => 'locked' in f)).toBe(false)
  })

  it('same state for all or unknown frames → unchanged', () => {
    const start = book(trio())
    expect(applyBookOp(start, op(['a', 'b'], false))).toBe(start)
    expect(applyBookOp(start, op(['nope'], true))).toBe(start)
  })
})

describe('layerOf', () => {
  it('reports the 1-based layer and the count by z', () => {
    const spread = makeSpread({ frames: trio() })
    expect(layerOf(spread, 'a')).toEqual({ layer: 1, count: 3 })
    expect(layerOf(spread, 'c')).toEqual({ layer: 3, count: 3 })
    expect(layerOf(spread, 'nope')).toBeNull()
  })
})

describe('setFrameLocked', () => {
  const op = (locked: boolean) =>
    ({
      type: 'setFrameLocked',
      spreadId: 'spread-1',
      frameId: 'a',
      locked,
    }) as const

  it('locks, keeps the template, and unlocking drops the key', () => {
    const locked = applyBookOp(book(trio()), op(true))
    expect(locked.spreads[0]?.frames[0]?.locked).toBe(true)
    expect(locked.spreads[0]?.templateId).toBe('one-per-page')
    const open = applyBookOp(locked, op(false))
    expect(open.spreads[0]?.frames[0]).not.toHaveProperty('locked')
  })

  it('touches only the named frame', () => {
    const next = applyBookOp(book(trio()), op(true))
    expect(next.spreads[0]?.frames.map((f) => f.locked)).toEqual([
      true,
      undefined,
      undefined,
    ])
  })

  it('same state or unknown frame → unchanged', () => {
    const start = book(trio())
    expect(applyBookOp(start, op(false))).toBe(start)
    expect(applyBookOp(start, { ...op(true), frameId: 'nope' })).toBe(start)
  })
})
