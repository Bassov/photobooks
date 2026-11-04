import { afterEach, describe, expect, it } from 'vitest'
import {
  TEMPLATE_IDS,
  generateTemplateFrames,
  getSpreadSizeMm,
  type Book,
  type Spread,
} from '../core'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  LAYOUT_PICKER,
  PICKER_MERGES,
  TEMPLATE_NAMES,
  applyLayout,
  isMarginVariant,
  layoutRects,
  mergeLayouts,
  sortByPhotoCount,
  templateName,
  type LayoutItem,
} from './layoutCatalog'
import { addSavedTemplate, resetSavedTemplatesForTests } from './savedTemplates'

describe('layoutCatalog', () => {
  it('offers the kit layouts in kit order, all valid template ids', () => {
    expect(LAYOUT_PICKER.map((id) => TEMPLATE_NAMES[id])).toEqual([
      'Full bleed',
      'One per page',
      'Hero + two',
      'Hero + grid',
      'Panorama',
      'Three across',
      'Framed single',
      'Offset pair',
      'Two portraits',
      'Landscape + 2 portraits',
    ])
    for (const id of LAYOUT_PICKER) {
      expect(TEMPLATE_IDS).toContain(id)
    }
    expect(LAYOUT_PICKER).not.toContain('2-up')
    expect(LAYOUT_PICKER).not.toContain('4-grid')
  })

  it('names every fixed template, including the stored-only ones', () => {
    expect(Object.keys(TEMPLATE_NAMES).sort()).toEqual([...TEMPLATE_IDS].sort())
    expect(templateName('2-up')).toBe('2-up')
    expect(templateName('4-grid')).toBe('4-grid')
  })

  it('names fixed ids, contact sheets, and nothing else', () => {
    expect(templateName('panorama')).toBe('Panorama')
    expect(templateName('contact-5x3')).toBe('Contact sheet 5×3')
    expect(templateName(undefined)).toBeNull()
    expect(templateName('custom-x')).toBeNull()
  })
})

const rect = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
})
const TRIM = { widthMm: 100, heightMm: 100 }
const BOX = rect(10, 10, 80, 80)

/** Book with three spreads: index 0 is one page, index 1 two pages. */
function bookOf(widthMm: number, heightMm: number) {
  return makeBook({
    settings: { trim: { widthMm, heightMm } },
    spreads: ['a', 'b', 'c'].map((id) => makeSpread({ id })),
  })
}

function builtinsOn(book: Book, spreadIndex: number): LayoutItem[] {
  const spread = book.spreads[spreadIndex]
  return LAYOUT_PICKER.map((id) => ({
    id,
    name: TEMPLATE_NAMES[id],
    rects: generateTemplateFrames(id, book, spreadIndex, spread).map(
      (frame) => frame.rect,
    ),
    saved: false,
  }))
}

describe('sortByPhotoCount', () => {
  it('orders by slot count and keeps the catalog order inside a count', () => {
    const items = [
      { id: 'three', rects: [BOX, BOX, BOX] },
      { id: 'one-a', rects: [BOX] },
      { id: 'two', rects: [BOX, BOX] },
      { id: 'one-b', rects: [BOX] },
    ]
    expect(sortByPhotoCount(items).map((item) => item.id)).toEqual([
      'one-a',
      'one-b',
      'two',
      'three',
    ])
    expect(items[0]?.id).toBe('three')
  })
})

