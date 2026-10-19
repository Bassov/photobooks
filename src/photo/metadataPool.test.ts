import { afterEach, describe, expect, it, vi } from 'vitest'

import { hashContent } from '../assets/hash'
import { resetAssetPool, warmAssetPool } from './assetPool'
import {
  enqueueMetadata,
  hasPendingMetadataJobs,
  metadataWorkerCount,
  resetMetadataPool,
} from './metadataPool'
import { resetPoolCoordination } from './poolCoordination'

function installWorker(
  handler: (
    data: {
      id: string
      kind?: string
      includeGps?: boolean
      mimeType?: string
      buffer?: ArrayBuffer
    },
    emit: (event: MessageEvent | ErrorEvent) => void,
  ) => void,
): void {
  class TestWorker {
    private listeners = new Map<string, Set<(event: Event) => void>>()

    addEventListener(type: string, listener: (event: Event) => void): void {
      const set = this.listeners.get(type) ?? new Set()
      set.add(listener)
      this.listeners.set(type, set)
    }

    removeEventListener(type: string, listener: (event: Event) => void): void {
      this.listeners.get(type)?.delete(listener)
    }

    postMessage(data: {
      id: string
      kind?: string
      includeGps?: boolean
      mimeType?: string
      buffer?: ArrayBuffer
    }): void {
      handler(data, (event) => {
        const type = event.type === 'error' ? 'error' : 'message'
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event)
        }
      })
    }

    terminate(): void {
      this.listeners.clear()
    }
  }
  vi.stubGlobal('Worker', TestWorker)
}

describe('metadataWorkerCount', () => {
  it('defaults to 1 worker when concurrency is missing or non-positive', () => {
    expect(metadataWorkerCount(undefined)).toBe(1)
    expect(metadataWorkerCount(0)).toBe(1)
    expect(metadataWorkerCount(-1)).toBe(1)
  })

  it('uses cores-1 when concurrency is positive', () => {
    expect(metadataWorkerCount(1)).toBe(1)
    expect(metadataWorkerCount(4)).toBe(3)
  })
})

