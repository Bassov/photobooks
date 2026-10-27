import { describe, expect, it } from 'vitest'
import {
  altArrowTarget,
  contentY,
  dropLineY,
  reorderShift,
  reorderTargetIndex,
} from './spreadReorder'

const spans = [0, 1, 2, 3].map((i) => ({ top: i * 100, height: 100 }))

describe('reorderTargetIndex', () => {
  it('maps pointer position to the final index', () => {
    expect(reorderTargetIndex(spans, 2, 10)).toBe(0)
    expect(reorderTargetIndex(spans, 2, 160)).toBe(2)
    expect(reorderTargetIndex(spans, 0, 399)).toBe(3)
    expect(reorderTargetIndex(spans, 0, 40)).toBe(0)
  })

  it('crosses a neighbour only past its midpoint', () => {
    expect(reorderTargetIndex(spans, 0, 149)).toBe(0)
    expect(reorderTargetIndex(spans, 0, 150)).toBe(0)
    expect(reorderTargetIndex(spans, 0, 151)).toBe(1)
  })

  it('adds scrollTop so a scrolled list keeps the same target', () => {
    const y = contentY(60, 20, 300)
    expect(y).toBe(340)
    expect(reorderTargetIndex(spans, 0, y)).toBe(2)
    expect(reorderTargetIndex(spans, 0, contentY(60, 20, 0))).toBe(0)
  })
})

describe('reorderShift', () => {
  it('matches the item displacement of the real move for every from/to', () => {
    const ids = [0, 1, 2, 3]
    for (const from of ids) {
      for (const to of ids) {
        const order = ids.slice()
        order.splice(from, 1)
        order.splice(to, 0, from)
        for (const index of ids) {
          const expected =
            index === from ? 0 : (order.indexOf(index) - index) * 100
          expect(reorderShift(spans, from, to, index)).toBe(expected)
        }
      }
    }
  })

  it('shifts nothing when the source span is missing', () => {
    expect(reorderShift(spans, 9, 1, 0)).toBe(0)
    expect(reorderShift(spans, 9, 0, 1)).toBe(0)
  })
})

describe('dropLineY', () => {
  it('sits above the target when moving up and below it when moving down', () => {
    expect(dropLineY(spans, 3, 1)).toBe(100)
    expect(dropLineY(spans, 0, 2)).toBe(300)
    expect(dropLineY(spans, 2, 0)).toBe(0)
    expect(dropLineY(spans, 1, 0)).toBe(0)
    expect(dropLineY(spans, 0, 1)).toBe(200)
  })

  it('is null when dropping in place', () => {
    expect(dropLineY(spans, 1, 1)).toBeNull()
  })

  it('is null for a missing target', () => {
    expect(dropLineY(spans, 0, 7)).toBeNull()
  })
})

describe('altArrowTarget', () => {
  it('moves one step with Alt+Arrow inside the list', () => {
    expect(altArrowTarget('ArrowUp', true, 2, 4)).toBe(1)
    expect(altArrowTarget('ArrowDown', true, 2, 4)).toBe(3)
  })

  it('stops at both ends', () => {
    expect(altArrowTarget('ArrowUp', true, 0, 4)).toBeNull()
    expect(altArrowTarget('ArrowDown', true, 3, 4)).toBeNull()
    expect(altArrowTarget('ArrowUp', true, 1, 4)).toBe(0)
    expect(altArrowTarget('ArrowDown', true, 2, 4)).toBe(3)
  })

  it('ignores plain arrows and other keys', () => {
    expect(altArrowTarget('ArrowDown', false, 1, 4)).toBeNull()
    expect(altArrowTarget('Enter', true, 1, 4)).toBeNull()
  })
})
