import { afterEach, describe, expect, it, vi } from 'vitest'
import { placeAsset } from '../core'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { seedGallery } from './gallery.test-helpers'
import {
  cancelGalleryRemove,
  confirmGalleryRemove,
  getPendingGalleryRemoveId,
  requestGalleryRemove,
  subscribePendingGalleryRemove,
} from './galleryRemoveRequest'
import {
  getSelectedAssetId,
  resetGallerySelection,
  setSelectedAssetId,
} from './gallerySelection'

function placeFirst(assetId: string): void {
  const snap = getBookStoreSnapshot()
  const spread = snap.book.spreads[0]
  const frameId = spread?.frames[0]?.id
  if (spread === undefined || frameId === undefined) {
    throw new Error('expected a frame')
  }
  resetBookStore({
    book: placeAsset(snap.book, spread.id, frameId, assetId),
    sessionMeta: snap.sessionMeta,
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('gallery remove request', () => {
  afterEach(() => {
    cancelGalleryRemove()
    resetBookStore()
    resetGallerySelection()
    setEditorStatus('')
  })

  it('removes an unplaced photo at once and reports it on the status line', () => {
    const ids = seedGallery(2)
    const listener = vi.fn()
    const unsubscribe = subscribePendingGalleryRemove(listener)
    requestGalleryRemove(ids[0] ?? '', 'one.jpg')
    unsubscribe()
    expect(getBookStoreSnapshot().book.gallery).toEqual([ids[1]])
    expect(getEditorStatus()).toBe(
      'one.jpg removed from the gallery — the file stays on disk',
    )
    expect(getPendingGalleryRemoveId()).toBeNull()
    expect(listener).not.toHaveBeenCalled()
  })

  it('clears the selection only when the removed photo was selected', () => {
    const ids = seedGallery(3)
    setSelectedAssetId(ids[1] ?? null)
    requestGalleryRemove(ids[0] ?? '', 'a')
    expect(getSelectedAssetId()).toBe(ids[1])
    requestGalleryRemove(ids[1] ?? '', 'b')
    expect(getSelectedAssetId()).toBeNull()
  })

  it('asks first for a placed photo and keeps it until confirmed', () => {
    const ids = seedGallery(2)
    placeFirst(ids[0] ?? '')
    const listener = vi.fn()
    const unsubscribe = subscribePendingGalleryRemove(listener)
    requestGalleryRemove(ids[0] ?? '', 'one.jpg')
    expect(getPendingGalleryRemoveId()).toBe(ids[0])
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getBookStoreSnapshot().book.gallery).toEqual([...ids])
    expect(getEditorStatus()).toBe('')

    confirmGalleryRemove('one.jpg')
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    expect(getPendingGalleryRemoveId()).toBeNull()
    expect(getBookStoreSnapshot().book.gallery).toEqual([ids[1]])
    expect(getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId).toBe(
      undefined,
    )
    expect(getEditorStatus()).toContain('one.jpg removed')
  })

  it('cancel clears the pending request and notifies once', () => {
    const ids = seedGallery(1)
    placeFirst(ids[0] ?? '')
    requestGalleryRemove(ids[0] ?? '', 'x')
    const listener = vi.fn()
    const unsubscribe = subscribePendingGalleryRemove(listener)
    cancelGalleryRemove()
    cancelGalleryRemove()
    unsubscribe()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getPendingGalleryRemoveId()).toBeNull()
    expect(getBookStoreSnapshot().book.gallery).toEqual([...ids])
  })

  it('confirm without a pending request does nothing', () => {
    seedGallery(1)
    const listener = vi.fn()
    const unsubscribe = subscribePendingGalleryRemove(listener)
    confirmGalleryRemove('ghost')
    unsubscribe()
    expect(getEditorStatus()).toBe('')
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(1)
  })

  it('stops notifying after unsubscribe', () => {
    const ids = seedGallery(1)
    placeFirst(ids[0] ?? '')
    const listener = vi.fn()
    subscribePendingGalleryRemove(listener)()
    requestGalleryRemove(ids[0] ?? '', 'x')
    expect(listener).not.toHaveBeenCalled()
  })
})
