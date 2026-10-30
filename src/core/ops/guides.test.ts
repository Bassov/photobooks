import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { applyBookOp, checkBookInvariants } from '../index'
import { makeBook, makeSpread } from '../testing/fixtures'

function book(
  guides: { id: string; offsetMm: number; locked?: boolean }[] = [],
) {
  return makeBook({
    spreads: [
      makeSpread({
        id: 'spread-1',
        guides: guides.map((g) => ({ ...g, orientation: 'vertical' as const })),
      }),
      makeSpread({ id: 'spread-2' }),
    ],
  })
}

const guidesOf = (b: ReturnType<typeof book>, i = 0) =>
  b.spreads[i]?.guides ?? []

describe('addGuide', () => {
  it('appends a guide with a minted id and a 0.1 mm offset', () => {
    const next = applyBookOp(book(), {
      type: 'addGuide',
      spreadId: 'spread-1',
      orientation: 'horizontal',
      offsetMm: 12.345,
    })
    expect(guidesOf(next)).toEqual([
      { id: 'guide-1', orientation: 'horizontal', offsetMm: 12.3 },
    ])
    expect(guidesOf(next, 1)).toEqual([])
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it('skips taken ids when minting', () => {
    const next = applyBookOp(book([{ id: 'guide-2', offsetMm: 1 }]), {
      type: 'addGuide',
      spreadId: 'spread-1',
      orientation: 'vertical',
      offsetMm: 5,
    })
    expect(guidesOf(next).map((g) => g.id)).toEqual(['guide-2', 'guide-3'])
  })

  it('keeps the book for a taken explicit id, a non-finite offset or an unknown spread', () => {
    const before = book([{ id: 'g', offsetMm: 1 }])
    const add = (spreadId: string, offsetMm: number, id?: string) =>
      applyBookOp(before, {
        type: 'addGuide',
        spreadId,
        orientation: 'vertical',
        offsetMm,
        ...(id === undefined ? {} : { id }),
      })
    expect(add('spread-1', 5, 'g')).toBe(before)
    expect(add('spread-1', Number.NaN)).toBe(before)
    expect(add('nope', 5)).toBe(before)
  })
})

describe('moveGuide', () => {
  const move = (b: ReturnType<typeof book>, offsetMm: number, id = 'g') =>
    applyBookOp(b, {
      type: 'moveGuide',
      spreadId: 'spread-1',
      guideId: id,
      offsetMm,
    })

  it('moves one guide and rounds to 0.1 mm', () => {
    const next = move(
      book([
        { id: 'g', offsetMm: 1 },
        { id: 'h', offsetMm: 2 },
      ]),
      40.06,
    )
    expect(guidesOf(next)).toEqual([
      { id: 'g', orientation: 'vertical', offsetMm: 40.1 },
      { id: 'h', orientation: 'vertical', offsetMm: 2 },
    ])
  })

  it('keeps the book when nothing changes, the guide is locked or unknown', () => {
    const plain = book([{ id: 'g', offsetMm: 1 }])
    expect(move(plain, 1)).toBe(plain)
    expect(move(plain, 5, 'missing')).toBe(plain)
    expect(move(plain, Number.POSITIVE_INFINITY)).toBe(plain)
    const locked = book([{ id: 'g', offsetMm: 1, locked: true }])
    expect(move(locked, 5)).toBe(locked)
  })
})

describe('removeGuide', () => {
  const remove = (b: ReturnType<typeof book>, id = 'g') =>
    applyBookOp(b, { type: 'removeGuide', spreadId: 'spread-1', guideId: id })

  it('deletes just that guide', () => {
    const next = remove(
      book([
        { id: 'g', offsetMm: 1 },
        { id: 'h', offsetMm: 2 },
      ]),
    )
    expect(guidesOf(next).map((g) => g.id)).toEqual(['h'])
  })

  it('keeps the book for unknown or locked guides', () => {
    const plain = book([{ id: 'g', offsetMm: 1 }])
    expect(remove(plain, 'missing')).toBe(plain)
    const locked = book([{ id: 'g', offsetMm: 1, locked: true }])
    expect(remove(locked)).toBe(locked)
  })
})

describe('guide ops (property)', () => {
  test.prop([fc.double({ min: -500, max: 500, noNaN: true })])(
    'add then remove restores the guide list',
    (offsetMm) => {
      const start = book([{ id: 'g', offsetMm: 3 }])
      const added = applyBookOp(start, {
        type: 'addGuide',
        spreadId: 'spread-1',
        orientation: 'horizontal',
        offsetMm,
        id: 'new',
      })
      const back = applyBookOp(added, {
        type: 'removeGuide',
        spreadId: 'spread-1',
        guideId: 'new',
      })
      expect(guidesOf(back)).toEqual(guidesOf(start))
    },
  )

  test.prop([fc.double({ min: -500, max: 500, noNaN: true })])(
    'move lands within 0.05 mm of the target and never changes the guide count',
    (offsetMm) => {
      const start = book([{ id: 'g', offsetMm: 3 }])
      const next = applyBookOp(start, {
        type: 'moveGuide',
        spreadId: 'spread-1',
        guideId: 'g',
        offsetMm,
      })
      expect(guidesOf(next)).toHaveLength(1)
      expect(
        Math.abs((guidesOf(next)[0]?.offsetMm ?? 0) - offsetMm),
      ).toBeLessThanOrEqual(0.0500001)
    },
  )
})
