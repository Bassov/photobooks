import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { getSpreadPageCount, getSpreadSizeMm } from '../geometry/spreadSize'
import type { Book, Frame } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { applyCustomLayout } from './apply'
import { spreadLayoutSlots } from './custom'

const RUNS = { numRuns: 1000 }

const unit = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true })

/** A frame as fractions of its spread: origin, then size inside the rest. */
const frameShape = fc.record({
  fx: unit(0, 0.9),
  fy: unit(0, 0.9),
  fw: unit(0.05, 1),
  fh: unit(0.05, 1),
})

const arbBook = fc
  .record({
    widthMm: fc.integer({ min: 100, max: 400 }),
    heightMm: fc.integer({ min: 100, max: 400 }),
    spreads: fc.integer({ min: 3, max: 8 }),
    first: fc.array(frameShape, { minLength: 1, maxLength: 4 }),
    middle: fc.array(frameShape, { minLength: 1, maxLength: 4 }),
  })
  .map(({ widthMm, heightMm, spreads, first, middle }) => {
    const ids = Array.from({ length: spreads }, (_, i) => `s${String(i)}`)
    const book = makeBook({
      settings: { trim: { widthMm, heightMm } },
      spreads: ids.map((id, index) => {
        const shapes = index === 0 ? first : index === 1 ? middle : []
        const pages = getSpreadPageCount(index, spreads)
        const size = { widthMm: widthMm * pages, heightMm }
        return makeSpread({ id, frames: shapes.map(toFrame(id, size)) })
      }),
    })
    return { book }
  })

function toFrame(
  spreadId: string,
  size: { widthMm: number; heightMm: number },
) {
  return (
    shape: { fx: number; fy: number; fw: number; fh: number },
    z: number,
  ): Frame =>
    makeFrame({
      id: `${spreadId}-f${String(z)}`,
      z,
      rect: {
        x: shape.fx * size.widthMm,
        y: shape.fy * size.heightMm,
        width: shape.fw * (1 - shape.fx) * size.widthMm,
        height: shape.fh * (1 - shape.fy) * size.heightMm,
      },
    })
}

const aspect = (frame: Frame) => frame.rect.width / frame.rect.height

function framesOf(book: Book, index: number): Frame[] {
  return book.spreads[index]?.frames ?? []
}

describe('saved layouts keep their shape (PBT)', () => {
  it('save → apply on a two-page spread gives the source rects within 0.01 mm', () => {
    fc.assert(
      fc.property(arbBook, fc.nat(), ({ book }, pick) => {
        const last = book.spreads.length - 1
        // Any two-page spread of the book, the source included.
        const target = 1 + (pick % (last - 1))
        const slots = spreadLayoutSlots(book, 's1')
        const id = `s${String(target)}`
        const next = applyCustomLayout(book, id, 'user-pbt', slots, 2)
        const source = framesOf(book, 1)
        const placed = framesOf(next, target)
        expect(placed).toHaveLength(source.length)
        placed.forEach((frame, index) => {
          const want = source[index]?.rect
          expect(Math.abs(frame.rect.x - (want?.x ?? NaN))).toBeLessThan(0.01)
          expect(Math.abs(frame.rect.y - (want?.y ?? NaN))).toBeLessThan(0.01)
          expect(
            Math.abs(frame.rect.width - (want?.width ?? NaN)),
          ).toBeLessThan(0.01)
          expect(
            Math.abs(frame.rect.height - (want?.height ?? NaN)),
          ).toBeLessThan(0.01)
        })
      }),
      RUNS,
    )
  })

  it('saved on page 1, applied on the last page: every slot aspect is kept (trim-normalized)', () => {
    fc.assert(
      fc.property(arbBook, ({ book }) => {
        const last = book.spreads.length - 1
        const slots = spreadLayoutSlots(book, 's0')
        const lastId = `s${String(last)}`
        const next = applyCustomLayout(book, lastId, 'user-pbt', slots, 1)
        const source = framesOf(book, 0)
        const placed = framesOf(next, last)
        expect(placed).toHaveLength(source.length)
        // The last page has page 1's trim: one page wide.
        expect(getSpreadSizeMm(next, last)).toEqual(getSpreadSizeMm(book, 0))
        placed.forEach((frame, index) => {
          const want = source[index]
          expect(want).toBeDefined()
          if (want !== undefined) {
            expect(Math.abs(aspect(frame) - aspect(want))).toBeLessThan(0.001)
          }
        })
      }),
      RUNS,
    )
  })

  it('a layout of the other page count changes nothing', () => {
    fc.assert(
      fc.property(arbBook, fc.nat(), ({ book }, pick) => {
        const last = book.spreads.length - 1
        const spreadSlots = spreadLayoutSlots(book, 's1')
        const pageSlots = spreadLayoutSlots(book, 's0')
        const single = pick % 2 === 0 ? 0 : last
        const double = 1 + (pick % (last - 1))
        const singleId = `s${String(single)}`
        const doubleId = `s${String(double)}`
        expect(
          applyCustomLayout(book, singleId, 'user-pbt', spreadSlots, 2),
        ).toBe(book)
        expect(
          applyCustomLayout(book, doubleId, 'user-pbt', pageSlots, 1),
        ).toBe(book)
      }),
      RUNS,
    )
  })
})
