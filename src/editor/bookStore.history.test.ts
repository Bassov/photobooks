import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  makeBook,
  makeBookWithAsset,
  makeCustomPrintProfile,
} from '../core/testing/fixtures'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  redoBook,
  resetBookStore,
  subscribeHistory,
  undoBook,
} from './bookStore'

describe('bookStore history', () => {
  afterEach(() => {
    resetBookStore()
  })

  it('starts with nothing to undo or redo', () => {
    expect(getHistorySnapshot()).toEqual(
      expect.objectContaining({ canUndo: false, canRedo: false }),
    )
  })

  it('notifies subscribers only when availability changes', () => {
    resetBookStore()
    const listener = vi.fn()
    const stop = subscribeHistory(listener)
    dispatchBookOp({ type: 'addSpread', id: 'a' })
    dispatchBookOp({ type: 'addSpread', id: 'b' })
    expect(listener).toHaveBeenCalledTimes(1)
    undoBook()
    expect(listener).toHaveBeenCalledTimes(2)
    undoBook()
    expect(listener).toHaveBeenCalledTimes(3)
    redoBook()
    expect(listener).toHaveBeenCalledTimes(4)
    stop()
    redoBook()
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('a no-op dispatch records nothing', () => {
    resetBookStore()
    dispatchBookOp({ type: 'removeFromGallery', assetId: 'missing' })
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('gallery adds keep earlier steps undoable', () => {
    resetBookStore()
    const start = getBookStoreSnapshot().book.spreads
    dispatchBookOp({ type: 'addSpread', id: 'extra' })
    dispatchBookOp({ type: 'addToGallery', assetIds: ['a1'] })
    expect(getHistorySnapshot().canUndo).toBe(true)
    undoBook()
    expect(getBookStoreSnapshot().book.spreads).toBe(start)
  })

  it('undo to an untitled book drops the title key', () => {
    resetBookStore()
    dispatchBookOp({ type: 'setTitle', title: 'T' })
    undoBook()
    expect(getBookStoreSnapshot().book).not.toHaveProperty('title')
  })

  it('undoes and redoes layout edits, coalescing title typing', () => {
    resetBookStore()
    const start = getBookStoreSnapshot().book
    dispatchBookOp({ type: 'addSpread', id: 'extra' })
    dispatchBookOp({ type: 'setTitle', title: 'A' })
    dispatchBookOp({ type: 'setTitle', title: 'AB' })
    expect(getHistorySnapshot()).toEqual(
      expect.objectContaining({ canUndo: true, canRedo: false }),
    )

    undoBook()
    expect(getBookStoreSnapshot().book.title).toBeUndefined()
    expect(getBookStoreSnapshot().book.spreads).toHaveLength(4)
    undoBook()
    expect(getBookStoreSnapshot().book.spreads).toBe(start.spreads)
    expect(getHistorySnapshot()).toEqual(
      expect.objectContaining({ canUndo: false, canRedo: true }),
    )
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

  it('a fresh store has an empty history snapshot', async () => {
    vi.resetModules()
    const fresh = await import('./bookStore')
    expect(fresh.getHistorySnapshot()).toStrictEqual({
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
    })
  })

  it('notifies when only the redo label changes', () => {
    resetBookStore()
    dispatchBookOp({ type: 'addSpread', id: 'a' })
    dispatchBookOp({ type: 'addSpread', id: 'b' })
    dispatchBookOp({ type: 'removeSpread', spreadId: 'a' })
    undoBook()
    expect(getHistorySnapshot()).toEqual({
      canUndo: true,
      canRedo: true,
      undoLabel: 'Add spread',
      redoLabel: 'Delete spread',
    })
    const listener = vi.fn()
    const stop = subscribeHistory(listener)
    undoBook()
    stop()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getHistorySnapshot()).toEqual({
      canUndo: true,
      canRedo: true,
      undoLabel: 'Add spread',
      redoLabel: 'Add spread',
    })
  })

  it('reset clears history', () => {
    dispatchBookOp({ type: 'addSpread', id: 'x' })
    resetBookStore()
    expect(getHistorySnapshot()).toEqual(
      expect.objectContaining({ canUndo: false, canRedo: false }),
    )
  })
})

describe('bookStore history: cover', () => {
  afterEach(() => {
    resetBookStore()
  })

  it('undo and redo step cover text and cover photo edits', () => {
    resetBookStore({
      book: makeBookWithAsset('a1', { place: false }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    dispatchBookOp({ type: 'setCoverPhoto', assetId: 'a1' })
    dispatchBookOp({ type: 'setCoverText', panel: 'front', text: 'Lake' })
    expect(getBookStoreSnapshot().book.cover.front).toMatchObject({
      assetId: 'a1',
      text: 'Lake',
    })
    undoBook()
    expect(getBookStoreSnapshot().book.cover.front.text).toBe('')
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBe('a1')
    undoBook()
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBeUndefined()
    redoBook()
    redoBook()
    expect(getBookStoreSnapshot().book.cover.front.text).toBe('Lake')
  })

  it('typing in one cover panel is one undo step', () => {
    resetBookStore({
      book: makeBookWithAsset('a1', { place: false }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    dispatchBookOp({ type: 'setCoverText', panel: 'back', text: 'T' })
    dispatchBookOp({ type: 'setCoverText', panel: 'back', text: 'Th' })
    undoBook()
    expect(getBookStoreSnapshot().book.cover.back.text).toBe('')
  })
})

describe('bookStore history: page numbers', () => {
  afterEach(() => {
    resetBookStore()
  })

  function loadMasterBook(): void {
    resetBookStore({
      book: makeBook({
        parents: [{ id: 'pA', name: 'Master A', frames: [], guides: [] }],
        defaultParentId: 'pA',
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  }

  it('undo and redo step master page numbers and book numbering', () => {
    loadMasterBook()
    dispatchBookOp({
      type: 'setParentPageNumbers',
      parentId: 'pA',
      position: 'outer',
    })
    expect(getHistorySnapshot().undoLabel).toBe('Page numbers')
    dispatchBookOp({
      type: 'setPageNumbering',
      patch: { start: 5, format: 'upper-roman' },
    })
    expect(getHistorySnapshot().undoLabel).toBe('Page numbering')
    expect(getBookStoreSnapshot().book.pageNumbering).toEqual({
      start: 5,
      skipFirst: false,
      format: 'upper-roman',
    })

    undoBook()
    expect('pageNumbering' in getBookStoreSnapshot().book).toBe(false)
    undoBook()
    expect(getBookStoreSnapshot().book.parents?.[0]?.pageNumbers).toBe(
      undefined,
    )

    redoBook()
    redoBook()
    const { book } = getBookStoreSnapshot()
    expect(book.parents?.[0]?.pageNumbers?.map((item) => item.id)).toEqual([
      'pA-pn-l',
      'pA-pn-r',
    ])
    expect(book.pageNumbering?.start).toBe(5)
  })

  it('a numbering patch that changes nothing records no step', () => {
    loadMasterBook()
    dispatchBookOp({ type: 'setPageNumbering', patch: { start: 1 } })
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('picks a printer in one undo step; a profile refresh is not a step', () => {
    resetBookStore()
    const before = getBookStoreSnapshot().book
    const custom = makeCustomPrintProfile()
    dispatchBookOp({
      type: 'setPrintProfile',
      id: custom.id,
      customs: [custom],
    })
    expect(getBookStoreSnapshot().book.printProfile?.id).toBe(custom.id)
    expect(getBookStoreSnapshot().book.settings.safeMarginMm).toBe(12.7)
    expect(getHistorySnapshot().undoLabel).toBe('Printer')
    dispatchBookOp({
      type: 'refreshPrintProfile',
      profile: { ...custom, safeMarginMm: 9 },
    })
    expect(getBookStoreSnapshot().book.settings.safeMarginMm).toBe(9)
    undoBook()
    expect(getBookStoreSnapshot().book.printProfile).toBe(before.printProfile)
    expect('printProfile' in getBookStoreSnapshot().book).toBe(
      'printProfile' in before,
    )
    expect(getBookStoreSnapshot().book.settings).toEqual(before.settings)
    expect(getHistorySnapshot().canUndo).toBe(false)
    redoBook()
    expect(getBookStoreSnapshot().book.printProfile?.id).toBe(custom.id)
  })
})
