import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryAssetSource,
  createMemoryDerivedCache,
  setDerivedCacheForTests,
  type DerivedCache,
} from '../assets'
import {
  getDeferredLazyAssetIds,
  getEffectiveDecodeSlotLimitForTests,
  getQueuedDecodeAssetIds,
  processAsset,
  resetAssetPool,
  setFilmstripVisibleAssetIds,
} from '../photo/assetPool'
import {
  getAssetSource,
  resetAssetSources,
  retainAssetSource,
} from '../photo/assetSources'
import { THUMB_MAX_EDGE } from '../photo/photoEdges'
import type {
  PhotoWorkerFailure,
  PhotoWorkerRequest,
  PhotoWorkerSuccess,
} from '../photo/processPhoto'
import {
  clearRegisteredAssetSources,
  registerAssetSource,
} from './assetSourceRegistry'
import {
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'
import { ensureThumb, getThumbUrl, resetThumbCache } from './thumbCache'

const KEY = 'a'.repeat(64)
const PREVIEW = [7, 8, 9]

interface Posted {
  worker: HeldWorker
  request: PhotoWorkerRequest
}

const posted: Posted[] = []
const backgroundTasks: (() => void)[] = []

/** Decode worker double: holds requests until the test answers them. */
class HeldWorker {
  private listeners = new Set<(event: MessageEvent) => void>()

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.add(listener)
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.delete(listener)
    }
  }

  postMessage(request: PhotoWorkerRequest): void {
    posted.push({ worker: this, request })
  }

  fail(request: PhotoWorkerRequest): void {
    const data: PhotoWorkerFailure = {
      id: request.id,
      ok: false,
      error: 'decode failed',
    }
    for (const listener of [...this.listeners]) {
      listener({ data } as MessageEvent)
    }
  }

  answer(request: PhotoWorkerRequest): void {
    const data: PhotoWorkerSuccess = {
      id: request.id,
      ok: true,
      name: request.file.name,
      mimeType: request.file.type,
      byteLength: request.file.size,
      width: 40,
      height: 20,
      correctedWidth: 20,
      correctedHeight: 40,
      orientation: 6,
      previewBuffer: new Uint8Array(PREVIEW).buffer,
      previewMimeType: 'image/webp',
    }
    for (const listener of [...this.listeners]) {
      listener({ data } as MessageEvent)
    }
  }

  terminate(): void {
    this.listeners.clear()
  }
}

function answer(index: number): void {
  const entry = posted[index]
  assert.ok(entry)
  entry.worker.answer(entry.request)
}

function jpeg(name: string): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, {
    type: 'image/jpeg',
  })
}

function png(name: string): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, {
    type: 'image/png',
  })
}

