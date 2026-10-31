import { describe, expect, it } from 'vitest'
import { parseBook } from '../parse'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { applyBookOp } from '../ops/applyBookOp'
import { applyCustomLayout } from './apply'
import {
  customLayoutRects,
  isCustomLayoutId,
  spreadLayoutSlots,
  type LayoutSlotPct,
} from './custom'

const OPENER: LayoutSlotPct[] = [
  { x: 0, y: 0, w: 62, h: 100 },
  { x: 68, y: 30, w: 28, h: 40 },
]

/** Three spreads: the middle one is a 600 × 300 mm two-page spread. */
function threeSpreads() {
  return makeBook({
    assets: { p1: {} },
    gallery: ['p1'],
    spreads: [
      makeSpread({ id: 'a' }),
      makeSpread({
        id: 'b',
        frames: [
          makeFrame({ id: 'b1', assetId: 'p1', z: 0 }),
          makeFrame({ id: 'b2', z: 1 }),
          makeFrame({ id: 'b3', z: 2 }),
        ],
      }),
      makeSpread({ id: 'c' }),
    ],
  })
}

describe('isCustomLayoutId', () => {
  it('accepts user- ids and nothing from the template catalog', () => {
    expect(isCustomLayoutId('user-abc')).toBe(true)
    expect(isCustomLayoutId('full-bleed')).toBe(false)
    expect(isCustomLayoutId('contact-3x2')).toBe(false)
    expect(isCustomLayoutId('xuser-a')).toBe(false)
  })
})

describe('customLayoutRects', () => {
  it('scales percent slots to the spread trim (one page / two pages)', () => {
    const book = threeSpreads()
    expect(customLayoutRects(book, 0, OPENER)).toEqual([
      { x: 0, y: 0, width: 186, height: 300 },
      { x: 204, y: 90, width: 84, height: 120 },
    ])
    expect(customLayoutRects(book, 1, OPENER)).toEqual([
      { x: 0, y: 0, width: 372, height: 300 },
      { x: 408, y: 90, width: 168, height: 120 },
    ])
  })
})

describe('spreadLayoutSlots', () => {
  it('turns image frames into percent of the trim and skips text', () => {
    const book = makeBook({
      spreads: [
        makeSpread({
          id: 's',
          frames: [
            makeFrame({
              id: 'i',
              rect: { x: 30, y: 60, width: 150, height: 75 },
            }),
            makeFrame({
              id: 't',
              kind: 'text',
              rect: { x: 0, y: 0, width: 10, height: 10 },
            }),
          ],
        }),
      ],
    })
    expect(spreadLayoutSlots(book, 's')).toEqual([
      { x: 10, y: 20, w: 50, h: 25 },
    ])
  })

  it('is empty for an unknown spread', () => {
    expect(spreadLayoutSlots(threeSpreads(), 'nope')).toEqual([])
  })
})

describe('applyCustomLayout', () => {
  it('lays the slots out on the spread, keeps photos in order, records the id', () => {
    const book = threeSpreads()
    const next = applyCustomLayout(book, 'b', 'user-opener', OPENER)
    const spread = next.spreads[1]
    expect(spread?.templateId).toBe('user-opener')
    expect(spread?.frames).toEqual([
      {
        id: 'b1',
        assetId: 'p1',
        rect: { x: 0, y: 0, width: 372, height: 300 },
        z: 0,
      },
      { id: 'b2', rect: { x: 408, y: 90, width: 168, height: 120 }, z: 1 },
    ])
    // Other spreads are shared, untouched.
    expect(next.spreads[0]).toBe(book.spreads[0])
    expect(next.spreads[2]).toBe(book.spreads[2])
    // The single-page first spread scales the slots to one page.
    const first = applyCustomLayout(book, 'a', 'user-opener', OPENER)
    expect(first.spreads[0]?.frames[0]?.rect.width).toBe(186)
  })

  it('names new frames after the spread when it had fewer', () => {
    const book = makeBook({ spreads: [makeSpread({ id: 's', frames: [] })] })
    const next = applyCustomLayout(book, 's', 'user-x', OPENER)
    expect(next.spreads[0]?.frames.map((f) => [f.id, f.z])).toEqual([
      ['s-f0', 0],
      ['s-f1', 1],
    ])
  })

  it('returns the same book when nothing changes or the input is unusable', () => {
    const book = threeSpreads()
    const once = applyCustomLayout(book, 'b', 'user-opener', OPENER)
    expect(applyCustomLayout(once, 'b', 'user-opener', OPENER)).toBe(once)
    expect(applyCustomLayout(book, 'missing', 'user-opener', OPENER)).toBe(book)
    expect(applyCustomLayout(book, 'b', 'user-opener', [])).toBe(book)
    expect(applyCustomLayout(book, 'b', 'full-bleed', OPENER)).toBe(book)
  })

  it('a second layout with the same frames but another id still records the id', () => {
    const once = applyCustomLayout(threeSpreads(), 'b', 'user-a', OPENER)
    const again = applyCustomLayout(once, 'b', 'user-b', OPENER)
    expect(again).not.toBe(once)
    expect(again.spreads[1]?.templateId).toBe('user-b')
  })

  it('is reachable as the applyCustomLayout book op', () => {
    const next = applyBookOp(threeSpreads(), {
      type: 'applyCustomLayout',
      spreadId: 'b',
      templateId: 'user-opener',
      slots: OPENER,
    })
    expect(next.spreads[1]?.frames).toHaveLength(2)
  })

  it('a book with a saved-layout template id still parses', () => {
    const next = applyCustomLayout(threeSpreads(), 'b', 'user-opener', OPENER)
    expect(parseBook(JSON.parse(JSON.stringify(next)))).toMatchObject({
      ok: true,
    })
  })
})
