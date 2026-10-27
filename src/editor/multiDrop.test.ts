import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addToGallery, applyTemplate, placeAsset, type Book } from '../core'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { setEditorStatus, getEditorStatus } from './editorStatus'
import {
  dropAssets,
  orderedGalleryIds,
  placedInChangedSpreads,
} from './multiDrop'

function seed(prepare: (book: Book) => Book = (book) => book): Book {
  resetBookStore()
  let book = addToGallery(getBookStoreSnapshot().book, [
    'a',
    'b',
    'c',
    'd',
    'e',
  ])
  book = applyTemplate(book, book.spreads[0]?.id ?? '', '4-grid')
  book = prepare(book)
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
  return book
}

function firstSpread(): { spreadId: string; frameIds: string[] } {
  const spread = getBookStoreSnapshot().book.spreads[0]
  return {
    spreadId: spread?.id ?? '',
    frameIds: (spread?.frames ?? []).map((frame) => frame.id),
  }
}

function placed(): (string | undefined)[] {
  return (getBookStoreSnapshot().book.spreads[0]?.frames ?? []).map(
    (frame) => frame.assetId,
  )
}

describe('multiDrop', () => {
  beforeEach(() => {
    setEditorStatus('')
  })

  afterEach(() => {
    resetBookStore()
    setEditorStatus('')
  })

  it('orders dragged ids by the gallery and drops unknown ones', () => {
    const book = seed()
    expect(orderedGalleryIds(book, ['c', 'zzz', 'a'])).toEqual(['a', 'c'])
    expect(orderedGalleryIds(book, [])).toEqual([])
  })

  it('fills from the target frame, in gallery order, as one undo step', () => {
    seed()
    const { spreadId, frameIds } = firstSpread()
    dropAssets({ type: 'frame', spreadId, frameId: frameIds[0] ?? '' }, [
      'b',
      'a',
      'd',
    ])
    expect(placed()).toEqual(['a', 'b', 'd', undefined])
    expect(getEditorStatus()).toBe('')
    undoBook()
    expect(placed()).toEqual([undefined, undefined, undefined, undefined])
  })

  it('announces how many photos did not fit on the spread', () => {
    seed()
    const { spreadId, frameIds } = firstSpread()
    dropAssets({ type: 'frame', spreadId, frameId: frameIds[0] ?? '' }, [
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
    expect(placed()).toEqual(['a', 'b', 'c', 'd'])
    expect(getEditorStatus()).toBe('1 photo left in the filmstrip')
  })

  it('does not count photos that were already on the spread as left over', () => {
    seed((book) => {
      const frames = book.spreads[0]?.frames ?? []
      return placeAsset(
        book,
        book.spreads[0]?.id ?? '',
        frames[3]?.id ?? '',
        'a',
      )
    })
    const { spreadId, frameIds } = firstSpread()
    dropAssets({ type: 'frame', spreadId, frameId: frameIds[0] ?? '' }, [
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
    expect(placed()).toEqual(['a', 'b', 'c', 'a'])
    expect(getEditorStatus()).toBe('2 photos left in the filmstrip')
  })

  it('a photo dropped on the frame that already holds it is not left over', () => {
    seed((book) => {
      const frames = book.spreads[0]?.frames ?? []
      return placeAsset(
        book,
        book.spreads[0]?.id ?? '',
        frames[0]?.id ?? '',
        'a',
      )
    })
    const { spreadId, frameIds } = firstSpread()
    dropAssets({ type: 'frame', spreadId, frameId: frameIds[0] ?? '' }, ['a'])
    expect(getEditorStatus()).toBe('')
  })

  it('ignores a drop of photos that are not in the gallery', () => {
    const book = seed()
    const { spreadId, frameIds } = firstSpread()
    dropAssets({ type: 'frame', spreadId, frameId: frameIds[0] ?? '' }, [
      'ghost',
    ])
    expect(getBookStoreSnapshot().book).toBe(book)
    expect(getEditorStatus()).toBe('')
  })

  it('a gap drop inserts one spread at the index with the photos in order', () => {
    seed()
    const count = getBookStoreSnapshot().book.spreads.length
    dropAssets({ type: 'gap', insertIndex: 1 }, ['b', 'a'])
    const book = getBookStoreSnapshot().book
    expect(book.spreads).toHaveLength(count + 1)
    expect(
      book.spreads[1]?.frames.map((frame) => frame.assetId).slice(0, 2),
    ).toEqual(['a', 'b'])
    expect(getEditorStatus()).toBe('')
    undoBook()
    expect(getBookStoreSnapshot().book.spreads).toHaveLength(count)
  })

  it('a gap drop announces photos that do not fit the new spread', () => {
    seed()
    const many = Array.from({ length: 60 }, (_, index) => `m${String(index)}`)
    resetBookStore({
      book: addToGallery(getBookStoreSnapshot().book, many),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    dropAssets({ type: 'gap', insertIndex: 1 }, many)
    expect(getEditorStatus()).toMatch(/^\d+ photos left in the filmstrip$/)
  })
})

describe('placedInChangedSpreads', () => {
  it('counts wanted photos only in spreads that changed identity', () => {
    const before = seed()
    const after = placeAsset(
      before,
      before.spreads[0]?.id ?? '',
      before.spreads[0]?.frames[0]?.id ?? '',
      'a',
    )
    expect(placedInChangedSpreads(before, after, new Set(['a']))).toBe(1)
    expect(placedInChangedSpreads(before, after, new Set(['b']))).toBe(0)
    expect(placedInChangedSpreads(before, before, new Set(['a']))).toBe(0)
  })
})
