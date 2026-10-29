import { fc, test as fcTest } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  CONTACT_MAX_COLS,
  CONTACT_MAX_ROWS,
  addToGallery,
  applyTemplate,
  bestTemplateId,
  contactSheetId,
  generateTemplateFrames,
  isTemplateId,
  parseContactSheetId,
  photoAspectClass,
  slotAspect,
  templateSlotAspects,
} from '../index'
import { makeBook, makeSpread } from '../testing/fixtures'
import { placeAsset } from '../ops/place'

function interiorBook() {
  return makeBook({
    spreads: [
      makeSpread({ id: 'a' }),
      makeSpread({ id: 'b' }),
      makeSpread({ id: 'c' }),
    ],
  })
}

describe('contact sheet ids', () => {
  it('parses valid ids and rejects out-of-range or malformed ones', () => {
    expect(parseContactSheetId('contact-3x4')).toEqual({ cols: 3, rows: 4 })
    expect(isTemplateId('contact-5x4')).toBe(true)
    expect(isTemplateId('contact-6x1')).toBe(false)
    expect(isTemplateId('contact-1x5')).toBe(false)
    expect(isTemplateId('contact-0x2')).toBe(false)
    expect(isTemplateId('contact-2x')).toBe(false)
    expect(isTemplateId('two-portraits')).toBe(true)
    expect(isTemplateId('landscape-two-portraits')).toBe(true)
  })
})

describe('slot aspects', () => {
  it('classifies rects and photos with a square tolerance', () => {
    expect(slotAspect({ x: 0, y: 0, width: 100, height: 100 })).toBe('square')
    expect(slotAspect({ x: 0, y: 0, width: 103, height: 100 })).toBe('square')
    expect(slotAspect({ x: 0, y: 0, width: 75, height: 100 })).toBe('portrait')
    expect(slotAspect({ x: 0, y: 0, width: 150, height: 100 })).toBe(
      'landscape',
    )
    expect(photoAspectClass(4000, 3000)).toBe('landscape')
    expect(photoAspectClass(3000, 4000)).toBe('portrait')
    expect(photoAspectClass(3000, 3100)).toBe('square')
  })

  it('portrait templates expose portrait / landscape slots', () => {
    const book = interiorBook()
    expect(templateSlotAspects('two-portraits', book, 1)).toEqual([
      'portrait',
      'portrait',
    ])
    expect(templateSlotAspects('landscape-two-portraits', book, 1)).toEqual([
      'landscape',
      'portrait',
      'portrait',
    ])
  })
})

describe('portrait template geometry', () => {
  it('two-portraits on a one-page spread: two frames side by side', () => {
    const [a, b] = generateTemplateFrames('two-portraits', makeBook(), 0)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect((a?.rect.x ?? 0) + (a?.rect.width ?? 0)).toBeLessThan(b?.rect.x ?? 0)
  })

  it('two-portraits on a two-page spread: one frame per page', () => {
    const book = interiorBook()
    const trimW = book.settings.trim.widthMm
    const [a, b] = generateTemplateFrames('two-portraits', book, 1)
    expect((a?.rect.x ?? 0) + (a?.rect.width ?? 0)).toBeLessThanOrEqual(trimW)
    expect(b?.rect.x ?? 0).toBeGreaterThanOrEqual(trimW)
  })

  it('landscape-two-portraits on a one-page spread stacks landscape over two portraits', () => {
    const frames = generateTemplateFrames(
      'landscape-two-portraits',
      makeBook(),
      0,
    )
    expect(frames).toHaveLength(3)
    const [land, p1, p2] = frames
    expect((land?.rect.y ?? 0) + (land?.rect.height ?? 0)).toBeLessThan(
      p1?.rect.y ?? 0,
    )
    expect(p1?.rect.y).toBe(p2?.rect.y)
  })
})

