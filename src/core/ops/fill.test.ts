import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  addToGallery,
  applyBookOp,
  applyTemplate,
  checkBookInvariants,
  fillSpread,
  insertSpreadWithAssets,
  placeAsset,
  type Book,
} from '../index'
import { makeBook } from '../testing/fixtures'

function gridBook(assetIds: readonly string[]): Book {
  return applyTemplate(addToGallery(makeBook(), assetIds), 'spread-1', '4-grid')
}

function placed(book: Book, spreadIndex = 0): (string | undefined)[] {
  return (book.spreads[spreadIndex]?.frames ?? []).map((frame) => frame.assetId)
}

describe('fillSpread', () => {
  it('fills empty frames in the given order', () => {
    const book = gridBook(['a', 'b', 'c', 'd'])
    const frameId = book.spreads[0]?.frames[0]?.id ?? ''
    const next = fillSpread(book, 'spread-1', frameId, ['a', 'b', 'c', 'd'])
    expect(placed(next)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignores photos beyond free frames', () => {
    const book = gridBook(['a', 'b', 'c', 'd', 'e'])
    const frameId = book.spreads[0]?.frames[0]?.id ?? ''
    const next = fillSpread(book, 'spread-1', frameId, [
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
    expect(placed(next)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('replaces a filled target and fills the rest', () => {
    let book = gridBook(['a', 'b', 'c', 'd', 'e'])
    const frames = book.spreads[0]?.frames ?? []
    book = placeAsset(book, 'spread-1', frames[1]?.id ?? '', 'e')
    const next = fillSpread(book, 'spread-1', frames[1]?.id ?? '', [
      'a',
      'b',
      'c',
    ])
    expect(placed(next)).toEqual(['b', 'a', 'c', undefined])
  })

  it('skips unknown and duplicate ids', () => {
    const book = gridBook(['a', 'b'])
    const frameId = book.spreads[0]?.frames[0]?.id ?? ''
    const next = fillSpread(book, 'spread-1', frameId, ['x', 'a', 'a', 'b'])
    expect(placed(next)).toEqual(['a', 'b', undefined, undefined])
  })

  it('returns the same book for unknown target or no usable photos', () => {
    const book = gridBook(['a'])
    expect(fillSpread(book, 'nope', 'x', ['a'])).toBe(book)
    expect(fillSpread(book, 'spread-1', 'nope', ['a'])).toBe(book)
    expect(fillSpread(book, 'spread-1', 'frame-1', ['zzz'])).toBe(book)
  })

  test.prop([fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'q'))])(
    'never changes the frame count and keeps invariants',
    (ids) => {
      const book = gridBook(['a', 'b', 'c', 'd', 'e'])
      const frameId = book.spreads[0]?.frames[0]?.id ?? ''
      const next = fillSpread(book, 'spread-1', frameId, ids)
      expect(next.spreads[0]?.frames.length).toBe(4)
      expect(checkBookInvariants(next)).toEqual({ ok: true })
    },
  )
})

const DEFAULT_CROP = { zoom: 1, center: { x: 0.5, y: 0.5 } }

describe('fillSpread details', () => {
  it('gives placed frames the default crop', () => {
    const book = gridBook(['a'])
    const frameId = book.spreads[0]?.frames[0]?.id ?? ''
    const next = fillSpread(book, 'spread-1', frameId, ['a'])
    expect(next.spreads[0]?.frames[0]?.crop).toEqual(DEFAULT_CROP)
  })

  it('keeps filled frames that are not the target', () => {
    let book = gridBook(['a', 'b', 'c'])
    const frames = book.spreads[0]?.frames ?? []
    book = placeAsset(book, 'spread-1', frames[2]?.id ?? '', 'c')
    const next = fillSpread(book, 'spread-1', frames[0]?.id ?? '', ['a', 'b'])
    expect(placed(next)).toEqual(['a', 'b', 'c', undefined])
  })

  it('keeps a frame (and its crop) when the target already holds the photo', () => {
    let book = gridBook(['a'])
    const frame = book.spreads[0]?.frames[0]
    book = placeAsset(book, 'spread-1', frame?.id ?? '', 'a')
    const next = fillSpread(book, 'spread-1', frame?.id ?? '', ['a'])
    expect(next.spreads[0]?.frames[0]).toBe(book.spreads[0]?.frames[0])
  })

  it('only touches the named spread', () => {
    const base = gridBook(['a', 'b'])
    const two = applyBookOp(base, { type: 'addSpread', templateId: '4-grid' })
    const frameId = two.spreads[1]?.frames[0]?.id ?? ''
    const next = fillSpread(two, two.spreads[1]?.id ?? '', frameId, ['a', 'b'])
    expect(placed(next, 0)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(placed(next, 1).slice(0, 2)).toEqual(['a', 'b'])
  })
})

describe('insertSpreadWithAssets', () => {
  const portrait = { widthPx: 2000, heightPx: 3000 }

  it('reads stored dims as already oriented (no second EXIF swap)', () => {
    let book = addToGallery(makeBook(), ['l1', 'l2'])
    book = {
      ...book,
      assets: {
        l1: { widthPx: 3000, heightPx: 2000, orientation: 6 },
        l2: { widthPx: 3000, heightPx: 2000, orientation: 8 },
      },
    }
    expect(
      insertSpreadWithAssets(book, 1, ['l1', 'l2']).spreads[1]?.templateId,
    ).not.toBe('two-portraits')
  })

  it('uses photo size (missing size) to pick the template', () => {
    let book = addToGallery(makeBook(), ['p1', 'p2', 'w', 'h'])
    book = {
      ...book,
      assets: {
        p1: { widthPx: 2000, heightPx: 3000, orientation: 6 },
        p2: { widthPx: 2000, heightPx: 3000, orientation: 6 },
        w: { widthPx: 3000 },
        h: { heightPx: 3000 },
      },
    }
    expect(
      insertSpreadWithAssets(book, 1, ['p1', 'p2']).spreads[1]?.templateId,
    ).toBe('two-portraits')
    // Missing width or height counts as square, which matches every slot.
    const unknown = insertSpreadWithAssets(book, 1, ['w', 'h'])
    expect(unknown.spreads[1]?.templateId).toBe('two-portraits')
    expect(placed(unknown, 1)).toEqual(['w', 'h'])
  })

  it('clamps the insert index into the book', () => {
    const book = addToGallery(makeBook(), ['a'])
    const low = insertSpreadWithAssets(book, -3, ['a'])
    expect(low.spreads).toHaveLength(2)
    expect(placed(low, 0)).toContain('a')
    expect(placed(low, 1)).toEqual([undefined])
    const high = insertSpreadWithAssets(book, 99, ['a'])
    expect(placed(high, 1)).toContain('a')
  })

  it('gives placed frames the default crop', () => {
    const book = addToGallery(makeBook(), ['a'])
    const next = insertSpreadWithAssets(book, 1, ['a'])
    expect(next.spreads[1]?.frames[0]?.crop).toEqual(DEFAULT_CROP)
  })

  it('inserts a spread at the index with the best template and photos in order', () => {
    let book = addToGallery(makeBook(), ['p1', 'p2'])
    book = {
      ...book,
      assets: { p1: portrait, p2: portrait },
    }
    const next = insertSpreadWithAssets(book, 1, ['p1', 'p2'])
    expect(next.spreads).toHaveLength(2)
    expect(next.spreads[1]?.templateId).toBe('two-portraits')
    expect(placed(next, 1)).toEqual(['p1', 'p2'])
  })

  it('leaves overflow photos unplaced', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `p${String(i)}`)
    const book = addToGallery(makeBook(), ids)
    const next = insertSpreadWithAssets(book, 0, ids)
    const filled = placed(next, 0).filter((id) => id !== undefined)
    expect(filled.length).toBeLessThan(ids.length)
    expect(filled).toEqual(ids.slice(0, filled.length))
  })

  it('returns the same book when no photo is usable', () => {
    const book = makeBook()
    expect(insertSpreadWithAssets(book, 0, ['nope'])).toBe(book)
  })

  it('is reachable through applyBookOp', () => {
    const book = addToGallery(makeBook(), ['a'])
    const next = applyBookOp(book, {
      type: 'insertSpreadWithAssets',
      index: 5,
      assetIds: ['a'],
    })
    expect(next.spreads).toHaveLength(2)
    expect(placed(next, 1)).toContain('a')
    const frameId = next.spreads[1]?.frames[0]?.id ?? ''
    const filled = applyBookOp(book, {
      type: 'fillSpread',
      spreadId: 'spread-1',
      frameId: book.spreads[0]?.frames[0]?.id ?? frameId,
      assetIds: ['a'],
    })
    expect(placed(filled)).toEqual(['a'])
  })
})