describe('isMarginVariant', () => {
  it('accepts a centred inset keeping at least 70 % of the area', () => {
    expect(isMarginVariant([rect(10, 14, 80, 72)], [BOX], TRIM)).toBe(true)
    // 80 × 56 is exactly 70 % of 80 × 80.
    expect(isMarginVariant([rect(10, 22, 80, 56)], [BOX], TRIM)).toBe(true)
    expect(isMarginVariant([rect(10, 22.5, 80, 55)], [BOX], TRIM)).toBe(false)
  })

  it('allows half a millimetre of centre drift on each axis', () => {
    expect(isMarginVariant([rect(11, 11, 79, 79)], [BOX], TRIM)).toBe(true)
    expect(isMarginVariant([rect(11.2, 10, 78.8, 80)], [BOX], TRIM)).toBe(false)
    expect(isMarginVariant([rect(10, 11.2, 80, 78.8)], [BOX], TRIM)).toBe(false)
  })

  it('rejects frames past the match, past the trim, or in another count', () => {
    expect(isMarginVariant([rect(9.6, 10, 80.8, 80)], [BOX], TRIM)).toBe(false)
    expect(isMarginVariant([rect(10, 9.6, 80, 80.8)], [BOX], TRIM)).toBe(false)
    expect(isMarginVariant([rect(10, 10, 80.4, 80)], [BOX], TRIM)).toBe(false)
    expect(isMarginVariant([rect(10, 10, 80, 80.4)], [BOX], TRIM)).toBe(false)
    const inset = rect(5, 5, 90, 90)
    expect(isMarginVariant([inset], [rect(0, 0, 100, 100)], TRIM)).toBe(true)
    // Full bleed: the outer frame runs past the trim.
    const bleed = rect(-3, -3, 106, 106)
    expect(isMarginVariant([rect(0, 0, 100, 100)], [bleed], TRIM)).toBe(false)
    expect(isMarginVariant([inset], [rect(-0.4, 0, 100, 100)], TRIM)).toBe(
      false,
    )
    expect(isMarginVariant([inset], [rect(0, -0.4, 100, 100)], TRIM)).toBe(
      false,
    )
    expect(isMarginVariant([inset], [rect(0.4, 0, 100, 100)], TRIM)).toBe(false)
    expect(isMarginVariant([inset], [rect(0, 0.4, 100, 100)], TRIM)).toBe(false)
    expect(isMarginVariant([BOX, BOX], [BOX], TRIM)).toBe(false)
    expect(isMarginVariant([BOX], [BOX, BOX], TRIM)).toBe(false)
    expect(isMarginVariant([], [], TRIM)).toBe(false)
    expect(isMarginVariant([BOX, BOX], [BOX, BOX], TRIM)).toBe(true)
  })

  it('merges only Two portraits into One per page, on two-page spreads of upright and square books', () => {
    const formats: [string, number, number][] = [
      ['A5', 148, 210],
      ['Letter', 216, 279],
      ['Square 30', 300, 300],
      ['A4 landscape', 297, 210],
    ]
    const found: string[] = []
    for (const [format, widthMm, heightMm] of formats) {
      const book = bookOf(widthMm, heightMm)
      for (const spreadIndex of [0, 1]) {
        const size = getSpreadSizeMm(book, spreadIndex)
        const items = builtinsOn(book, spreadIndex)
        for (const a of items) {
          for (const b of items) {
            if (a !== b && isMarginVariant(a.rects, b.rects, size)) {
              found.push(`${format}/${String(spreadIndex)}: ${a.id} ~ ${b.id}`)
            }
          }
        }
      }
    }
    expect(found).toEqual([
      'A5/1: two-portraits ~ one-per-page',
      'Letter/1: two-portraits ~ one-per-page',
      'Square 30/1: two-portraits ~ one-per-page',
    ])
  })
})

describe('mergeLayouts', () => {
  it('drops Two portraits on a two-page spread and aliases it to One per page', () => {
    const book = bookOf(148, 210)
    const { items, aliases } = mergeLayouts(
      builtinsOn(book, 1),
      getSpreadSizeMm(book, 1),
    )
    expect(items.map((item) => item.id)).not.toContain('two-portraits')
    expect(items).toHaveLength(LAYOUT_PICKER.length - 1)
    expect([...aliases]).toEqual([['two-portraits', 'one-per-page']])
  })

  it('keeps Two portraits on a one-page spread, where it holds two photos', () => {
    const book = bookOf(148, 210)
    const { items, aliases } = mergeLayouts(
      builtinsOn(book, 0),
      getSpreadSizeMm(book, 0),
    )
    expect(items).toHaveLength(LAYOUT_PICKER.length)
    expect(aliases.size).toBe(0)
  })

  it('keeps a merge pair whose kept tile is missing', () => {
    const book = bookOf(148, 210)
    const list = builtinsOn(book, 1).filter(
      (item) => item.id !== 'one-per-page',
    )
    const { items, aliases } = mergeLayouts(list, getSpreadSizeMm(book, 1))
    expect(items).toEqual(list)
    expect(aliases.size).toBe(0)
    expect(PICKER_MERGES).toEqual([['two-portraits', 'one-per-page']])
  })
})

