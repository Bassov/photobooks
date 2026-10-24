import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAssetSource, resetAssetSources } from '../photo/assetSources'
import { makePlacedTemplateBook } from '../core/testing/fixtures'
import { PAINTER_ASSET_IDS } from '../core/testing/painterFixture'
import {
  enqueueGalleryAssets,
  loadPainterFixture,
  getAssetAspectSnapshot,
  getAssetContentHash,
  getAssetDisplayName,
  getHasAnyPlacementSnapshot,
  getPlacementCountSnapshot,
  getBookStoreSnapshot,
  getGalleryAspectsSnapshot,
  getGalleryDisplayNamesSnapshot,
  getGalleryIdsSnapshot,
  getSpacerCountSnapshot,
  mintAssetId,
  patchAssetRecord,
  removeFailedImportAsset,
  resetBookStore,
  setAssetSessionMeta,
  setImportRunning,
  subscribeBookStore,
  subscribeGallery,
  dispatchBookOp,
  type AssetSessionMeta,
} from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'

function sessionFile(name: string, aspect = 1.5): AssetSessionMeta {
  return {
    name,
    correctedWidth: 30,
    correctedHeight: 20,
    orientation: 1,
    aspect,
  }
}

describe('bookStore', () => {
  afterEach(() => {
    resetBookStore()
    resetAssetSources()
    setEditorStatus('')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('updates placement counts when the book changes', () => {
    expect(getPlacementCountSnapshot('painter-b')).toBe(0)
    expect(getHasAnyPlacementSnapshot()).toBe(false)

    loadPainterFixture()

    expect(getPlacementCountSnapshot('painter-b')).toBeGreaterThan(0)
    expect(getPlacementCountSnapshot('missing')).toBe(0)
    expect(getHasAnyPlacementSnapshot()).toBe(true)
  })

  it('retains a session file for each painter fixture asset', () => {
    loadPainterFixture()

    for (const assetId of PAINTER_ASSET_IDS) {
      expect(getAssetSource(assetId)?.type).toBe('image/png')
    }
    expect(getBookStoreSnapshot().book.id).toBe('painter-fixture')
  })

  it('mints unique asset ids with sanitized names', () => {
    expect(mintAssetId('a.jpg')).not.toBe(mintAssetId('a.jpg'))
    expect(mintAssetId('weird name!!.png')).toMatch(
      /^asset-\d+-weird_name_+\.png$/,
    )
  })

  it('appends gallery ids and session meta on rAF flush', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const listener = vi.fn()
    const unsubscribe = subscribeBookStore(listener)
    enqueueGalleryAssets([
      {
        assetId: 'a1',
        meta: {
          name: 'a.jpg',
          correctedWidth: 30,
          correctedHeight: 20,
          orientation: 1,
          aspect: 1.5,
        },
      },
    ])
    expect(getBookStoreSnapshot().book.gallery).toContain('a1')
    expect(getBookStoreSnapshot().sessionMeta.get('a1')?.aspect).toBe(1.5)
    expect(listener).toHaveBeenCalled()
    setAssetSessionMeta('a1', {
      name: 'a.jpg',
      correctedWidth: 40,
      correctedHeight: 20,
      orientation: 1,
      aspect: 2,
    })
    expect(getBookStoreSnapshot().sessionMeta.get('a1')?.aspect).toBe(2)
    unsubscribe()
  })

  it('uses placeholder meta when enqueue omits meta', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([{ assetId: 'plain' }])
    expect(getBookStoreSnapshot().sessionMeta.get('plain')).toEqual({
      name: 'plain',
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      aspect: 1,
    })
  })

  it('flushes gallery in chunks across animation frames', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const ids = Array.from({ length: 10 }, (_, i) => `id-${String(i)}`)
    enqueueGalleryAssets(ids.map((assetId) => ({ assetId })))
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(0)

    callbacks[0]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(4)
    callbacks[1]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(8)
    callbacks[2]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(10)
  })

  it('flushes gallery via setTimeout watchdog when rAF never runs', () => {
    vi.stubGlobal('requestAnimationFrame', (): number => 1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    enqueueGalleryAssets([{ assetId: 'hidden-a' }, { assetId: 'hidden-b' }])
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(0)
    vi.advanceTimersByTime(31)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(getBookStoreSnapshot().book.gallery).toEqual([
      'hidden-a',
      'hidden-b',
    ])
    vi.useRealTimers()
  })

  it('clears the flush watchdog so a stale timer cannot flush the next batch early', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        rafCallbacks.push(cb)
        return rafCallbacks.length
      },
    )
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    enqueueGalleryAssets([{ assetId: 'first' }])
    expect(rafCallbacks).toHaveLength(1)
    rafCallbacks[0]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toEqual(['first'])

    // Leave less than one watchdog period so a non-cleared first timer would
    // still be due soon after the next enqueue.
    vi.advanceTimersByTime(30)
    enqueueGalleryAssets([{ assetId: 'second' }])
    expect(rafCallbacks).toHaveLength(2)
    expect(getBookStoreSnapshot().book.gallery).toEqual(['first'])
    vi.advanceTimersByTime(2)
    expect(getBookStoreSnapshot().book.gallery).toEqual(['first'])
    rafCallbacks[1]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toEqual(['first', 'second'])
    vi.useRealTimers()
  })

  it('keeps contentHash when hash finishes before gallery flush', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const hash =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    patchAssetRecord('early-hash', { contentHash: hash })
    expect(getAssetContentHash('early-hash')).toBe(hash)

    enqueueGalleryAssets([
      {
        assetId: 'early-hash',
        asset: {
          sourceRootId: 'root',
          relativePath: 'a.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])
    expect(getAssetContentHash('early-hash')).toBe(hash)
    expect(getBookStoreSnapshot().book.assets['early-hash']).toBeUndefined()

    callbacks[0]?.(0)
    expect(getBookStoreSnapshot().book.assets['early-hash']?.contentHash).toBe(
      hash,
    )
    expect(getAssetContentHash('early-hash')).toBe(hash)
  })

  it('removeFailedImportAsset drops a still-pending id before flush', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const hash =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    patchAssetRecord('pending-fail', { contentHash: hash })
    enqueueGalleryAssets([
      {
        assetId: 'pending-fail',
        meta: sessionFile('pending-fail.jpg'),
        asset: {
          sourceRootId: 'root',
          relativePath: 'pending-fail.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])
    expect(getAssetContentHash('pending-fail')).toBe(hash)
    removeFailedImportAsset('pending-fail')
    callbacks[0]?.(0)
    expect(getGalleryIdsSnapshot()).toEqual([])
    expect(getBookStoreSnapshot().sessionMeta.has('pending-fail')).toBe(false)
    expect(getBookStoreSnapshot().book.assets['pending-fail']).toBeUndefined()
    patchAssetRecord('pending-fail', { contentHash: 'abc' })
    expect(getAssetContentHash('pending-fail')).toBeUndefined()
  })

  it('removeFailedImportAsset clears a flushed id and cascaded placements', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      { assetId: 'flushed-fail', meta: sessionFile('flushed-fail.jpg') },
    ])
    expect(getGalleryIdsSnapshot()).toEqual(['flushed-fail'])
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
    const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id
    assert.ok(spreadId)
    assert.ok(frameId)
    dispatchBookOp({
      type: 'place',
      spreadId,
      frameId,
      assetId: 'flushed-fail',
    })
    expect(getPlacementCountSnapshot('flushed-fail')).toBe(1)

    removeFailedImportAsset('flushed-fail')
    expect(getGalleryIdsSnapshot()).toEqual([])
    expect(getPlacementCountSnapshot('flushed-fail')).toBe(0)
    expect(getBookStoreSnapshot().sessionMeta.has('flushed-fail')).toBe(false)
    patchAssetRecord('flushed-fail', {
      contentHash:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    })
    expect(getBookStoreSnapshot().book.assets['flushed-fail']).toBeUndefined()
  })

  it('removeFailedImportAsset is a no-op for an unknown id and reset clears the drop guard', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    enqueueGalleryAssets([
      { assetId: 'keep-me', meta: sessionFile('keep.jpg') },
      { assetId: 'also-keep', meta: sessionFile('also.jpg') },
    ])
    removeFailedImportAsset('never-seen')
    callbacks[0]?.(0)
    expect(getGalleryIdsSnapshot()).toEqual(['keep-me', 'also-keep'])
    patchAssetRecord('never-seen', {
      contentHash:
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    expect(getAssetContentHash('never-seen')).toBeUndefined()

    resetBookStore()
    const hash =
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    // Same id must work again only if reset cleared the drop guard.
    patchAssetRecord('never-seen', { contentHash: hash })
    expect(getAssetContentHash('never-seen')).toBe(hash)
  })

  it('re-enqueue after a failed import allows a later hash patch again', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const staleHash =
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    patchAssetRecord('retry-id', { contentHash: staleHash })
    removeFailedImportAsset('retry-id')
    const hash =
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
    patchAssetRecord('retry-id', { contentHash: hash })
    expect(getAssetContentHash('retry-id')).toBeUndefined()

    enqueueGalleryAssets([
      {
        assetId: 'retry-id',
        meta: sessionFile('a.jpg'),
        asset: {
          sourceRootId: 'root',
          relativePath: 'a.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])
    // Stale early patch must have been cleared on remove; only a post-enqueue
    // patch should land.
    expect(getAssetContentHash('retry-id')).toBeUndefined()
    patchAssetRecord('retry-id', { contentHash: hash })
    expect(getAssetContentHash('retry-id')).toBe(hash)
    callbacks[0]?.(0)
    expect(getBookStoreSnapshot().book.assets['retry-id']?.contentHash).toBe(
      hash,
    )
  })

  it('merges contentHash onto a pending asset record before flush', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const hash =
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
    enqueueGalleryAssets([
      {
        assetId: 'pending-hash',
        asset: {
          sourceRootId: 'root',
          relativePath: 'b.jpg',
          byteSize: 2,
          mtimeMs: 2,
        },
      },
    ])
    patchAssetRecord('pending-hash', { contentHash: hash })
    expect(getAssetContentHash('pending-hash')).toBe(hash)

    callbacks[0]?.(0)
    expect(
      getBookStoreSnapshot().book.assets['pending-hash']?.contentHash,
    ).toBe(hash)
  })

  it('exposes flushed gallery ids while import is running', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([{ assetId: 'before' }])
    expect(getGalleryIdsSnapshot()).toEqual(['before'])

    const galleryListener = vi.fn()
    subscribeGallery(galleryListener)
    setImportRunning(true, 5)
    expect(getSpacerCountSnapshot()).toBe(5)
    expect(getBookStoreSnapshot().importRunning).toBe(true)
    expect(galleryListener).toHaveBeenCalled()

    enqueueGalleryAssets([{ assetId: 'during' }])
    expect(getGalleryIdsSnapshot()).toEqual(['before', 'during'])
    expect(getBookStoreSnapshot().book.gallery).toEqual(['before', 'during'])

    setImportRunning(false)
    expect(getGalleryIdsSnapshot()).toEqual(['before', 'during'])
    expect(getSpacerCountSnapshot()).toBe(2)
    expect(getBookStoreSnapshot().importExpectedCount).toBe(0)
  })

  it('ignores redundant setImportRunning calls', () => {
    const galleryListener = vi.fn()
    subscribeGallery(galleryListener)
    setImportRunning(true, 3)
    galleryListener.mockClear()
    setImportRunning(true, 3)
    expect(galleryListener).not.toHaveBeenCalled()
  })

  it('patchAssetRecord no-ops when the merge leaves the asset unchanged', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const hash =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    enqueueGalleryAssets([
      {
        assetId: 'stable',
        asset: {
          sourceRootId: 'root',
          relativePath: 'stable.jpg',
          byteSize: 10,
          mtimeMs: 1,
          contentHash: hash,
          mime: 'image/jpeg',
          meta: {
            title: 't',
            keywords: ['k'],
            gps: { lat: 1, lon: 2 },
          },
        },
      },
    ])
    const listener = vi.fn()
    subscribeBookStore(listener)
    const before = getBookStoreSnapshot().book.assets.stable

    patchAssetRecord('stable', {
      contentHash: hash,
      mime: 'image/jpeg',
      meta: before?.meta,
    })

    expect(listener).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().book.assets.stable).toBe(before)

    patchAssetRecord('stable', {
      meta: {
        title: 'changed',
        keywords: ['k'],
        gps: { lat: 1, lon: 2 },
      },
    })
    expect(listener).toHaveBeenCalled()
    expect(getBookStoreSnapshot().book.assets.stable?.meta?.title).toBe(
      'changed',
    )
  })

  it('identical sessionMeta flush keeps map identity and skips emit', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const meta = sessionFile('same.jpg', 1.5)
    enqueueGalleryAssets([{ assetId: 'm1', meta }])
    callbacks[0]?.(0)
    const aspectsBefore = getGalleryAspectsSnapshot()
    const metaMapBefore = getBookStoreSnapshot().sessionMeta
    const listener = vi.fn()
    subscribeBookStore(listener)

    setAssetSessionMeta('m1', { ...meta })
    expect(callbacks).toHaveLength(2)
    callbacks[1]?.(0)

    expect(listener).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().sessionMeta).toBe(metaMapBefore)
    expect(getGalleryAspectsSnapshot()).toBe(aspectsBefore)
    // No-op must not re-arm rAF when nothing remains in the gallery queue.
    expect(callbacks).toHaveLength(2)
  })

  it('asset-only flush still emits when gallery and meta are unchanged', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const meta = sessionFile('asset-only.jpg', 1)
    enqueueGalleryAssets([
      {
        assetId: 'ao',
        meta,
        asset: {
          sourceRootId: 'root',
          relativePath: 'ao.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])
    callbacks[0]?.(0)
    const listener = vi.fn()
    subscribeBookStore(listener)

    enqueueGalleryAssets([
      {
        assetId: 'ao',
        meta,
        asset: {
          sourceRootId: 'root',
          relativePath: 'ao.jpg',
          byteSize: 1,
          mtimeMs: 1,
          contentHash:
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        },
      },
    ])
    callbacks[1]?.(0)

    expect(listener).toHaveBeenCalled()
    expect(getBookStoreSnapshot().book.assets.ao?.contentHash).toBe(
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    )
  })

  it('sessionMeta flush emits when any meta field differs', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const base = sessionFile('diff.jpg', 1)
    enqueueGalleryAssets([{ assetId: 'd1', meta: base }])
    const cases: AssetSessionMeta[] = [
      { ...base, name: 'other.jpg' },
      { ...base, correctedWidth: base.correctedWidth + 1 },
      { ...base, correctedHeight: base.correctedHeight + 1 },
      { ...base, orientation: 6 },
      { ...base, aspect: 2 },
    ]
    for (const next of cases) {
      const listener = vi.fn()
      const unsub = subscribeBookStore(listener)
      setAssetSessionMeta('d1', next)
      expect(listener).toHaveBeenCalled()
      unsub()
      // Reset to base for the next field probe.
      setAssetSessionMeta('d1', base)
    }
  })

  it('patchAssetRecord treats empty patch and scalar mismatch correctly', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      {
        assetId: 'p1',
        asset: {
          sourceRootId: 'root',
          relativePath: 'p1.jpg',
          byteSize: 1,
          mtimeMs: 1,
          contentHash:
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          mime: 'image/jpeg',
        },
      },
    ])
    const listener = vi.fn()
    subscribeBookStore(listener)
    const before = getBookStoreSnapshot().book.assets.p1
    patchAssetRecord('p1', {})
    expect(listener).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().book.assets.p1).toBe(before)
    patchAssetRecord('p1', { mime: 'image/png' })
    expect(listener).toHaveBeenCalled()
    expect(getBookStoreSnapshot().book.assets.p1?.mime).toBe('image/png')
  })

  it('coalesces patchAssetRecord emits onto rAF while import is running', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafQueue[id - 1] = () => undefined
    })
    enqueueGalleryAssets([
      {
        assetId: 'h1',
        asset: {
          sourceRootId: 'root',
          relativePath: 'h1.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
      {
        assetId: 'h2',
        asset: {
          sourceRootId: 'root',
          relativePath: 'h2.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])
    rafQueue.shift()?.(0)
    setImportRunning(true, 2)
    const listener = vi.fn()
    subscribeBookStore(listener)
    listener.mockClear()
    rafQueue.length = 0

    patchAssetRecord('h1', {
      contentHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    patchAssetRecord('h2', {
      contentHash:
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    expect(listener).not.toHaveBeenCalled()
    expect(rafQueue).toHaveLength(1)
    expect(getBookStoreSnapshot().book.assets.h1?.contentHash).toMatch(/^a+$/)
    expect(getBookStoreSnapshot().book.assets.h2?.contentHash).toMatch(/^b+$/)

    rafQueue.shift()?.(0)
    expect(listener).toHaveBeenCalledOnce()

    setImportRunning(false)
  })

  it.each([
    { field: 'name' as const, value: 'other.jpg' },
    { field: 'correctedWidth' as const, value: 99 },
    { field: 'correctedHeight' as const, value: 77 },
    { field: 'orientation' as const, value: 6 as const },
    { field: 'aspect' as const, value: 3 },
  ])('sessionMeta flush emits when $field changes', ({ field, value }) => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const meta = sessionFile('base.jpg', 1.5)
    enqueueGalleryAssets([{ assetId: 'm2', meta }])
    const listener = vi.fn()
    subscribeBookStore(listener)

    setAssetSessionMeta('m2', { ...meta, [field]: value })

    expect(listener).toHaveBeenCalled()
    expect(getBookStoreSnapshot().sessionMeta.get('m2')?.[field]).toBe(value)
  })

  it('idempotent gallery re-enqueue with identical meta still drains remaining chunks', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const meta = sessionFile('chunk.jpg', 1)
    const ids = Array.from({ length: 6 }, (_, i) => `chunk-${String(i)}`)
    enqueueGalleryAssets(ids.map((assetId) => ({ assetId, meta })))
    callbacks[0]?.(0)
    callbacks[1]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(6)

    const before = callbacks.length
    const listener = vi.fn()
    subscribeBookStore(listener)
    // Re-enqueue existing ids: addToGallery is idempotent; meta matches → flush no-op,
    // but remaining chunk ids after the first splice must still be scheduled.
    enqueueGalleryAssets(ids.map((assetId) => ({ assetId, meta })))
    expect(listener).not.toHaveBeenCalled()
    expect(callbacks.length).toBeGreaterThan(before)
    callbacks[before]?.(0)
    expect(listener).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(6)
    // Second no-op chunk still schedules the leftover ids.
    expect(callbacks.length).toBeGreaterThan(before + 1)
    callbacks[before + 1]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(6)
  })

  it('notifies gallery subscribers only when gallery identity changes', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      {
        assetId: 'a1',
        meta: {
          name: 'a.jpg',
          correctedWidth: 10,
          correctedHeight: 10,
          orientation: 1,
          aspect: 1,
        },
      },
    ])
    const galleryListener = vi.fn()
    const storeListener = vi.fn()
    subscribeGallery(galleryListener)
    subscribeBookStore(storeListener)

    setAssetSessionMeta('a1', {
      name: 'a.jpg',
      correctedWidth: 20,
      correctedHeight: 10,
      orientation: 1,
      aspect: 2,
    })
    expect(storeListener).toHaveBeenCalled()
    expect(galleryListener).not.toHaveBeenCalled()
  })

  it('exposes stable gallery aspects that update with session meta', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      {
        assetId: 'a1',
        meta: {
          name: 'a.jpg',
          correctedWidth: 30,
          correctedHeight: 20,
          orientation: 1,
          aspect: 1.5,
        },
      },
    ])
    expect(getAssetAspectSnapshot('a1')).toBe(1.5)
    expect(getAssetAspectSnapshot('missing')).toBe(1)
    const first = getGalleryAspectsSnapshot()
    expect(first).toEqual([1.5])
    expect(getGalleryAspectsSnapshot()).toBe(first)

    setAssetSessionMeta('a1', {
      name: 'a.jpg',
      correctedWidth: 20,
      correctedHeight: 40,
      orientation: 1,
      aspect: 0.5,
    })
    const second = getGalleryAspectsSnapshot()
    expect(second).toEqual([0.5])
    expect(second).not.toBe(first)
  })

  it('announces a plural count when a smaller template drops placements', () => {
    loadPlacedBook(['a', 'b', 'c', 'd'])

    dispatchBookOp({
      type: 'applyTemplate',
      spreadId: 'spread-1',
      templateId: 'one-per-page',
    })

    expect(getEditorStatus()).toBe('3 photos were unplaced from the spread')
    expect(getBookStoreSnapshot().book.gallery).toEqual(['a', 'b', 'c', 'd'])
    expect(
      getBookStoreSnapshot().book.spreads[0]?.frames.map(
        (frame) => frame.assetId,
      ),
    ).toEqual(['a'])
  })

  it('announces one photo when a smaller template drops a single placement', () => {
    loadPlacedBook(['a', 'b'])

    dispatchBookOp({
      type: 'applyTemplate',
      spreadId: 'spread-1',
      templateId: 'one-per-page',
    })

    expect(getEditorStatus()).toBe('1 photo was unplaced from the spread')
  })

  it('leaves the status unchanged when a template change drops nothing', () => {
    loadPlacedBook(['a'])
    setEditorStatus('Photo moved')

    dispatchBookOp({
      type: 'applyTemplate',
      spreadId: 'spread-1',
      templateId: 'one-per-page',
    })

    expect(getEditorStatus()).toBe('Photo moved')
  })

  it('keeps gallery display names stable until the session file name changes', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      { assetId: 'a1', meta: sessionFile('фото отпуск 01.jpg') },
    ])

    expect(getAssetDisplayName('a1')).toBe('фото отпуск 01.jpg')
    expect(getAssetDisplayName('missing')).toBe('missing')
    const first = getGalleryDisplayNamesSnapshot()
    expect(first).toEqual(['фото отпуск 01.jpg'])
    expect(getGalleryDisplayNamesSnapshot()).toBe(first)

    setAssetSessionMeta('a1', sessionFile('later.jpg'))

    const second = getGalleryDisplayNamesSnapshot()
    expect(second).toEqual(['later.jpg'])
    expect(second).not.toBe(first)
    expect(getGalleryIdsSnapshot()).toEqual(['a1'])
  })

  it('falls back to the asset id when the session file name is blank', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([{ assetId: 'a1', meta: sessionFile('') }])

    expect(getAssetDisplayName('a1')).toBe('a1')
    expect(getGalleryDisplayNamesSnapshot()).toEqual(['a1'])
  })

  it('exposes optional contentHash from the book asset record', () => {
    const hash =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const book = makePlacedTemplateBook('4-grid', ['a1'])
    resetBookStore({
      book: {
        ...book,
        assets: { a1: { contentHash: hash } },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    expect(getAssetContentHash('a1')).toBe(hash)
    expect(getAssetContentHash('missing')).toBeUndefined()
  })
})

function loadPlacedBook(assetIds: readonly string[]): void {
  resetBookStore({
    book: makePlacedTemplateBook('4-grid', assetIds),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}