describe('metadataPool', () => {
  afterEach(() => {
    resetMetadataPool()
    resetAssetPool()
    resetPoolCoordination()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('extracts metadata through the photo worker and passes includeGps', async () => {
    const posts: unknown[] = []
    installWorker((data, emit) => {
      posts.push(data)
      if (data.kind === 'metadata') {
        emit({
          data: {
            id: data.id,
            ok: true,
            metadata: {
              orientation: 1,
              mime: data.mimeType,
              ...(data.includeGps === true
                ? { meta: { gps: { lat: 1, lon: 2 } } }
                : {}),
            },
          },
        } as MessageEvent)
        return
      }
      emit({
        data: {
          id: data.id,
          ok: true,
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      } as MessageEvent)
    })

    const withGps = await enqueueMetadata({
      buffer: new ArrayBuffer(2),
      mimeType: 'image/jpeg',
      includeGps: true,
    })
    expect(withGps.meta?.gps).toEqual({ lat: 1, lon: 2 })
    expect(withGps.mime).toBe('image/jpeg')
    expect(
      posts.some(
        (p) =>
          (p as { kind?: string; includeGps?: boolean }).kind === 'metadata' &&
          (p as { includeGps?: boolean }).includeGps === true,
      ),
    ).toBe(true)

    const withoutGps = await enqueueMetadata({
      buffer: new ArrayBuffer(2),
    })
    expect(withoutGps.meta?.gps).toBeUndefined()
    expect(
      (
        posts.find(
          (p) =>
            (p as { kind?: string; mimeType?: string }).kind === 'metadata' &&
            (p as { mimeType?: string }).mimeType === undefined,
        ) as { includeGps?: boolean } | undefined
      )?.includeGps,
    ).toBe(false)
  })

  it('runs metadata before hashContent when both are queued', async () => {
    const order: string[] = []
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    installWorker((data, emit) => {
      const label = data.kind === 'metadata' ? 'metadata' : 'hash'
      order.push(label)
      void gate.then(() => {
        emit({
          data:
            data.kind === 'metadata'
              ? { id: data.id, ok: true, metadata: { orientation: 1 } }
              : {
                  id: data.id,
                  ok: true,
                  hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                },
        } as MessageEvent)
      })
    })
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 1,
    })
    warmAssetPool()

    const metadata = enqueueMetadata({ buffer: new ArrayBuffer(1) })
    const hash = hashContent(new ArrayBuffer(0))
    expect(order).toEqual(['metadata'])
    expect(hasPendingMetadataJobs()).toBe(true)
    release?.()
    await Promise.all([metadata, hash])
    expect(order).toEqual(['metadata', 'hash'])
    expect(hasPendingMetadataJobs()).toBe(false)
  })

  it('rejects when the metadata worker returns ok:false', async () => {
    installWorker((data, emit) => {
      emit({
        data: { id: data.id, ok: false, error: 'nope' },
      } as MessageEvent)
    })

    await expect(
      enqueueMetadata({ buffer: new ArrayBuffer(1) }),
    ).rejects.toThrow('nope')
  })

  it('rejects on worker error events with fallback message', async () => {
    installWorker((_data, emit) => {
      emit(new ErrorEvent('error', { message: 'worker down' }))
    })

    await expect(
      enqueueMetadata({ buffer: new ArrayBuffer(1) }),
    ).rejects.toThrow('worker down')

    resetMetadataPool()
    installWorker((_data, emit) => {
      emit(new ErrorEvent('error', { message: '' }))
    })
    await expect(
      enqueueMetadata({ buffer: new ArrayBuffer(1) }),
    ).rejects.toThrow('Metadata worker failed')
  })

  it('ignores messages for other request ids then settles the matching one', async () => {
    installWorker((data, emit) => {
      emit({
        data: { id: 'other', ok: true, metadata: { orientation: 9 } },
      } as MessageEvent)
      emit({
        data: { id: data.id, ok: true, metadata: { orientation: 3 } },
      } as MessageEvent)
    })

    await expect(
      enqueueMetadata({ buffer: new ArrayBuffer(1) }),
    ).resolves.toEqual({ orientation: 3 })
    expect(hasPendingMetadataJobs()).toBe(false)
  })

  it('ignores a second settle after the first success (held listener copy)', async () => {
    class DoubleWorker {
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
        const listeners = [...(this.listeners.get('message') ?? [])]
        const ok = {
          data: { id: data.id, ok: true, metadata: { orientation: 3 } },
        } as MessageEvent
        for (const listener of listeners) {
          listener(ok)
          // Second invoke after cleanup removed the map entry — hits settled guard.
          listener({
            data: { id: data.id, ok: true, metadata: { orientation: 99 } },
          } as MessageEvent)
        }
      }

      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', DoubleWorker)

    await expect(
      enqueueMetadata({ buffer: new ArrayBuffer(1) }),
    ).resolves.toEqual({ orientation: 3 })
    expect(hasPendingMetadataJobs()).toBe(false)
  })

  it('reuses worker slots across sequential jobs', async () => {
    let workers = 0
    class CountingWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()
      constructor() {
        workers += 1
      }
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
        const event = {
          data: { id: data.id, ok: true, metadata: { orientation: 1 } },
        } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event)
        }
      }
      terminate(): void {
        this.listeners.clear()
      }
    }
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 2,
    })
    vi.stubGlobal('Worker', CountingWorker)

    await enqueueMetadata({ buffer: new ArrayBuffer(1) })
    await enqueueMetadata({ buffer: new ArrayBuffer(1) })
    expect(workers).toBe(1)
  })

  it('queues behind busy slots then drains when a slot frees', async () => {
    const started: string[] = []
    const releasers: (() => void)[] = []
    installWorker((data, emit) => {
      started.push(data.id)
      void new Promise<void>((resolve) => {
        releasers.push(resolve)
      }).then(() => {
        emit({
          data: { id: data.id, ok: true, metadata: { orientation: 1 } },
        } as MessageEvent)
      })
    })
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 3,
    })

    const first = enqueueMetadata({ buffer: new ArrayBuffer(1) })
    const second = enqueueMetadata({ buffer: new ArrayBuffer(1) })
    const third = enqueueMetadata({ buffer: new ArrayBuffer(1) })
    expect(started).toHaveLength(2)
    expect(hasPendingMetadataJobs()).toBe(true)

    releasers[0]?.()
    await first
    expect(started).toHaveLength(3)

    releasers[1]?.()
    releasers[2]?.()
    await Promise.all([second, third])
    expect(hasPendingMetadataJobs()).toBe(false)
  })

  it('rejects in-flight and queued jobs on resetMetadataPool', async () => {
    installWorker(() => {
      // hang — never responds so jobs stay in-flight / queued
    })
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 2,
    })
    const a = enqueueMetadata({ buffer: new ArrayBuffer(1) })
    const b = enqueueMetadata({ buffer: new ArrayBuffer(1) })
    const c = enqueueMetadata({ buffer: new ArrayBuffer(1) })
    const settled = Promise.allSettled([a, b, c])
    resetMetadataPool()
    const results = await settled
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(
      results.every(
        (r) =>
          r.status === 'rejected' &&
          r.reason instanceof Error &&
          r.reason.message === 'Metadata pool reset',
      ),
    ).toBe(true)
    expect(hasPendingMetadataJobs()).toBe(false)
  })

  it('sizes the pool from hardwareConcurrency including non-positive defaults', async () => {
    let workers = 0
    class CountingWorker {
      private listeners = new Map<string, Set<(event: MessageEvent) => void>>()
      constructor() {
        workers += 1
      }
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
      postMessage(data: { id: string }): void {
        const event = {
          data: { id: data.id, ok: true, metadata: { orientation: 1 } },
        } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event)
        }
      }
      terminate(): void {
        this.listeners.clear()
      }
    }
    vi.stubGlobal('Worker', CountingWorker)

    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 0,
    })
    await enqueueMetadata({ buffer: new ArrayBuffer(1) })
    expect(workers).toBe(1)

    resetMetadataPool()
    workers = 0
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 5,
    })
    await enqueueMetadata({ buffer: new ArrayBuffer(1) })
    expect(workers).toBe(4)
  })
})