function withAssets(
  assets: Record<string, { sourceRootId: string; relativePath?: string }>,
): void {
  resetBookStore({
    book: {
      ...getBookStoreSnapshot().book,
      gallery: Object.keys(assets),
      assets,
    },
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

async function flush(): Promise<void> {
  for (let step = 0; step < 20; step += 1) {
    await Promise.resolve()
  }
}

describe('ensureThumb DerivedCache miss decode', () => {
  let cache: DerivedCache

  beforeEach(() => {
    posted.length = 0
    backgroundTasks.length = 0
    resetBookStore()
    vi.stubGlobal('Worker', HeldWorker)
    // Background lane drains only when the test runs these tasks.
    vi.stubGlobal('scheduler', {
      postTask: (run: () => void) => {
        backgroundTasks.push(run)
        return Promise.resolve()
      },
    })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decoded')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
  })

  afterEach(() => {
    resetThumbCache()
    resetAssetPool()
    resetAssetSources()
    clearRegisteredAssetSources()
    resetPendingHashesForTests()
    resetBookStore()
    setDerivedCacheForTests(undefined)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('decodes thumb320 from the retained File, publishes, caches and restores aspect', async () => {
    setFilmstripVisibleAssetIds(['a1'])
    retainAssetSource('a1', jpeg('a1.jpg'))

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(posted).toHaveLength(1)
    })
    expect(posted[0]?.request.maxEdge).toBe(THUMB_MAX_EDGE)
    expect(posted[0]?.request.dualTiers).toBeUndefined()
    expect(getThumbUrl('a1')).toBeUndefined()

    answer(0)
    await vi.waitFor(() => {
      expect(getThumbUrl('a1')).toBe('blob:decoded')
    })
    expect(getAssetAspectSnapshot('a1')).toBe(0.5)
    await awaitPendingHashes()
    const got = await cache.get(KEY, 'thumb')
    assert.equal(got.ok, true)
    expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array(PREVIEW))
    expect(got.value.mimeType).toBe('image/webp')
  })

  it('resolves the File through the registered AssetSource before restore verify', async () => {
    withAssets({ a1: { sourceRootId: 'root', relativePath: 'trip/a1.jpg' } })
    const source = createMemoryAssetSource()
    source.seedFile('root', 'trip/a1.jpg', new Uint8Array([1, 2]).buffer, 5)
    registerAssetSource('root', source)
    setFilmstripVisibleAssetIds(['a1'])

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(posted).toHaveLength(1)
    })
    expect(posted[0]?.request.file.name).toBe('a1.jpg')
    expect(getAssetSource('a1')).toBe(posted[0]?.request.file)

    answer(0)
    await vi.waitFor(() => {
      expect(getThumbUrl('a1')).toBe('blob:decoded')
    })
  })

  it('skips the decode when no File can be resolved', async () => {
    withAssets({
      unregistered: { sourceRootId: 'gone', relativePath: 'x.jpg' },
      missing: { sourceRootId: 'root', relativePath: 'missing.jpg' },
    })
    registerAssetSource('root', createMemoryAssetSource())
    setFilmstripVisibleAssetIds(['unregistered', 'missing', 'orphan'])
    const get = vi.spyOn(cache, 'get')

    ensureThumb('unregistered', KEY)
    ensureThumb('missing', 'b'.repeat(64))
    ensureThumb('orphan', 'c'.repeat(64))
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledTimes(3)
    })
    await flush()
    expect(posted).toHaveLength(0)
    expect(getAssetSource('missing')).toBeUndefined()
    expect(getThumbUrl('unregistered')).toBeUndefined()
  })

  it('never asks the AssetSource for an asset without a relative path', async () => {
    withAssets({ a1: { sourceRootId: 'root' } })
    const source = createMemoryAssetSource()
    const resolve = vi
      .spyOn(source, 'resolveFile')
      .mockResolvedValue({ ok: true, value: jpeg('any.jpg') })
    registerAssetSource('root', source)
    setFilmstripVisibleAssetIds(['a1'])
    const get = vi.spyOn(cache, 'get')

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledTimes(1)
    })
    await flush()
    expect(resolve).not.toHaveBeenCalled()
    expect(posted).toHaveLength(0)
  })

  it('does not replace an import decode deferred for the same JPEG', async () => {
    const file = jpeg('a1.jpg')
    retainAssetSource('a1', file)
    let importedName: string | undefined
    void processAsset({ assetId: 'a1', file }).then((result) => {
      importedName = result.name
    })
    expect(getDeferredLazyAssetIds()).toEqual(['a1'])
    const get = vi.spyOn(cache, 'get')

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledTimes(1)
    })
    await flush()

    setFilmstripVisibleAssetIds(['a1'])
    expect(posted).toHaveLength(1)
    answer(0)
    await vi.waitFor(() => {
      expect(importedName).toBe('a1.jpg')
    })
  })

  it('keeps an off-now JPEG deferred until it enters the now set', async () => {
    retainAssetSource('a1', jpeg('a1.jpg'))

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(getDeferredLazyAssetIds()).toEqual(['a1'])
    })
    expect(posted).toHaveLength(0)

    setFilmstripVisibleAssetIds(['a1'])
    expect(posted).toHaveLength(1)
    answer(0)
    await vi.waitFor(() => {
      expect(getThumbUrl('a1')).toBe('blob:decoded')
    })
  })

  it('queues an off-now PNG on the idle background lane only', async () => {
    retainAssetSource('p1', png('p1.png'))

    ensureThumb('p1', KEY)
    await vi.waitFor(() => {
      expect(getQueuedDecodeAssetIds()).toEqual(['p1'])
    })
    expect(posted).toHaveLength(0)

    for (const run of backgroundTasks.splice(0)) {
      run()
    }
    expect(posted).toHaveLength(1)
  })

  it('queues the now-set miss ahead of queued now-lane prefetch work', async () => {
    const limit = getEffectiveDecodeSlotLimitForTests()
    const busy = Array.from({ length: limit }, (_, i) => `busy-${String(i)}`)
    setFilmstripVisibleAssetIds([...busy, 'import', 'a1'])
    for (const id of busy) {
      void processAsset({ assetId: id, file: png(`${id}.png`) })
    }
    void processAsset({ assetId: 'import', file: png('import.png') })
    expect(posted).toHaveLength(limit)
    retainAssetSource('a1', png('a1.png'))

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(getQueuedDecodeAssetIds()).toContain('a1')
    })
    answer(0)
    await vi.waitFor(() => {
      expect(posted).toHaveLength(limit + 1)
    })
    expect(posted[limit]?.request.file.name).toBe('a1.png')
  })

  it('leaves an asset with a pending import thumb decode to that job', async () => {
    setFilmstripVisibleAssetIds(['a1', 'tier'])
    const file = png('a1.png')
    retainAssetSource('a1', file)
    const imported = processAsset({ assetId: 'a1', file })
    expect(posted).toHaveLength(1)
    const get = vi.spyOn(cache, 'get')

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledTimes(1)
    })
    await flush()
    expect(posted).toHaveLength(1)
    answer(0)
    await expect(imported).resolves.toMatchObject({ assetId: 'a1' })

    // A working-tier job (1280) does not block the thumb320 miss decode.
    const tierFile = png('tier.png')
    retainAssetSource('tier', tierFile)
    void processAsset({
      assetId: 'tier',
      file: tierFile,
      priority: 'zoom',
      maxEdge: 1280,
    })
    expect(posted).toHaveLength(2)
    ensureThumb('tier', 'd'.repeat(64))
    await vi.waitFor(() => {
      expect(posted).toHaveLength(3)
    })
    expect(posted[2]?.request.maxEdge).toBe(THUMB_MAX_EDGE)
  })

  it('a failed decode publishes nothing and a later mount retries', async () => {
    setFilmstripVisibleAssetIds(['a1'])
    retainAssetSource('a1', jpeg('a1.jpg'))

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(posted).toHaveLength(1)
    })
    const first = posted[0]
    assert.ok(first)
    first.worker.fail(first.request)
    await flush()
    expect(getThumbUrl('a1')).toBeUndefined()

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(posted).toHaveLength(2)
    })
  })

  it('a tile that leaves now mid-decode and remounts publishes its own decode', async () => {
    setFilmstripVisibleAssetIds(['a1'])
    retainAssetSource('a1', jpeg('a1.jpg'))

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(posted).toHaveLength(1)
    })
    setFilmstripVisibleAssetIds([])
    await flush()
    setFilmstripVisibleAssetIds(['a1'])
    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(posted).toHaveLength(2)
    })

    answer(1)
    await vi.waitFor(() => {
      expect(getThumbUrl('a1')).toBe('blob:decoded')
    })
    expect(posted).toHaveLength(2)
  })

  it('reset aborts an in-flight miss decode without publishing', async () => {
    setFilmstripVisibleAssetIds(['a1'])
    retainAssetSource('a1', jpeg('a1.jpg'))

    ensureThumb('a1', KEY)
    await vi.waitFor(() => {
      expect(posted).toHaveLength(1)
    })
    resetThumbCache()
    answer(0)
    await flush()
    expect(getThumbUrl('a1')).toBeUndefined()
  })
})