describe('bestTemplateId', () => {
  it('returns one-per-page for no photos', () => {
    expect(bestTemplateId(interiorBook(), 1, [])).toBe('one-per-page')
  })

  it('two portraits pick a template with two portrait slots', () => {
    const book = interiorBook()
    const id = bestTemplateId(book, 1, ['portrait', 'portrait'])
    expect(templateSlotAspects(id, book, 1)).toEqual(['portrait', 'portrait'])
  })

  it('landscape + two portraits picks the mixed template', () => {
    expect(
      bestTemplateId(interiorBook(), 1, ['landscape', 'portrait', 'portrait']),
    ).toBe('landscape-two-portraits')
  })

  it('many photos fall back to a contact sheet, capped at 5x4', () => {
    const book = interiorBook()
    const six = bestTemplateId(book, 1, Array(6).fill('landscape'))
    expect(parseContactSheetId(six)).not.toBeNull()
    expect(bestTemplateId(book, 1, Array(60).fill('landscape'))).toBe(
      'contact-5x4',
    )
  })

  it.each([
    ['one portrait', 1, ['portrait'], 'two-portraits'],
    ['one landscape', 1, ['landscape'], 'full-bleed'],
    ['two landscapes', 1, ['landscape', 'landscape'], 'one-per-page'],
    ['square wildcard', 1, ['portrait', 'square'], 'two-portraits'],
    [
      'one mismatch beats none available',
      1,
      ['landscape', 'portrait', 'landscape'],
      'landscape-two-portraits',
    ],
    ['three portraits', 1, ['portrait', 'portrait', 'portrait'], 'contact-2x1'],
  ] as const)('%s (spread %i)', (_name, spread, photos, expected) => {
    expect(bestTemplateId(interiorBook(), spread, photos)).toBe(expected)
  })

  it('single-page spread uses the page count for fit', () => {
    const one = makeBook()
    expect(bestTemplateId(one, 0, ['landscape', 'landscape'])).toBe('4-grid')
    expect(bestTemplateId(one, 0, ['portrait', 'portrait'])).toBe(
      'two-portraits',
    )
    expect(bestTemplateId(one, 0, Array(13).fill('landscape'))).toBe(
      'contact-5x3',
    )
    expect(bestTemplateId(one, 0, Array(15).fill('landscape'))).toBe(
      'contact-5x3',
    )
  })

  it('picks the smallest contact sheet that fits per page', () => {
    const book = interiorBook()
    expect(bestTemplateId(book, 1, Array(30).fill('landscape'))).toBe(
      'contact-5x3',
    )
    expect(bestTemplateId(book, 1, Array(21).fill('landscape'))).toBe(
      'contact-4x3',
    )
  })

  fcTest.prop([
    fc.array(fc.constantFrom('portrait', 'landscape', 'square'), {
      maxLength: 12,
    }),
  ])(
    'result always has a valid id and enough slots when possible',
    (photos) => {
      const book = interiorBook()
      const id = bestTemplateId(book, 1, photos)
      expect(isTemplateId(id)).toBe(true)
      const slots = templateSlotAspects(id, book, 1).length
      expect(slots).toBeGreaterThanOrEqual(Math.min(photos.length, 40))
    },
  )
})

describe('contact sheet geometry', () => {
  it('3x4 on a two-page spread gives 24 frames inside the page margin boxes', () => {
    const book = interiorBook()
    const { margins } = book.layoutGrid
    const trimW = book.settings.trim.widthMm
    const trimH = book.settings.trim.heightMm
    const frames = generateTemplateFrames('contact-3x4', book, 1)
    expect(frames).toHaveLength(24)
    for (const [index, frame] of frames.entries()) {
      const page = index < 12 ? 0 : 1
      const { x, y, width, height } = frame.rect
      expect(x).toBeGreaterThanOrEqual(page * trimW + margins.left - 1e-6)
      expect(x + width).toBeLessThanOrEqual(
        (page + 1) * trimW - margins.right + 1e-6,
      )
      expect(y).toBeGreaterThanOrEqual(margins.top - 1e-6)
      expect(y + height).toBeLessThanOrEqual(trimH - margins.bottom + 1e-6)
    }
  })

  fcTest.prop([
    fc.integer({ min: 1, max: CONTACT_MAX_COLS }),
    fc.integer({ min: 1, max: CONTACT_MAX_ROWS }),
    fc.integer({ min: 0, max: 2 }),
  ])('count is cols*rows*pages and frames do not overlap', (cols, rows, i) => {
    const book = interiorBook()
    const pages = i === 1 ? 2 : 1
    const frames = generateTemplateFrames(contactSheetId(cols, rows), book, i)
    expect(frames).toHaveLength(cols * rows * pages)
    for (const [ai, a] of frames.entries()) {
      for (const b of frames.slice(ai + 1)) {
        const apart =
          a.rect.x + a.rect.width <= b.rect.x + 1e-6 ||
          b.rect.x + b.rect.width <= a.rect.x + 1e-6 ||
          a.rect.y + a.rect.height <= b.rect.y + 1e-6 ||
          b.rect.y + b.rect.height <= a.rect.y + 1e-6
        expect(apart).toBe(true)
      }
    }
  })

  it('switching back keeps photos in order', () => {
    let book = addToGallery(makeBook(), ['p1', 'p2'])
    book = applyTemplate(book, 'spread-1', '2-up')
    const frames = book.spreads[0]?.frames ?? []
    book = placeAsset(book, 'spread-1', frames[0]?.id ?? '', 'p1')
    book = placeAsset(book, 'spread-1', frames[1]?.id ?? '', 'p2')
    book = applyTemplate(book, 'spread-1', 'contact-3x4')
    book = applyTemplate(book, 'spread-1', '2-up')
    expect(book.spreads[0]?.frames.map((f) => f.assetId)).toEqual(['p1', 'p2'])
  })
})
