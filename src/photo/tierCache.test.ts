import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool, runImportBatch } from './assetPool'
import { resetAssetSources, retainAssetSource } from './assetSources'
import { mockWorkerSuccess } from './photo.test-helpers'
import {
  TIER_CACHE_CAPACITY,
  cancelTier,
  getTierUrl,
  requestTier,
  resetTierCache,
  subscribeTier,
} from './tierCache'

function jpeg(name: string): File {
  return new File([new Uint8Array([1])], name, { type: 'image/jpeg' })
}

describe('tierCache', () => {
  afterEach(() => {
    resetTierCache()
    resetAssetSources()
    resetAssetPool()
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
      priority: 'prefetch',
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
})
