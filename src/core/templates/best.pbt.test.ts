import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { getSpreadPageCount, getSpreadSizeMm } from '../geometry/spreadSize'
import type { Book } from '../schema'
import { makeBook, makeSpread } from '../testing/fixtures'
import { slotAspect, templateSlotAspects, type AspectClass } from './aspect'
import { bestTemplateId } from './best'
import { generateTemplateFrames } from './catalog'
import {
  customLayoutRects,
  type LayoutSlotPct,
  type SavedTemplate,
} from './custom'
import { isTemplateId } from './types'

const RUNS = { numRuns: 1000 }

type Score = [number, number]

const arbPhotos = fc.array(
  fc.constantFrom<AspectClass>('portrait', 'landscape', 'square'),
  { minLength: 1, maxLength: 8 },
)

/** A book and one of its spreads: single pages at the ends, spreads between. */
const arbTarget = fc
  .record({
    widthMm: fc.integer({ min: 100, max: 400 }),
    heightMm: fc.integer({ min: 100, max: 400 }),
    spreads: fc.integer({ min: 1, max: 4 }),
  })
  .chain(({ widthMm, heightMm, spreads }) =>
    fc.record({
      book: fc.constant(
        makeBook({
          settings: { trim: { widthMm, heightMm } },
          spreads: Array.from({ length: spreads }, (_, i) =>
            makeSpread({ id: `s${String(i)}` }),
          ),
        }),
      ),
      index: fc.integer({ min: 0, max: spreads - 1 }),
    }),
  )

const arbSlot = fc.record({
  x: fc.integer({ min: 0, max: 80 }),
  y: fc.integer({ min: 0, max: 80 }),
  w: fc.integer({ min: 5, max: 100 }),
  h: fc.integer({ min: 5, max: 100 }),
})

const arbSaved = fc
  .array(
    fc.record({
      pages: fc.constantFrom<1 | 2>(1, 2),
      slots: fc.array(arbSlot, { minLength: 1, maxLength: 8 }),
    }),
    { maxLength: 6 },
  )
  .map((list) =>
    list.map((entry, i): SavedTemplate => ({
      id: `user-${String(i)}`,
      name: `My layout ${String(i + 1)}`,
      ...entry,
    })),
  )

function score(
  slots: readonly AspectClass[],
  photos: readonly AspectClass[],
): Score | null {
  if (slots.length < photos.length) {
    return null
  }
  const mismatches = photos.filter((photo, i) => {
    const slot = slots[i]
    return slot !== photo && slot !== 'square' && photo !== 'square'
  }).length
  return [mismatches, slots.length - photos.length]
}

function strictlyBetter(a: Score | null, b: Score | null): boolean {
  if (a === null) {
    return false
  }
  return b === null || a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
}

function builtinSlots(book: Book, index: number, id: string): AspectClass[] {
  return isTemplateId(id) ? templateSlotAspects(id, book, index) : []
}

function savedSlots(
  book: Book,
  index: number,
  template: SavedTemplate,
): AspectClass[] {
  return customLayoutRects(book, index, template.slots).map(slotAspect)
}

function pagesOf(book: Book, index: number): 1 | 2 {
  return getSpreadPageCount(index, book.spreads.length)
}

// Thin and flat enough to stay portrait / landscape on any trim above.
const TALL: LayoutSlotPct = { x: 0, y: 0, w: 5, h: 90 }
const WIDE: LayoutSlotPct = { x: 0, y: 0, w: 90, h: 5 }

describe('bestTemplateId with saved templates (PBT)', () => {
  it('picks the first candidate with the best score, builtins first, same shape only', () => {
    fc.assert(
      fc.property(
        arbTarget,
        arbPhotos,
        arbSaved,
        ({ book, index }, photos, saved) => {
          const builtin = bestTemplateId(book, index, photos, [])
          const pages = pagesOf(book, index)
          let expected = builtin
          let best = score(builtinSlots(book, index, builtin), photos)
          for (const template of saved) {
            const next = score(savedSlots(book, index, template), photos)
            if (template.pages === pages && strictlyBetter(next, best)) {
              expected = template.id
              best = next
            }
          }
          const picked = bestTemplateId(book, index, photos, saved)
          expect(picked).toBe(expected)
          const chosen = saved.find((template) => template.id === picked)
          expect(chosen === undefined || chosen.pages === pages).toBe(true)
        },
      ),
      RUNS,
    )
  })

  it('an exact saved fit wins unless a builtin already fits exactly; the other shape never', () => {
    fc.assert(
      fc.property(arbTarget, arbPhotos, ({ book, index }, photos) => {
        const pages = pagesOf(book, index)
        const slots = photos.map((photo) =>
          photo === 'portrait' ? TALL : WIDE,
        )
        const wrong: SavedTemplate = {
          id: 'user-wrong',
          name: 'Wrong',
          pages: pages === 1 ? 2 : 1,
          slots,
        }
        const fit: SavedTemplate = { id: 'user-fit', name: 'Fit', pages, slots }
        const builtin = bestTemplateId(book, index, photos, [])
        const exact =
          score(builtinSlots(book, index, builtin), photos)?.join() === '0,0'
        expect(bestTemplateId(book, index, photos, [wrong, fit])).toBe(
          exact ? builtin : 'user-fit',
        )
        expect(bestTemplateId(book, index, photos, [wrong])).toBe(builtin)
      }),
      RUNS,
    )
  })

  it('a saved copy of the builtin pick ties, so the builtin stays', () => {
    fc.assert(
      fc.property(arbTarget, arbPhotos, ({ book, index }, photos) => {
        const builtin = bestTemplateId(book, index, photos, [])
        if (!isTemplateId(builtin)) {
          throw new Error(`builtin pick expected, got ${builtin}`)
        }
        const { widthMm, heightMm } = getSpreadSizeMm(book, index)
        const copy: SavedTemplate = {
          id: 'user-copy',
          name: 'Copy',
          pages: pagesOf(book, index),
          slots: generateTemplateFrames(builtin, book, index).map(
            ({ rect }) => ({
              x: (rect.x / widthMm) * 100,
              y: (rect.y / heightMm) * 100,
              w: (rect.width / widthMm) * 100,
              h: (rect.height / heightMm) * 100,
            }),
          ),
        }
        // Percent round trips could flip a slot sitting on a class boundary.
        fc.pre(
          savedSlots(book, index, copy).join() ===
            builtinSlots(book, index, builtin).join(),
        )
        expect(bestTemplateId(book, index, photos, [copy])).toBe(builtin)
      }),
      RUNS,
    )
  })
})
