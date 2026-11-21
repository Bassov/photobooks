import { describe, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  addToGallery,
  applyTemplate,
  checkBookInvariants,
  fillBook,
  pagesOf,
  placeAsset,
  planFillBook,
  unplacedAssetIds,
  type Book,
} from '../index'
import type { TemplateId } from '../templates/types'
import { makeBook, makeSpread } from '../testing/fixtures'

const TEMPLATES: TemplateId[] = [
  'one-per-page',
  '2-up',
  '4-grid',
  'two-portraits',
  'full-bleed',
]
const GALLERY = Array.from({ length: 16 }, (_, i) => `g${String(i)}`)

interface Seed {
  templates: TemplateId[]
  preplaced: number[]
  order: string[]
  maxPages: number
}

const seedArb: fc.Arbitrary<Seed> = fc.record({
  templates: fc.array(fc.constantFrom(...TEMPLATES), {
    minLength: 1,
    maxLength: 6,
  }),
  /** Frame indexes (book-wide) that already hold a photo. */
  preplaced: fc.uniqueArray(fc.nat({ max: 20 }), { maxLength: 6 }),
  /** Caller order: gallery ids, duplicates and unknown ids allowed. */
  order: fc.array(fc.constantFrom(...GALLERY, 'unknown'), { maxLength: 24 }),
  maxPages: fc.integer({ min: 0, max: 24 }),
})

function seedBook({ templates, preplaced }: Seed): Book {
  const ids = templates.map((_, i) => `s${String(i)}`)
  let book = addToGallery(
    makeBook({ spreads: ids.map((id) => makeSpread({ id, frames: [] })) }),
    GALLERY,
  )
  templates.forEach((template, i) => {
    book = applyTemplate(book, ids[i] ?? '', template)
  })
  const frames = book.spreads.flatMap((spread) =>
    spread.frames.map((frame) => ({ spreadId: spread.id, frameId: frame.id })),
  )
  preplaced.forEach((index, n) => {
    const frame = frames[index]
    if (frame !== undefined) {
      book = placeAsset(
        book,
        frame.spreadId,
        frame.frameId,
        GALLERY[GALLERY.length - 1 - n] ?? '',
      )
    }
  })
  return book
}

describe('fillBook (PBT)', () => {
  test.prop([seedArb])(
    'does what planFillBook says and only places unplaced photos',
    (seed) => {
      const book = seedBook(seed)
      const plan = planFillBook(book, seed.order, seed.maxPages)
      const next = fillBook(book, seed.order, [], seed.maxPages)

      const before = new Set(unplacedAssetIds(book))
      const after = new Set(unplacedAssetIds(next))
      const newlyPlaced = [...before].filter((id) => !after.has(id))
      const offered = new Set(seed.order.filter((id) => before.has(id)))

      expect(newlyPlaced).toHaveLength(plan.intoFrames + plan.onNewSpreads)
      expect(plan.intoFrames + plan.onNewSpreads + plan.leftover).toBe(
        offered.size,
      )
      for (const id of newlyPlaced) {
        expect(offered.has(id)).toBe(true)
      }
      // Leftover = the tail of the caller order.
      const left = [...offered].filter((id) => after.has(id))
      expect(left).toEqual([...offered].slice(offered.size - plan.leftover))
      expect([...after].every((id) => before.has(id))).toBe(true)
      expect(next.spreads).toHaveLength(book.spreads.length + plan.newSpreads)
      expect(plan.pagesBefore).toBe(pagesOf(book.spreads.length))
      expect(plan.pagesAfter).toBe(pagesOf(next.spreads.length))
      expect(plan.pagesAfter).toBeLessThanOrEqual(
        Math.max(seed.maxPages, plan.pagesBefore),
      )
      expect(checkBookInvariants(next)).toEqual({ ok: true })
    },
  )
})
