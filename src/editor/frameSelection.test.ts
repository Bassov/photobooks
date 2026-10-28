import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { addToGallery, applyTemplate, placeAsset } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import assert from 'node:assert/strict'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import { Filmstrip } from './Filmstrip'
import {
  frameControlLabel,
  getFrameSource,
  getSpreadFrameSourceKey,
  resetFrameSelection,
  setFrameSource,
  sourceFromKey,
  subscribeFrameSelection,
  subscribeSpreadFrameSource,
  withSelectionSync,
} from './frameSelection'
import {
  getGalleryPhotoSelected,
  getSelectedAssetId,
  resetGallerySelection,
  setSelectedAssetId,
  subscribeGalleryPhotoSelected,
  subscribeGallerySelection,
} from './gallerySelection'

describe('frameSelection', () => {
  afterEach(() => {
    cleanup()
    resetFrameSelection()
    resetGallerySelection()
    resetBookStore()
  })

  it('maps null, empty, and frame-id keys for spread labels', () => {
    expect(sourceFromKey('s0', null)).toBeNull()
    expect(sourceFromKey('s0', '')).toEqual({ spreadId: '', frameId: '' })
    expect(sourceFromKey('s0', 'frame-1')).toEqual({
      spreadId: 's0',
      frameId: 'frame-1',
    })
  })

  it('stops notifying after the gallery selection unsubscribes', () => {
    let calls = 0
    const unsubscribe = subscribeGallerySelection(() => {
      calls += 1
    })
    setSelectedAssetId('a')
    expect(calls).toBe(1)
    unsubscribe()
    setSelectedAssetId('b')
    expect(calls).toBe(1)
  })

  it('stops notifying after unsubscribe and clears on reset', () => {
    let calls = 0
    const unsubscribe = subscribeFrameSelection(() => {
      calls += 1
    })
    setFrameSource({ spreadId: 's', frameId: 'f' })
    expect(calls).toBe(1)
    unsubscribe()
    setFrameSource({ spreadId: 's', frameId: 'g' })
    expect(calls).toBe(1)
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'g' })

    resetFrameSelection()
    expect(getFrameSource()).toBeNull()
  })

  it('clears the gallery asset when a frame source is set, and the reverse', () => {
    setSelectedAssetId('a')
    setFrameSource({ spreadId: 's', frameId: 'f' })

    expect(getSelectedAssetId()).toBeNull()
    expect(getFrameSource()).toEqual({ spreadId: 's', frameId: 'f' })

    setSelectedAssetId('b')

    expect(getFrameSource()).toBeNull()
    expect(getSelectedAssetId()).toBe('b')
  })

  it('keeps the same source object when the ids do not change', () => {
    setFrameSource({ spreadId: 's', frameId: 'f' })
    const first = getFrameSource()
    setFrameSource({ spreadId: 's', frameId: 'f' })
    expect(getFrameSource()).toBe(first)
  })

  it('treats the same frame id on another spread as a different source', () => {
    setFrameSource({ spreadId: 's0', frameId: 'f' })
    setFrameSource({ spreadId: 's1', frameId: 'f' })

    expect(getFrameSource()).toEqual({ spreadId: 's1', frameId: 'f' })
    expect(
      frameControlLabel(
        true,
        { spreadId: 's0', frameId: 'f' },
        { spreadId: 's1', frameId: 'f' },
      ),
    ).toBe('Swap photos')
  })

  it('ignores a nested selection sync', () => {
    let calls = 0
    withSelectionSync(() => {
      calls += 1
      withSelectionSync(() => {
        calls += 1
      })
    })
    expect(calls).toBe(1)
  })

  it('names place, select, swap, and move — never Replace photo', () => {
    const frame = { spreadId: 's', frameId: 'f' }
    const other = { spreadId: 's', frameId: 'g' }
    expect(frameControlLabel(false, null, frame)).toBe('Place photo')
    expect(frameControlLabel(true, null, frame)).toBe('Select photo to move')
    expect(frameControlLabel(true, frame, frame)).toBe('Cancel move')
    expect(frameControlLabel(false, frame, frame)).toBe('Place photo')
    expect(frameControlLabel(true, frame, other)).toBe('Swap photos')
    expect(frameControlLabel(false, frame, other)).toBe('Move photo here')
  })

  it('clears a source whose frame disappears with the template', () => {
    resetBookStore()
    let book = addToGallery(getBookStoreSnapshot().book, ['a'])
    const spreadId = book.spreads[0]?.id
    assert(spreadId !== undefined, 'expected a spread')
    book = applyTemplate(book, spreadId, '4-grid')
    const frameId = book.spreads[0]?.frames[3]?.id
    assert(frameId !== undefined, 'expected a fourth frame')
    book = placeAsset(book, spreadId, frameId, 'a')
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    setFrameSource({ spreadId, frameId })
    dispatchBookOp({
      type: 'applyTemplate',
      spreadId,
      templateId: 'one-per-page',
    })

    expect(getFrameSource()).toBeNull()
    render(createElement(Filmstrip))
    expect(
      document.querySelector('.filmstrip-unplace')?.hasAttribute('disabled'),
    ).toBe(true)
  })

  it('labels frames next to an empty selected frame without offering a move', () => {
    const frame = { spreadId: 's', frameId: 'f' }
    const other = { spreadId: 's', frameId: 'g' }
    expect(frameControlLabel(true, frame, other, false)).toBe(
      'Select photo to move',
    )
    expect(frameControlLabel(false, frame, other, false)).toBe('Place photo')
  })

  it('keeps an empty frame selected through unrelated edits, then drops it when it fills or goes', () => {
    resetBookStore()
    let book = addToGallery(getBookStoreSnapshot().book, ['a', 'b'])
    const spreadId = book.spreads[0]?.id
    assert(spreadId !== undefined, 'expected a spread')
    book = applyTemplate(book, spreadId, '4-grid')
    const frames = book.spreads[0]?.frames.map((f) => f.id) ?? []
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const selected = { spreadId, frameId: frames[0] ?? '' }
    setFrameSource(selected)

    dispatchBookOp({ type: 'setTitle', title: 'T' })
    expect(getFrameSource()).toEqual(selected)

    dispatchBookOp({
      type: 'place',
      spreadId,
      frameId: selected.frameId,
      assetId: 'a',
    })
    expect(getFrameSource()).toBeNull()

    setFrameSource({ spreadId, frameId: frames[1] ?? '' })
    dispatchBookOp({
      type: 'removeFrames',
      spreadId,
      frameIds: [frames[1] ?? ''],
    })
    expect(getFrameSource()).toBeNull()
  })

  it('judges a selected frame by its own spread when frame ids repeat', () => {
    resetBookStore({
      book: makeBook({
        spreads: [
          makeSpread({ id: 's1', frames: [makeFrame({ id: 'frame-1' })] }),
          makeSpread({ id: 's2', frames: [makeFrame({ id: 'frame-1' })] }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    setFrameSource({ spreadId: 's2', frameId: 'frame-1' })
    dispatchBookOp({
      type: 'removeFrames',
      spreadId: 's2',
      frameIds: ['frame-1'],
    })
    expect(getFrameSource()).toBeNull()
  })

  it('clears a source when the book is reset without that frame', () => {
    setFrameSource({ spreadId: 'gone', frameId: 'gone' })
    resetBookStore()

    expect(getFrameSource()).toBeNull()
    render(createElement(Filmstrip))
    expect(
      document.querySelector('.filmstrip-unplace')?.hasAttribute('disabled'),
    ).toBe(true)
  })

  it('notifies gallery subscribers only when a photo becomes selected or cleared', () => {
    let calls = 0
    const unsubscribe = subscribeGalleryPhotoSelected(() => {
      calls += 1
    })

    expect(getGalleryPhotoSelected()).toBe(false)
    setSelectedAssetId('a')
    expect(calls).toBe(1)
    expect(getGalleryPhotoSelected()).toBe(true)

    setSelectedAssetId('b')
    expect(calls).toBe(1)
    expect(getGalleryPhotoSelected()).toBe(true)

    setSelectedAssetId(null)
    expect(calls).toBe(2)
    expect(getGalleryPhotoSelected()).toBe(false)

    unsubscribe()
    setSelectedAssetId('c')
    expect(calls).toBe(2)
  })

  it('keys a spread source as missing, elsewhere, or this frame', () => {
    let calls = 0
    let ownCalls = 0
    const unsubscribe = subscribeSpreadFrameSource('s1', () => {
      calls += 1
    })
    const unsubscribeOwn = subscribeSpreadFrameSource('s0', () => {
      ownCalls += 1
    })

    expect(getSpreadFrameSourceKey('s1')).toBeNull()
    setFrameSource({ spreadId: 's0', frameId: 'f0' })
    expect(calls).toBe(1)
    expect(ownCalls).toBe(1)
    expect(getSpreadFrameSourceKey('s1')).toBe('')
    expect(getSpreadFrameSourceKey('s0')).toBe('f0')

    setFrameSource({ spreadId: 's0', frameId: 'f1' })
    expect(calls).toBe(1)
    expect(ownCalls).toBe(2)
    expect(getSpreadFrameSourceKey('s1')).toBe('')
    expect(getSpreadFrameSourceKey('s0')).toBe('f1')

    setFrameSource({ spreadId: 's1', frameId: 'g' })
    expect(calls).toBe(2)
    expect(getSpreadFrameSourceKey('s1')).toBe('g')

    setFrameSource(null)
    expect(calls).toBe(3)
    expect(getSpreadFrameSourceKey('s1')).toBeNull()

    expect(ownCalls).toBe(4)

    unsubscribe()
    unsubscribeOwn()
    setFrameSource({ spreadId: 's1', frameId: 'g' })
    expect(calls).toBe(3)
    expect(ownCalls).toBe(4)
  })
})
