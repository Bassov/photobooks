import { afterEach, describe, expect, it } from 'vitest'
import { makeBookWithAsset } from '../core/testing/fixtures'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  redoBook,
  resetBookStore,
  undoBook,
} from './bookStore'

describe('bookStore history', () => {
  afterEach(() => {
    resetBookStore()
  })

  it('undoes and redoes layout edits, coalescing title typing', () => {
    resetBookStore()
    const start = getBookStoreSnapshot().book
    dispatchBookOp({ type: 'addSpread', id: 'extra' })
    dispatchBookOp({ type: 'setTitle', title: 'A' })
    dispatchBookOp({ type: 'setTitle', title: 'AB' })
    expect(getHistorySnapshot()).toEqual({ canUndo: true, canRedo: false })

    undoBook()
    expect(getBookStoreSnapshot().book.title).toBeUndefined()
    expect(getBookStoreSnapshot().book.spreads).toHaveLength(4)
    undoBook()
    expect(getBookStoreSnapshot().book.spreads).toBe(start.spreads)
    expect(getHistorySnapshot()).toEqual({ canUndo: false, canRedo: true })
    undoBook()

    redoBook()
    redoBook()
    expect(getBookStoreSnapshot().book.title).toBe('AB')
    redoBook()
    expect(getBookStoreSnapshot().book.title).toBe('AB')
  })

  it('keeps gallery on undo and does not record gallery adds', () => {
    resetBookStore()
    dispatchBookOp({ type: 'addSpread', id: 'extra' })
    dispatchBookOp({ type: 'addToGallery', assetIds: ['a1'] })
    undoBook()
    expect(getBookStoreSnapshot().book.gallery).toEqual(['a1'])
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('treats a placement as one undoable step', () => {
    resetBookStore({
      book: makeBookWithAsset('a1', { place: false }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id ?? ''
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id ?? ''
    dispatchBookOp({ type: 'place', spreadId, frameId, assetId: 'a1' })
    expect(getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId).toBe(
      'a1',
    )
    undoBook()
    expect(
      getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId,
    ).toBeUndefined()
    redoBook()
    expect(getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId).toBe(
      'a1',
    )
  })

  it('clears history when gallery removal unplaces frames', () => {
    resetBookStore({
      book: makeBookWithAsset('a1', { place: false }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const spread = getBookStoreSnapshot().book.spreads[0]
    dispatchBookOp({
      type: 'place',
      spreadId: spread?.id ?? '',
      frameId: spread?.frames[0]?.id ?? '',
      assetId: 'a1',
    })
    expect(getHistorySnapshot().canUndo).toBe(true)
    dispatchBookOp({ type: 'removeManyFromGallery', assetIds: ['a1'] })
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('reset clears history', () => {
    dispatchBookOp({ type: 'addSpread', id: 'x' })
    resetBookStore()
    expect(getHistorySnapshot()).toEqual({ canUndo: false, canRedo: false })
  })
})
