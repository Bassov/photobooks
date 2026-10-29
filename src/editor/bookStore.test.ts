import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetSources } from '../photo/assetSources'
import { makePlacedTemplateBook } from '../core/testing/fixtures'
import { loadPainterFixture } from '../testFixtures/loadPainterFixture'
import type { ResolvedItem } from '../core/geometry/types'
import {
  awaitPendingGalleryFlush,
  enqueueGalleryAssets,
  loadPainterFixture as loadPainterFixtureLazy,
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
  getSpreadPaintSnapshot,
  mintAssetId,
  patchAssetRecord,
  removeFailedImportAsset,
  removeFailedImportAssets,
  resetBookStore,
  setAssetSessionMeta,
  setImportRunning,
  subscribeBookStore,
  subscribeGallery,
  dispatchBookOp,
  type AssetSessionMeta,
} from './bookStore'
import {
  noteFilmstripScrollActivity,
  resetFilmstripScrollQuietForTests,
} from './filmstripScrollQuiet'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import {
  getDecodeImportActiveForTests,
  resetAssetPool,
  setDecodeImportActive,
} from '../photo/assetPool'

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
    resetFilmstripScrollQuietForTests()
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

  it('loads the painter fixture in dev/fixture builds', async () => {
    loadPainterFixtureLazy()
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.id).toBe('painter-fixture')
    })
  })

  it('loads the painter fixture in a non-dev VITE_TEST_FIXTURES build', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_TEST_FIXTURES', '1')
    try {
      loadPainterFixtureLazy()
      await vi.waitFor(() => {
        expect(getBookStoreSnapshot().book.id).toBe('painter-fixture')
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does not load the painter fixture in a deploy build', async () => {
    const before = getBookStoreSnapshot().book.id
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_TEST_FIXTURES', '')
    try {
      loadPainterFixtureLazy()
      await new Promise((r) => setTimeout(r, 20))
      expect(getBookStoreSnapshot().book.id).toBe(before)
    } finally {
      vi.unstubAllEnvs()
    }
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

  it('defers meta-only flushes while the filmstrip scroll-quiet window is open', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    enqueueGalleryAssets([{ assetId: 'q1', meta: sessionFile('q.jpg', 1) }])
    callbacks[0]?.(0)
    expect(getBookStoreSnapshot().sessionMeta.get('q1')?.aspect).toBe(1)

    noteFilmstripScrollActivity()
    setAssetSessionMeta('q1', sessionFile('q.jpg', 2))
    callbacks[1]?.(0)
    expect(getBookStoreSnapshot().sessionMeta.get('q1')?.aspect).toBe(1)

    resetFilmstripScrollQuietForTests()
    vi.advanceTimersByTime(200)
    expect(getBookStoreSnapshot().sessionMeta.get('q1')?.aspect).toBe(2)
    vi.useRealTimers()
  })

  it('paces decode session-meta flushes to one asset per frame', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    enqueueGalleryAssets([
      { assetId: 'm-a', meta: sessionFile('a.jpg', 1) },
      { assetId: 'm-b', meta: sessionFile('b.jpg', 1) },
      { assetId: 'm-c', meta: sessionFile('c.jpg', 1) },
    ])
    // Drain gallery enqueue (chunk 4 covers all three).
    callbacks[0]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toEqual(['m-a', 'm-b', 'm-c'])

    setAssetSessionMeta('m-a', sessionFile('a.jpg', 1.5))
    setAssetSessionMeta('m-b', sessionFile('b.jpg', 1.5))
    setAssetSessionMeta('m-c', sessionFile('c.jpg', 1.5))
    expect(callbacks).toHaveLength(2)

    callbacks[1]?.(0)
    expect(getBookStoreSnapshot().sessionMeta.get('m-a')?.aspect).toBe(1.5)
    expect(getBookStoreSnapshot().sessionMeta.get('m-b')?.aspect).toBe(1)
    expect(getBookStoreSnapshot().sessionMeta.get('m-c')?.aspect).toBe(1)

    callbacks[2]?.(0)
    expect(getBookStoreSnapshot().sessionMeta.get('m-b')?.aspect).toBe(1.5)
    expect(getBookStoreSnapshot().sessionMeta.get('m-c')?.aspect).toBe(1)

    callbacks[3]?.(0)
    expect(getBookStoreSnapshot().sessionMeta.get('m-c')?.aspect).toBe(1.5)
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

  it('removeFailedImportAssets clears many flushed ids with one gallery notify', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      { assetId: 'batch-a', meta: sessionFile('a.jpg') },
      { assetId: 'batch-b', meta: sessionFile('b.jpg') },
      { assetId: 'batch-keep', meta: sessionFile('keep.jpg') },
    ])
    expect(getGalleryIdsSnapshot()).toEqual([
      'batch-a',
      'batch-b',
      'batch-keep',
    ])

    let galleryNotifies = 0
    const unsubscribe = subscribeGallery(() => {
      galleryNotifies += 1
    })
    removeFailedImportAssets(['batch-a', 'batch-b', 'batch-a'])
    unsubscribe()

    expect(galleryNotifies).toBe(1)
    expect(getGalleryIdsSnapshot()).toEqual(['batch-keep'])
    expect(getBookStoreSnapshot().sessionMeta.has('batch-a')).toBe(false)
    expect(getBookStoreSnapshot().sessionMeta.has('batch-b')).toBe(false)
    expect(getBookStoreSnapshot().sessionMeta.has('batch-keep')).toBe(true)
  })

  it('removeFailedImportAssets is a no-op for an empty id list', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([{ assetId: 'stay', meta: sessionFile('stay.jpg') }])
    const metaBefore = getBookStoreSnapshot().sessionMeta
    const listener = vi.fn()
    const unsubscribe = subscribeBookStore(listener)
    removeFailedImportAssets([])
    unsubscribe()
    expect(listener).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().sessionMeta).toBe(metaBefore)
    expect(getGalleryIdsSnapshot()).toEqual(['stay'])
  })

  it('removeFailedImportAssets drops one pending id without clearing siblings', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    enqueueGalleryAssets([
      { assetId: 'pending-keep', meta: sessionFile('keep.jpg') },
      { assetId: 'pending-drop', meta: sessionFile('drop.jpg') },
    ])
    removeFailedImportAssets(['pending-drop'])
    callbacks[0]?.(0)
    expect(getGalleryIdsSnapshot()).toEqual(['pending-keep'])
    expect(getBookStoreSnapshot().sessionMeta.has('pending-keep')).toBe(true)
    expect(getBookStoreSnapshot().sessionMeta.has('pending-drop')).toBe(false)
  })

  it('removeFailedImportAssets removes a flushed id even when mixed with unknowns', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      { assetId: 'mixed-a', meta: sessionFile('a.jpg') },
      { assetId: 'mixed-keep', meta: sessionFile('keep.jpg') },
    ])
    removeFailedImportAssets(['ghost-id', 'mixed-a'])
    expect(getGalleryIdsSnapshot()).toEqual(['mixed-keep'])
    expect(getBookStoreSnapshot().book.assets['mixed-a']).toBeUndefined()
  })

  it('removeFailedImportAssets without session meta skips a meta-only emit', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([{ assetId: 'stay', meta: sessionFile('stay.jpg') }])
    const metaBefore = getBookStoreSnapshot().sessionMeta
    const listener = vi.fn()
    const unsubscribe = subscribeBookStore(listener)
    // Id absent from sessionMeta: must not rewrite the map or emit.
    removeFailedImportAssets(['never-flushed-meta'])
    unsubscribe()
    expect(listener).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().sessionMeta).toBe(metaBefore)
    expect(getGalleryIdsSnapshot()).toEqual(['stay'])
  })

  it('removeFailedImportAssets clears an assets-map orphan missing from the gallery', () => {
    const hash =
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    const book = getBookStoreSnapshot().book
    resetBookStore({
      book: {
        ...book,
        assets: { ...book.assets, orphan: { contentHash: hash } },
        gallery: book.gallery.filter((id) => id !== 'orphan'),
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    expect(getBookStoreSnapshot().book.assets.orphan?.contentHash).toBe(hash)
    expect(getGalleryIdsSnapshot()).not.toContain('orphan')

    removeFailedImportAssets(['orphan'])
    expect(getBookStoreSnapshot().book.assets.orphan).toBeUndefined()
    expect(getAssetContentHash('orphan')).toBeUndefined()
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

  it('awaitPendingGalleryFlush drains queued gallery ids before snapshot', async () => {
    vi.stubGlobal('requestAnimationFrame', (): number => 1)
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const yieldSpy = vi.fn(() => Promise.resolve())
    enqueueGalleryAssets([
      { assetId: 'q1' },
      { assetId: 'q2' },
      { assetId: 'q3' },
      { assetId: 'q4' },
      { assetId: 'q5' },
      { assetId: 'q6' },
      { assetId: 'q7' },
      { assetId: 'q8' },
      { assetId: 'q9' },
    ])
    expect(getBookStoreSnapshot().book.gallery).toEqual([])

    await awaitPendingGalleryFlush(yieldSpy)

    expect(getBookStoreSnapshot().book.gallery).toEqual([
      'q1',
      'q2',
      'q3',
      'q4',
      'q5',
      'q6',
      'q7',
      'q8',
      'q9',
    ])
    // GALLERY_FLUSH_CHUNK is 4 → two yields between three drain steps.
    expect(yieldSpy).toHaveBeenCalledTimes(2)
    expect(clearTimeoutSpy).toHaveBeenCalled()
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

  it('mirrors importRunning onto decode import-active concurrency', () => {
    resetAssetPool()
    expect(getDecodeImportActiveForTests()).toBe(false)
    setImportRunning(true, 2)
    expect(getDecodeImportActiveForTests()).toBe(true)
    setImportRunning(false)
    expect(getDecodeImportActiveForTests()).toBe(false)
    setDecodeImportActive(true)
    resetBookStore()
    expect(getDecodeImportActiveForTests()).toBe(false)
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

  it('emits patchAssetRecord immediately when import is not running', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    enqueueGalleryAssets([
      {
        assetId: 'live',
        asset: {
          sourceRootId: 'root',
          relativePath: 'live.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])
    rafQueue.shift()?.(0)
    rafQueue.length = 0
    const listener = vi.fn()
    subscribeBookStore(listener)

    patchAssetRecord('live', {
      contentHash:
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    })
    expect(listener).toHaveBeenCalledOnce()
    expect(rafQueue).toHaveLength(0)
  })

  it('flushes a coalesced hash-patch emit when import ends before rAF', () => {
    const rafQueue: FrameRequestCallback[] = []
    const cancel = vi.fn((id: number) => {
      rafQueue[id - 1] = () => undefined
    })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', cancel)
    enqueueGalleryAssets([
      {
        assetId: 'end',
        asset: {
          sourceRootId: 'root',
          relativePath: 'end.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])
    rafQueue.shift()?.(0)
    setImportRunning(true, 1)
    const listener = vi.fn()
    subscribeBookStore(listener)
    listener.mockClear()
    rafQueue.length = 0

    patchAssetRecord('end', {
      contentHash:
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    })
    expect(listener).not.toHaveBeenCalled()
    expect(rafQueue).toHaveLength(1)

    setImportRunning(false)
    expect(cancel).toHaveBeenCalled()
    // flushScheduledEmit emits once, then emitGallery emits again.
    expect(listener).toHaveBeenCalledTimes(2)
    listener.mockClear()
    rafQueue[0]?.(0)
    expect(listener).not.toHaveBeenCalled()
  })

  it('ending import without a pending coalesce emit does not cancel or double-emit', () => {
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)
    setImportRunning(true, 1)
    const listener = vi.fn()
    subscribeBookStore(listener)
    listener.mockClear()

    setImportRunning(false)
    expect(cancel).not.toHaveBeenCalled()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps a coalesced hash-patch emit pending when only import expectedCount changes', () => {
    const rafQueue: FrameRequestCallback[] = []
    const cancel = vi.fn((id: number) => {
      rafQueue[id - 1] = () => undefined
    })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', cancel)
    enqueueGalleryAssets([
      {
        assetId: 'keep',
        asset: {
          sourceRootId: 'root',
          relativePath: 'keep.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])
    rafQueue.shift()?.(0)
    setImportRunning(true, 1)
    const listener = vi.fn()
    subscribeBookStore(listener)
    listener.mockClear()
    rafQueue.length = 0

    patchAssetRecord('keep', {
      contentHash:
        'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    })
    expect(listener).not.toHaveBeenCalled()
    expect(rafQueue).toHaveLength(1)

    setImportRunning(true, 9)
    expect(cancel).not.toHaveBeenCalled()
    // emitGallery for the expectedCount change only — coalesce emit still pending.
    expect(listener).toHaveBeenCalledTimes(1)
    listener.mockClear()
    rafQueue.shift()?.(0)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('resetBookStore cancels a pending coalesce emit so a late rAF cannot notify', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    enqueueGalleryAssets([
      {
        assetId: 'rst',
        asset: {
          sourceRootId: 'root',
          relativePath: 'rst.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    ])

    const rafQueue: FrameRequestCallback[] = []
    const cancel = vi.fn((id: number) => {
      rafQueue[id - 1] = () => undefined
    })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    setImportRunning(true, 1)
    patchAssetRecord('rst', {
      contentHash:
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    })
    expect(rafQueue).toHaveLength(1)
    cancel.mockClear()
    clearTimeoutSpy.mockClear()

    resetBookStore()
    expect(cancel).toHaveBeenCalled()
    expect(clearTimeoutSpy).toHaveBeenCalled()
    const listener = vi.fn()
    subscribeBookStore(listener)
    // cancelAnimationFrame replaces the queued callback; invoking it must no-op.
    for (const cb of rafQueue) {
      cb(0)
    }
    expect(listener).not.toHaveBeenCalled()
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

describe('bookStore crop window follows real dims', () => {
  afterEach(() => {
    resetBookStore()
    vi.unstubAllGlobals()
  })

  function firstItem(): ResolvedItem | undefined {
    return getSpreadPaintSnapshot('spread-1')?.resolved.items[0]
  }

  it('recomputes the default-cover window when the real aspect arrives', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    resetBookStore({
      book: makePlacedTemplateBook('one-per-page', ['a']),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const before = firstItem()?.sourceCropRect
    setAssetSessionMeta('a', {
      name: 'a.jpg',
      correctedWidth: 4000,
      correctedHeight: 3000,
      orientation: 6,
      aspect: 4 / 3,
    })
    const item = firstItem()
    const after = item?.sourceCropRect
    expect(after).toBeDefined()
    expect(after).not.toEqual(before)
    const rect = item?.rectMm
    const frameAspect = (rect?.width ?? 1) / (rect?.height ?? 1)
    // Cover: the window has the frame's aspect in image space.
    expect(((after?.width ?? 0) * 4) / 3 / (after?.height ?? 1)).toBeCloseTo(
      frameAspect,
      5,
    )
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