const SLOT = [{ x: 0, y: 0, w: 62, h: 100 }]

/** Page 1, spread 2–3, last page (300 × 300 mm pages). */
const threeSpreads = () =>
  makeBook({
    spreads: [
      makeSpread({ id: 's0' }),
      makeSpread({ id: 's1' }),
      makeSpread({ id: 's2' }),
    ],
  })

describe('layoutRects', () => {
  afterEach(() => {
    resetSavedTemplatesForTests()
  })

  it('lays out a catalog id, a saved layout and nothing for an unknown id', () => {
    const spread = makeSpread({ id: 's1' })
    const book = makeBook({ spreads: [spread] })
    expect(layoutRects('full-bleed', book, 0, spread)?.length).toBe(1)
    const saved = addSavedTemplate('Mine', SLOT, 1)
    expect(layoutRects(saved.id, book, 0, spread)).toEqual([
      { x: 0, y: 0, width: 186, height: 300 },
    ])
    expect(layoutRects('user-missing', book, 0, spread)).toBeNull()
  })

  it('lays a saved layout out only on spreads of its page count', () => {
    const book = threeSpreads()
    const [first, middle, last] = book.spreads as [Spread, Spread, Spread]
    const spreadLayout = addSavedTemplate('Spread', SLOT, 2)
    const pageLayout = addSavedTemplate('Page', SLOT, 1)
    expect(layoutRects(spreadLayout.id, book, 1, middle)).toEqual([
      { x: 0, y: 0, width: 372, height: 300 },
    ])
    expect(layoutRects(spreadLayout.id, book, 0, first)).toBeNull()
    expect(layoutRects(spreadLayout.id, book, 2, last)).toBeNull()
    expect(layoutRects(pageLayout.id, book, 2, last)).toEqual([
      { x: 0, y: 0, width: 186, height: 300 },
    ])
    expect(layoutRects(pageLayout.id, book, 1, middle)).toBeNull()
  })
})

describe('templateName', () => {
  afterEach(() => {
    resetSavedTemplatesForTests()
  })

  it('names a saved layout; with a page count only one saved on it', () => {
    const saved = addSavedTemplate('Trip opener', SLOT, 2)
    expect(templateName(saved.id)).toBe('Trip opener')
    expect(templateName(saved.id, 2)).toBe('Trip opener')
    expect(templateName(saved.id, 1)).toBeNull()
    expect(templateName('full-bleed', 1)).toBe('Full bleed')
  })
})

describe('applyLayout', () => {
  afterEach(() => {
    resetBookStore()
    resetSavedTemplatesForTests()
  })

  function seedBook(book = makeBook({ spreads: [makeSpread({ id: 's1' })] })) {
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  }

  it('applies a saved layout and ignores a deleted one', () => {
    seedBook()
    const before = getBookStoreSnapshot().book
    applyLayout('s1', 'user-missing')
    expect(getBookStoreSnapshot().book).toBe(before)
    const saved = addSavedTemplate('Mine', SLOT, 1)
    applyLayout('s1', saved.id)
    expect(getBookStoreSnapshot().book.spreads[0]?.templateId).toBe(saved.id)
  })

  it('leaves a spread of another page count unchanged (no squash)', () => {
    seedBook(threeSpreads())
    const before = getBookStoreSnapshot().book
    const spreadLayout = addSavedTemplate('Spread', SLOT, 2)
    applyLayout('s0', spreadLayout.id)
    applyLayout('s2', spreadLayout.id)
    expect(getBookStoreSnapshot().book).toBe(before)
    applyLayout('s1', spreadLayout.id)
    expect(getBookStoreSnapshot().book.spreads[1]?.templateId).toBe(
      spreadLayout.id,
    )
  })
})
