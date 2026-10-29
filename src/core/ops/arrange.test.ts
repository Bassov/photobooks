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
