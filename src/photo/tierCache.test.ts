import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import { resetAssetPool, runImportBatch } from './assetPool'
import { resetAssetSources, retainAssetSource } from './assetSources'
import { mockWorkerSuccess } from './photo.test-helpers'
import {
  TIER_CACHE_CAPACITY,
  cancelTier,
  getTierUrl,
  putCachedTierForHash,
  requestTier,
  resetTierCache,
  seedWorkingPreview,
  dualThumbCacheKey,
  selectTierEncodeBuffers,
  shouldSeedThumbFromDual,
  subscribeTier,
} from './tierCache'
import { WORKING_PREVIEW_EDGE } from './imageTiers'
import { tierPresetId } from '../assets/derivedCache/presets'

const SAMPLE_HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

function jpeg(name: string): File {
  return new File([new Uint8Array([1])], name, { type: 'image/jpeg' })
}

describe('tierCache', () => {
  afterEach(() => {
    resetTierCache()
    resetAssetSources()
    resetAssetPool()
    setDerivedCacheForTests(undefined)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('publishes one object url per frame and revokes the oldest past capacity', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    let created = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      created += 1
      return `blob:tier-${String(created)}`
    })
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    mockWorkerSuccess({
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })

    const count = TIER_CACHE_CAPACITY + 1
    for (let index = 0; index < count; index += 1) {
      const assetId = `asset-${String(index)}`
      retainAssetSource(assetId, jpeg(`${assetId}.jpg`))
      requestTier(assetId, 320)
    }

    for (let step = 0; step < count + 5; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }

    expect(getTierUrl('asset-0', 320)).toBeUndefined()
    expect(getTierUrl(`asset-${String(count - 1)}`, 320)).toBe(
      `blob:tier-${String(count)}`,
    )
    expect(revoke).toHaveBeenCalled()
    expect(created).toBe(count)
  })

  it('does not enqueue a second job for the same asset and tier', async () => {
    let posts = 0
    class CountingWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }

      removeEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        this.listeners.get(type)?.delete(listener)
      }

      postMessage(data: { id: string }): void {
        posts += 1
        queueMicrotask(() => {
          const event = {
            data: {
              id: data.id,
              ok: true,
              name: 'a.jpg',
              mimeType: 'image/jpeg',
              byteLength: 1,
              width: 1,
              height: 1,
              correctedWidth: 1,
              correctedHeight: 1,
              orientation: 1,
              previewBuffer: new Uint8Array([1]).buffer,
              previewMimeType: 'image/jpeg',
            },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        })
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', CountingWorker)
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    retainAssetSource('a', jpeg('a.jpg'))
    requestTier('a', 640)
    requestTier('a', 640)
    await Promise.resolve()
    expect(posts).toBe(1)
  })

  it('publishes a tier requested again after the last subscriber cancels', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:again')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mockWorkerSuccess({
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    retainAssetSource('a', jpeg('a.jpg'))
    const unsubscribe = subscribeTier('a', 320, () => undefined)
    requestTier('a', 320)
    unsubscribe()
    requestTier('a', 320)

    for (let step = 0; step < 4; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }

    expect(getTierUrl('a', 320)).toBe('blob:again')
  })

  it('still finishes an import after a tier request is cancelled', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    class GatedWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }

      removeEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        this.listeners.get(type)?.delete(listener)
      }

      postMessage(data: { id: string; file: File }): void {
        void gate.then(() => {
          const event = {
            data: {
              id: data.id,
              ok: true,
              name: data.file.name,
              mimeType: 'image/jpeg',
              byteLength: 1,
              width: 1,
              height: 1,
              correctedWidth: 1,
              correctedHeight: 1,
              orientation: 1,
              previewBuffer: new Uint8Array([1]).buffer,
              previewMimeType: 'image/jpeg',
            },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        })
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 1,
    })
    vi.stubGlobal('Worker', GatedWorker)
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const imported = jpeg('imported.jpg')
    retainAssetSource('imp', imported)
    retainAssetSource('tier-asset', jpeg('tier.jpg'))
    const batch = runImportBatch([{ assetId: 'imp', file: imported }], {
      // Visible so JPEG is not lazy-deferred while we cancel a peer tier job.
      priority: 'visible',
    })
    await Promise.resolve()
    requestTier('tier-asset', 320)
    cancelTier('tier-asset', 320)
    release?.()
    const { results, errors } = await batch
    expect(errors).toHaveLength(0)
    expect(results.map((result) => result.assetId)).toEqual(['imp'])
    expect(getTierUrl('tier-asset', 320)).toBeUndefined()
  })

  it('sends cover when the session file asks for it', async () => {
    let cover = false
    class CoverWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }

      removeEventListener(): void {
        // no-op
      }

      postMessage(data: { id: string; cover?: boolean }): void {
        cover = data.cover === true
        queueMicrotask(() => {
          const event = {
            data: {
              id: data.id,
              ok: false,
              error: 'stop',
            },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        })
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', CoverWorker)
    retainAssetSource('a', jpeg('a.jpg'), { cover: true })
    requestTier('a', 320)
    await Promise.resolve()
    expect(cover).toBe(true)
    expect(getTierUrl('a', 320)).toBeUndefined()
  })

  it('reset notifies subscribers and aborts an in-flight tier', () => {
    vi.stubGlobal(
      'Worker',
      class {
        addEventListener(): void {
          // hang
        }
        removeEventListener(): void {
          // no-op
        }
        postMessage(): void {
          // no-op
        }
        terminate(): void {
          // no-op
        }
      },
    )
    retainAssetSource('a', jpeg('a.jpg'))
    const listener = vi.fn()
    subscribeTier('a', 320, listener)
    requestTier('a', 320)
    resetTierCache()
    expect(listener).toHaveBeenCalled()
    expect(getTierUrl('a', 320)).toBeUndefined()
  })

  it('putCachedTierForHash no-ops on empty hash', async () => {
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)
    await putCachedTierForHash('a', '')
    expect(put).not.toHaveBeenCalled()
  })

  it('putCachedTierForHash writes last encoded tier after hash arrives', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:late-hash')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    mockWorkerSuccess({
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([6]).buffer,
      previewMimeType: 'image/jpeg',
    })
    retainAssetSource('a', jpeg('a.jpg'))

    requestTier('a', 320)
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }
    expect(getTierUrl('a', 320)).toBe('blob:late-hash')

    await putCachedTierForHash('a', SAMPLE_HASH)
    const stored = await cache.get(SAMPLE_HASH, 'tier-320')
    expect(stored.ok).toBe(true)
    assert.equal(stored.ok, true)
    expect(new Uint8Array(stored.value.bytes)).toEqual(new Uint8Array([6]))
  })

  it('falls back to thumb preset when File is gone and tier miss', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb-fallback')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    await cache.put(SAMPLE_HASH, 'thumb', {
      bytes: new Uint8Array([4, 5]).buffer,
      mimeType: 'image/jpeg',
    })
    const worker = vi.fn()
    vi.stubGlobal('Worker', worker)

    requestTier('missing-file', 320, SAMPLE_HASH)
    for (let step = 0; step < 5; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }

    expect(getTierUrl('missing-file', 320)).toBe('blob:thumb-fallback')
    expect(worker).not.toHaveBeenCalled()
  })

  it('hydrates a hashed tier from DerivedCache without encoding', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:hydrated')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    await cache.put(SAMPLE_HASH, 'tier-320', {
      bytes: new Uint8Array([9]).buffer,
      mimeType: 'image/jpeg',
    })
    const worker = vi.fn()
    vi.stubGlobal('Worker', worker)

    requestTier('a', 320, SAMPLE_HASH)
    await Promise.resolve()
    await Promise.resolve()
    callbacks[0]?.(0)

    expect(getTierUrl('a', 320)).toBe('blob:hydrated')
    expect(worker).not.toHaveBeenCalled()
  })

  it('puts encoded tiers into DerivedCache when hashed', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:encoded')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    mockWorkerSuccess({
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([7]).buffer,
      previewMimeType: 'image/jpeg',
    })
    retainAssetSource('a', jpeg('a.jpg'))

    requestTier('a', 320, SAMPLE_HASH)
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }

    expect(getTierUrl('a', 320)).toBe('blob:encoded')
    const stored = await cache.get(SAMPLE_HASH, 'tier-320')
    expect(stored.ok).toBe(true)
    assert.equal(stored.ok, true)
    expect(new Uint8Array(stored.value.bytes)).toEqual(new Uint8Array([7]))
  })

  it('does not put into DerivedCache when unhashed', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:plain')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)
    mockWorkerSuccess({
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    retainAssetSource('a', jpeg('a.jpg'))

    requestTier('a', 320)
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }

    expect(getTierUrl('a', 320)).toBe('blob:plain')
    expect(put).not.toHaveBeenCalled()
  })

  it('selectTierEncodeBuffers prefers working fields only for dualTiers', () => {
    const previewBuffer = new Uint8Array([1]).buffer
    const workingBuffer = new Uint8Array([2]).buffer
    expect(
      selectTierEncodeBuffers(false, {
        previewBuffer,
        previewMimeType: 'image/jpeg',
        workingBuffer,
        workingMimeType: 'image/webp',
      }),
    ).toEqual({ buffer: previewBuffer, mimeType: 'image/jpeg' })
    expect(
      selectTierEncodeBuffers(true, {
        previewBuffer,
        previewMimeType: 'image/jpeg',
        workingBuffer,
        workingMimeType: 'image/webp',
      }),
    ).toEqual({ buffer: workingBuffer, mimeType: 'image/webp' })
    expect(
      selectTierEncodeBuffers(true, {
        previewBuffer,
        previewMimeType: 'image/jpeg',
      }),
    ).toEqual({ buffer: previewBuffer, mimeType: 'image/jpeg' })
  })

  it('shouldSeedThumbFromDual requires dualTiers, non-empty thumb, and cacheKey', () => {
    const preview = new Uint8Array([1]).buffer
    const empty = new ArrayBuffer(0)
    expect(
      shouldSeedThumbFromDual(true, { previewBuffer: preview }, SAMPLE_HASH),
    ).toBe(true)
    expect(
      dualThumbCacheKey(true, { previewBuffer: preview }, SAMPLE_HASH),
    ).toBe(SAMPLE_HASH)
    expect(
      shouldSeedThumbFromDual(false, { previewBuffer: preview }, SAMPLE_HASH),
    ).toBe(false)
    expect(
      shouldSeedThumbFromDual(true, { previewBuffer: empty }, SAMPLE_HASH),
    ).toBe(false)
    expect(
      dualThumbCacheKey(true, { previewBuffer: empty }, SAMPLE_HASH),
    ).toBeUndefined()
    expect(
      shouldSeedThumbFromDual(true, { previewBuffer: preview }, undefined),
    ).toBe(false)
    expect(shouldSeedThumbFromDual(true, { previewBuffer: preview }, '')).toBe(
      false,
    )
  })

  it('does not seed thumb from dual encode when previewBuffer is empty', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:empty-thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    class EmptyThumbWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }

      removeEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        this.listeners.get(type)?.delete(listener)
      }

      postMessage(data: { id: string }): void {
        queueMicrotask(() => {
          const event = {
            data: {
              id: data.id,
              ok: true,
              name: 'e.jpg',
              mimeType: 'image/jpeg',
              byteLength: 1,
              width: 2,
              height: 2,
              correctedWidth: 2,
              correctedHeight: 2,
              orientation: 1,
              previewBuffer: new ArrayBuffer(0),
              previewMimeType: 'image/webp',
              workingBuffer: new Uint8Array([8]).buffer,
              workingMimeType: 'image/webp',
            },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        })
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', EmptyThumbWorker)
    retainAssetSource('empty-thumb', jpeg('e.jpg'))
    requestTier('empty-thumb', WORKING_PREVIEW_EDGE, SAMPLE_HASH)
    for (let step = 0; step < 20; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }
    const thumb = await cache.get(SAMPLE_HASH, 'thumb')
    expect(thumb.ok).toBe(false)
    const working = await cache.get(
      SAMPLE_HASH,
      tierPresetId(WORKING_PREVIEW_EDGE),
    )
    expect(working.ok).toBe(true)
  })

  it('seedWorkingPreview stores WebP under the working preset', async () => {
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)
    const bytes = new Uint8Array([1, 2, 3]).buffer

    await seedWorkingPreview('a1', bytes, 'image/webp', SAMPLE_HASH)

    const got = await cache.get(SAMPLE_HASH, tierPresetId(WORKING_PREVIEW_EDGE))
    expect(got.ok).toBe(true)
    assert.equal(got.ok, true)
    expect(got.value.mimeType).toBe('image/webp')
    expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([1, 2, 3]))
    const putArgs = put.mock.calls[0]
    expect(putArgs?.[2]?.bytes).not.toBe(bytes)
    expect(putArgs?.[2]?.mimeType).toBe('image/webp')
    // Retained copy — mutating the source must not change the cache row.
    new Uint8Array(bytes)[0] = 99
    const again = await cache.get(
      SAMPLE_HASH,
      tierPresetId(WORKING_PREVIEW_EDGE),
    )
    assert.equal(again.ok, true)
    expect(new Uint8Array(again.value.bytes)[0]).toBe(1)
  })

  it('seedWorkingPreview keeps an independent lastTier buffer without a cacheKey', async () => {
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    const bytes = new Uint8Array([4, 5, 6]).buffer
    await seedWorkingPreview('solo', bytes, 'image/webp')
    new Uint8Array(bytes)[0] = 99
    await putCachedTierForHash('solo', SAMPLE_HASH)
    const got = await cache.get(SAMPLE_HASH, tierPresetId(WORKING_PREVIEW_EDGE))
    expect(got.ok).toBe(true)
    assert.equal(got.ok, true)
    expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([4, 5, 6]))
    expect(got.value.mimeType).toBe('image/webp')
  })

  it('seedWorkingPreview skips DerivedCache when cacheKey is missing or empty', async () => {
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)
    const bytes = new Uint8Array([4, 5]).buffer

    await expect(
      seedWorkingPreview('no-key', bytes, 'image/webp'),
    ).resolves.toBeUndefined()
    await expect(
      seedWorkingPreview('empty-key', bytes, 'image/webp', ''),
    ).resolves.toBeUndefined()
    expect(put).not.toHaveBeenCalled()
  })

  it('hydrates a legacy JPEG working-preview row without re-encode', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:legacy-jpeg')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    await cache.put(SAMPLE_HASH, tierPresetId(WORKING_PREVIEW_EDGE), {
      bytes: new Uint8Array([9, 8, 7]).buffer,
      mimeType: 'image/jpeg',
    })
    const worker = vi.fn()
    vi.stubGlobal('Worker', worker)

    requestTier('legacy', WORKING_PREVIEW_EDGE, SAMPLE_HASH)
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }

    expect(getTierUrl('legacy', WORKING_PREVIEW_EDGE)).toBe('blob:legacy-jpeg')
    expect(worker).not.toHaveBeenCalled()
  })

  it('encodes working preview with dualTiers and seeds thumb+working cache rows', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:working')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    const posts: { dualTiers?: boolean; maxEdge: number }[] = []
    class DualWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }

      removeEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        this.listeners.get(type)?.delete(listener)
      }

      postMessage(data: {
        id: string
        dualTiers?: boolean
        maxEdge: number
      }): void {
        const entry: { dualTiers?: boolean; maxEdge: number } = {
          maxEdge: data.maxEdge,
        }
        if (data.dualTiers !== undefined) {
          entry.dualTiers = data.dualTiers
        }
        posts.push(entry)
        queueMicrotask(() => {
          const event = {
            data: {
              id: data.id,
              ok: true,
              name: 'w.jpg',
              mimeType: 'image/jpeg',
              byteLength: 2,
              width: 4,
              height: 4,
              correctedWidth: 4,
              correctedHeight: 4,
              orientation: 1,
              previewBuffer: new Uint8Array([10]).buffer,
              previewMimeType: 'image/webp',
              workingBuffer: new Uint8Array([20, 21]).buffer,
              workingMimeType: 'image/webp',
            },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        })
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', DualWorker)
    retainAssetSource('work', jpeg('w.jpg'))

    requestTier('work', WORKING_PREVIEW_EDGE, SAMPLE_HASH)
    for (let step = 0; step < 20; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }

    expect(posts[0]?.dualTiers).toBe(true)
    expect(posts[0]?.maxEdge).toBe(WORKING_PREVIEW_EDGE)
    expect(getTierUrl('work', WORKING_PREVIEW_EDGE)).toBe('blob:working')
    const thumb = await cache.get(SAMPLE_HASH, 'thumb')
    expect(thumb.ok).toBe(true)
    assert.equal(thumb.ok, true)
    expect(new Uint8Array(thumb.value.bytes)).toEqual(new Uint8Array([10]))
    const working = await cache.get(
      SAMPLE_HASH,
      tierPresetId(WORKING_PREVIEW_EDGE),
    )
    expect(working.ok).toBe(true)
    assert.equal(working.ok, true)
    expect(new Uint8Array(working.value.bytes)).toEqual(
      new Uint8Array([20, 21]),
    )
    expect(working.value.mimeType).toBe('image/webp')
  })

  it('does not set dualTiers when requesting a non-working tier edge', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:320')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const posts: { dualTiers?: boolean; maxEdge: number }[] = []
    class CaptureWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        const set = this.listeners.get(type) ?? new Set()
        set.add(listener)
        this.listeners.set(type, set)
      }

      removeEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        this.listeners.get(type)?.delete(listener)
      }

      postMessage(data: {
        id: string
        dualTiers?: boolean
        maxEdge: number
      }): void {
        const entry: { dualTiers?: boolean; maxEdge: number } = {
          maxEdge: data.maxEdge,
        }
        if (data.dualTiers !== undefined) {
          entry.dualTiers = data.dualTiers
        }
        posts.push(entry)
        queueMicrotask(() => {
          const event = {
            data: {
              id: data.id,
              ok: true,
              name: 't.jpg',
              mimeType: 'image/jpeg',
              byteLength: 1,
              width: 2,
              height: 2,
              correctedWidth: 2,
              correctedHeight: 2,
              orientation: 1,
              previewBuffer: new Uint8Array([1]).buffer,
              previewMimeType: 'image/jpeg',
            },
          } as MessageEvent
          for (const listener of this.listeners.get('message') ?? []) {
            listener(event)
          }
        })
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', CaptureWorker)
    retainAssetSource('t320', jpeg('t.jpg'))
    requestTier('t320', 320)
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }
    expect(posts[0]?.maxEdge).toBe(320)
    expect(posts[0]?.dualTiers).toBeUndefined()
  })

  it('falls back to previewBuffer when dualTiers response omits workingBuffer', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    let blobType = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobType = (blob as Blob).type
      return 'blob:fallback'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mockWorkerSuccess({
      ok: true,
      name: 'f.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([7]).buffer,
      previewMimeType: 'image/jpeg',
    })
    retainAssetSource('fb', jpeg('f.jpg'))

    requestTier('fb', WORKING_PREVIEW_EDGE)
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }

    expect(getTierUrl('fb', WORKING_PREVIEW_EDGE)).toBe('blob:fallback')
    expect(blobType).toBe('image/jpeg')
  })
})
