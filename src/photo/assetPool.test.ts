import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhotoWorkerRequest } from './processPhoto'
import {
  abortDecodeForTests,
  assignWorkingFields,
  bookUsedIdsUnchanged,
  DECODE_POOL_CAP,
  decodeWorkerCount,
  DECODE_POOL_CAP_IMPORT,
  getDecodeImportActiveForTests,
  getDeferredHeicAssetIds,
  getDeferredLazyAssetIds,
  getEffectiveDecodeSlotLimitForTests,
  getPendingRetryAssetIdsForTests,
  getQueuedDecodeAssetIds,
  getVisibleAssetIds,
  noteDecodePressure,
  processAsset,
  resetAssetPool,
  runImportBatch,
  type AssetProcessResult,
  type ImportFileError,
  noteDecodeScrollActivity,
  setBookUsedAssetIds,
  setDecodeBackgroundIdleForTests,
  setDecodeImportActive,
  setFilmstripVisibleAssetIds,
  setSpreadVisibleAssetIds,
  setVisibleAssetIds,
  shouldDeferHeicDecode,
  shouldDeferLazyDecode,
  warmAssetPool,
} from './assetPool'
import {
  mockWorkerFailure,
  mockWorkerRuntimeError,
  mockWorkerSuccess,
} from './photo.test-helpers'
import { PREVIEW_MAX_EDGE } from './photoEdges'

function hangWorker(): void {
  class HangWorker {
    addEventListener(): void {
      // hang — never responds
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
  }
  vi.stubGlobal('Worker', HangWorker)
}

describe('assetPool', () => {
  it('caps idle decode workers at DECODE_POOL_CAP_IDLE', () => {
    expect(decodeWorkerCount(undefined)).toBe(1)
    expect(decodeWorkerCount(0)).toBe(1)
    expect(decodeWorkerCount(-1)).toBe(1)
    expect(decodeWorkerCount(1)).toBe(1)
    expect(decodeWorkerCount(5)).toBe(4)
    expect(decodeWorkerCount(32)).toBe(4)
    expect(decodeWorkerCount(32, { importActive: true })).toBe(DECODE_POOL_CAP)
  })

  afterEach(() => {
    resetAssetPool()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('getVisibleAssetIds snapshots filmstrip ∪ spread preference', () => {
    setFilmstripVisibleAssetIds(['film-a'])
    setSpreadVisibleAssetIds('spread-1', ['spread-b'])
    expect(getVisibleAssetIds().slice().sort()).toEqual(['film-a', 'spread-b'])
    resetAssetPool()
    expect(getVisibleAssetIds()).toEqual([])
  })

  it('processes an asset through the worker pool', async () => {
    const previewBuffer = new Uint8Array([1, 2, 3]).buffer
    mockWorkerSuccess({
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 3,
      width: 10,
      height: 10,
      correctedWidth: 10,
      correctedHeight: 10,
      orientation: 1,
      previewBuffer,
      previewMimeType: 'image/jpeg',
    })
    warmAssetPool()
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const result = await processAsset({
      assetId: 'a1',
      file,
      priority: 'visible',
    })
    expect(result.assetId).toBe('a1')
    expect(result.correctedWidth).toBe(10)
    expect(result.previewMimeType).toBe('image/jpeg')
    expect(Object.hasOwn(result, 'workingBuffer')).toBe(false)
    expect(Object.hasOwn(result, 'workingMimeType')).toBe(false)
  })

  it('assignWorkingFields copies only defined dual-tier response fields', () => {
    const base: AssetProcessResult = {
      assetId: 'x',
      name: 'x.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer: new ArrayBuffer(1),
      previewMimeType: 'image/webp',
    }
    const none: AssetProcessResult = { ...base }
    assignWorkingFields(none, {})
    expect(Object.hasOwn(none, 'workingBuffer')).toBe(false)
    expect(Object.hasOwn(none, 'workingMimeType')).toBe(false)

    const both: AssetProcessResult = { ...base }
    const workingBuffer = new Uint8Array([9]).buffer
    assignWorkingFields(both, {
      workingBuffer,
      workingMimeType: 'image/webp',
    })
    expect(both.workingBuffer).toBe(workingBuffer)
    expect(both.workingMimeType).toBe('image/webp')

    const bufOnly: AssetProcessResult = { ...base }
    assignWorkingFields(bufOnly, { workingBuffer })
    expect(bufOnly.workingBuffer).toBe(workingBuffer)
    expect(Object.hasOwn(bufOnly, 'workingMimeType')).toBe(false)

    const mimeOnly: AssetProcessResult = { ...base }
    assignWorkingFields(mimeOnly, { workingMimeType: 'image/webp' })
    expect(Object.hasOwn(mimeOnly, 'workingBuffer')).toBe(false)
    expect(mimeOnly.workingMimeType).toBe('image/webp')

    const withSource: AssetProcessResult = { ...base }
    const sourceBuffer = new Uint8Array([7]).buffer
    assignWorkingFields(withSource, { sourceBuffer })
    expect(withSource.sourceBuffer).toBe(sourceBuffer)
  })

  it('forwards dualTiers and working buffers from the worker response', async () => {
    const posts: PhotoWorkerRequest[] = []
    class CapturingWorker {
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

      postMessage(data: PhotoWorkerRequest): void {
        posts.push(data)
        queueMicrotask(() => {
          const event = {
            data: {
              id: data.id,
              ok: true,
              name: 'dual.jpg',
              mimeType: 'image/jpeg',
              byteLength: 2,
              width: 8,
              height: 8,
              correctedWidth: 8,
              correctedHeight: 8,
              orientation: 1,
              previewBuffer: new Uint8Array([1]).buffer,
              previewMimeType: 'image/webp',
              workingBuffer: new Uint8Array([2, 3]).buffer,
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
    vi.stubGlobal('Worker', CapturingWorker)
    warmAssetPool()
    const file = new File([new Uint8Array([1])], 'dual.jpg', {
      type: 'image/jpeg',
    })
    const result = await processAsset({
      priority: 'visible',
      assetId: 'dual',
      file,
      dualTiers: true,
    })
    expect(posts[0]?.dualTiers).toBe(true)
    expect(Object.hasOwn(result, 'workingBuffer')).toBe(true)
    expect(Object.hasOwn(result, 'workingMimeType')).toBe(true)
    expect(new Uint8Array(result.workingBuffer ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array([2, 3]),
    )
    expect(result.workingMimeType).toBe('image/webp')
  })

  it('omits dualTiers on the worker request unless requested', async () => {
    const posts: PhotoWorkerRequest[] = []
    class CapturingWorker {
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

      postMessage(data: PhotoWorkerRequest): void {
        posts.push(data)
        queueMicrotask(() => {
          const event = {
            data: {
              id: data.id,
              ok: true,
              name: 'plain.jpg',
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
    vi.stubGlobal('Worker', CapturingWorker)
    warmAssetPool()
    await processAsset({
      priority: 'visible',
      assetId: 'plain',
      file: new File([new Uint8Array([1])], 'plain.jpg', {
        type: 'image/jpeg',
      }),
    })
    expect(posts[0]?.dualTiers).toBeUndefined()
  })

  it('rejects immediately when the provided signal is already aborted', async () => {
    mockWorkerSuccess({
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
    })
    const controller = new AbortController()
    controller.abort()
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    await expect(
      processAsset({
        priority: 'visible',
        assetId: 'a1',
        file,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects when the worker posts a runtime error event', async () => {
    mockWorkerRuntimeError('worker crashed')
    warmAssetPool()
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    await expect(
      processAsset({
        priority: 'visible',
        assetId: 'a1',
        file,
      }),
    ).rejects.toThrow(/worker crashed|Photo worker failed/)
  })

  it('continues a batch when one job fails', async () => {
    mockWorkerFailure('boom')
    const files = [
      {
        assetId: 'bad',
        file: new File([new Uint8Array([1])], 'bad.jpg', {
          type: 'image/jpeg',
        }),
      },
    ]
    const progress: { completed: number; errors: number }[] = []
    const onError = vi.fn()
    const { results, errors } = await runImportBatch(files, {
      priority: 'visible',
      onProgress: (state) => {
        progress.push({
          completed: state.completed,
          errors: state.errors.length,
        })
      },
      onError,
    })
    expect(results).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toBe('boom')
    expect(errors[0]?.assetId).toBe('bad')
    expect(onError).toHaveBeenCalledWith(
      'bad',
      expect.objectContaining({
        name: 'bad.jpg',
        message: 'boom',
        reason: 'decode-failed',
        assetId: 'bad',
      }),
    )
    expect(progress.at(-1)?.completed).toBe(1)
  })

  it('imports a successful batch and invokes onResult', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const previewBuffer = new Uint8Array([1]).buffer
    mockWorkerSuccess({
      ok: true,
      name: 'ok.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 8,
      height: 8,
      correctedWidth: 8,
      correctedHeight: 8,
      orientation: 1,
      previewBuffer,
      previewMimeType: 'image/jpeg',
    })
    const onResult = vi.fn()
    const { results, errors } = await runImportBatch(
      [
        {
          assetId: 'ok',
          file: new File([new Uint8Array([1])], 'ok.jpg', {
            type: 'image/jpeg',
          }),
        },
      ],
      { onResult, priority: 'visible', maxEdge: 64 },
    )
    expect(errors).toHaveLength(0)
    expect(results).toHaveLength(1)
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'ok', correctedWidth: 8 }),
    )
  })

  it('skips abort errors inside a batch without recording them', async () => {
    hangWorker()
    const pending = runImportBatch(
      [
        {
          assetId: 'gone',
          file: new File([new Uint8Array([1])], 'gone.jpg', {
            type: 'image/jpeg',
          }),
        },
      ],
      { priority: 'prefetch' },
    )
    await Promise.resolve()
    resetAssetPool()
    const { results, errors } = await pending
    expect(results).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('defers never-visible JPEG import jobs; still completes off-screen PNG', async () => {
    const previewBuffer = new Uint8Array([9]).buffer
    mockWorkerSuccess({
      ok: true,
      name: 'photo.png',
      mimeType: 'image/png',
      byteLength: 1,
      width: 4,
      height: 4,
      correctedWidth: 4,
      correctedHeight: 4,
      orientation: 1,
      previewBuffer,
      previewMimeType: 'image/webp',
    })
    warmAssetPool()
    setVisibleAssetIds(['visible-only'])
    const pending = runImportBatch(
      [
        {
          assetId: 'offscreen-jpeg',
          file: new File([new Uint8Array([1])], 'a.jpg', {
            type: 'image/jpeg',
          }),
        },
        {
          assetId: 'offscreen-png',
          file: new File([new Uint8Array([2])], 'b.png', {
            type: 'image/png',
          }),
        },
      ],
      { priority: 'prefetch', maxEdge: 64 },
    )
    const { results, errors } = await pending
    expect(errors).toHaveLength(0)
    expect(results.map((r) => r.assetId)).toEqual(['offscreen-png'])
    expect(getDeferredLazyAssetIds()).toContain('offscreen-jpeg')
  })

  it('runImportBatch never enables dualTiers (bulk thumb320 only)', async () => {
    const posts: PhotoWorkerRequest[] = []
    class CapturingWorker {
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

      postMessage(data: PhotoWorkerRequest): void {
        posts.push(data)
        queueMicrotask(() => {
          const event = {
            data: {
              id: data.id,
              ok: true,
              name: 'batch.jpg',
              mimeType: 'image/jpeg',
              byteLength: 1,
              width: 2,
              height: 2,
              correctedWidth: 2,
              correctedHeight: 2,
              orientation: 1,
              previewBuffer: new Uint8Array([1]).buffer,
              previewMimeType: 'image/webp',
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
    vi.stubGlobal('Worker', CapturingWorker)
    warmAssetPool()
    await runImportBatch(
      [
        {
          assetId: 'thumb-only',
          file: new File([new Uint8Array([1])], 'a.jpg', {
            type: 'image/jpeg',
          }),
        },
      ],
      { priority: 'visible' },
    )
    expect(posts[0]?.dualTiers).toBeUndefined()
    posts.length = 0
    await runImportBatch(
      [
        {
          assetId: 'pinned-edge',
          file: new File([new Uint8Array([1])], 'b.jpg', {
            type: 'image/jpeg',
          }),
        },
      ],
      { priority: 'visible', maxEdge: 64 },
    )
    expect(posts[0]?.dualTiers).toBeUndefined()
  })

  it('aborts queued decode when an asset leaves the now set and retries on return', async () => {
    hangWorker()
    warmAssetPool()
    setDecodeBackgroundIdleForTests(true)
    const file = new File([new Uint8Array([1])], 'scroll.jpg', {
      type: 'image/jpeg',
    })
    const holders = Array.from(
      { length: DECODE_POOL_CAP },
      (_, i) => `hold-${String(i)}`,
    )
    setVisibleAssetIds([...holders, 'scroll-me'])
    for (const id of holders) {
      void processAsset({
        assetId: id,
        file,
        priority: 'visible',
      })
    }
    const pending = processAsset({
      assetId: 'scroll-me',
      file,
      priority: 'visible',
    })
    expect(getQueuedDecodeAssetIds()).toContain('scroll-me')
    setVisibleAssetIds(holders)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(getPendingRetryAssetIdsForTests()).toContain('scroll-me')
    expect(getQueuedDecodeAssetIds()).not.toContain('scroll-me')

    setVisibleAssetIds([...holders, 'scroll-me'])
    expect(getPendingRetryAssetIdsForTests()).not.toContain('scroll-me')
    expect(getQueuedDecodeAssetIds()).toContain('scroll-me')
  })

  it('noteDecodePressure lowers effective concurrency via backoff', () => {
    expect(decodeWorkerCount(8)).toBe(4)
    expect(decodeWorkerCount(9, { importActive: true })).toBe(DECODE_POOL_CAP)
    noteDecodePressure({ memoryPressure: true })
    noteDecodePressure({ memoryPressure: false, longTaskPressure: false })
  })

  it('noteDecodeScrollActivity gates background drains inside pump', async () => {
    vi.useFakeTimers()
    let now = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    hangWorker()
    warmAssetPool()
    setVisibleAssetIds([])
    noteDecodeScrollActivity(200)
    void processAsset({
      assetId: 'bg-quiet',
      file: new File([new Uint8Array([1])], 'bg.png', { type: 'image/png' }),
      priority: 'prefetch',
    })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)
    // Quiet gates allowBackground inside pump — job stays queued.
    expect(getQueuedDecodeAssetIds()).toContain('bg-quiet')
    // Force-idle still cannot start background while scroll quiet is open.
    setDecodeBackgroundIdleForTests(true)
    expect(getQueuedDecodeAssetIds()).toContain('bg-quiet')
    now = 10_201
    setDecodeBackgroundIdleForTests(true)
    expect(getQueuedDecodeAssetIds()).not.toContain('bg-quiet')
    vi.useRealTimers()
  })

  it('without scroll quiet, background pump claims prefetch jobs', async () => {
    vi.useFakeTimers()
    hangWorker()
    warmAssetPool()
    setVisibleAssetIds([])
    void processAsset({
      assetId: 'bg-free',
      file: new File([new Uint8Array([1])], 'free.png', { type: 'image/png' }),
      priority: 'prefetch',
    })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(getQueuedDecodeAssetIds()).not.toContain('bg-free')
    vi.useRealTimers()
  })

  it('setDecodeBackgroundIdleForTests(false) is a no-op on an idle pool', () => {
    hangWorker()
    warmAssetPool()
    setDecodeBackgroundIdleForTests(false)
    expect(getQueuedDecodeAssetIds()).toEqual([])
    setDecodeBackgroundIdleForTests(true)
    expect(getQueuedDecodeAssetIds()).toEqual([])
  })

  it('resetAssetPool clears pending retries and in-flight bookkeeping', () => {
    hangWorker()
    warmAssetPool()
    setDecodeBackgroundIdleForTests(true)
    const file = new File([new Uint8Array([1])], 'r.jpg', {
      type: 'image/jpeg',
    })
    setVisibleAssetIds(['a', 'b'])
    void processAsset({ assetId: 'a', file, priority: 'visible' })
    // In-flight 1280 aborts on leave-now (an in-flight thumb320 would be kept).
    void processAsset({
      assetId: 'b',
      file,
      priority: 'visible',
      maxEdge: PREVIEW_MAX_EDGE,
    })
    setVisibleAssetIds(['a'])
    expect(getPendingRetryAssetIdsForTests()).toContain('b')
    resetAssetPool()
    expect(getPendingRetryAssetIdsForTests()).toEqual([])
    expect(getQueuedDecodeAssetIds()).toEqual([])
  })

  it('rejects when the caller aborts via an explicit signal', async () => {
    hangWorker()
    const controller = new AbortController()
    const file = new File([new Uint8Array([1])], 'gone.jpg', {
      type: 'image/jpeg',
    })
    const pending = processAsset({
      assetId: 'gone',
      file,
      priority: 'visible',
      signal: controller.signal,
    })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('unions filmstrip and spread visible ids when draining the queue', async () => {
    const order: string[] = []
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
        order.push(data.file.name)
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
    warmAssetPool()
    setFilmstripVisibleAssetIds(['film'])

    const file = (name: string): File =>
      new File([new Uint8Array([1])], name, { type: 'image/png' })
    // Same priority for all queued work — only visibility boost distinguishes.
    const hold = processAsset({
      assetId: 'hold',
      file: file('hold.png'),
      priority: 'prefetch',
    })
    const other = processAsset({
      assetId: 'other',
      file: file('other.png'),
      priority: 'prefetch',
    })
    const film = processAsset({
      assetId: 'film',
      file: file('film.png'),
      priority: 'prefetch',
    })
    await Promise.resolve()
    release?.()
    await Promise.all([hold, other, film])
    // Now-lane (film) starts before earlier background jobs still waiting on idle.
    expect(order).toEqual(['film.png', 'hold.png', 'other.png'])
  })

  it('boosts spread-visible ids without a filmstrip window', async () => {
    const order: string[] = []
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
        order.push(data.file.name)
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
    warmAssetPool()
    setSpreadVisibleAssetIds('s0', ['spread'])

    const file = (name: string): File =>
      new File([new Uint8Array([1])], name, { type: 'image/png' })
    const hold = processAsset({
      assetId: 'hold',
      file: file('hold.png'),
      priority: 'prefetch',
    })
    const other = processAsset({
      assetId: 'other',
      file: file('other.png'),
      priority: 'prefetch',
    })
    const spread = processAsset({
      assetId: 'spread',
      file: file('spread.png'),
      priority: 'prefetch',
    })
    await Promise.resolve()
    release?.()
    await Promise.all([hold, other, spread])
    expect(order).toEqual(['spread.png', 'hold.png', 'other.png'])
  })

  it('drops spread preference when cleared and resets via setVisibleAssetIds', async () => {
    const order: string[] = []
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
        order.push(data.file.name)
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
    warmAssetPool()
    setSpreadVisibleAssetIds('s0', ['spread'])
    setSpreadVisibleAssetIds('s0', [])
    setFilmstripVisibleAssetIds(['film-only'])

    const file = (name: string): File =>
      new File([new Uint8Array([1])], name, { type: 'image/png' })
    const hold = processAsset({
      assetId: 'hold',
      file: file('hold.png'),
      priority: 'prefetch',
    })
    const cleared = processAsset({
      assetId: 'spread',
      file: file('cleared.png'),
      priority: 'prefetch',
    })
    const filmOnly = processAsset({
      assetId: 'film-only',
      file: file('film-only.png'),
      priority: 'prefetch',
    })
    await Promise.resolve()
    release?.()
    await Promise.all([hold, cleared, filmOnly])
    expect(order).toEqual(['film-only.png', 'hold.png', 'cleared.png'])
  })

  it('resetAssetPool forgets prior spread preference', async () => {
    const order: string[] = []
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
        order.push(data.file.name)
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
    warmAssetPool()
    setSpreadVisibleAssetIds('s0', ['spread'])
    resetAssetPool()
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 1,
    })
    vi.stubGlobal('Worker', GatedWorker)
    warmAssetPool()
    setFilmstripVisibleAssetIds(['film'])

    const file = (name: string): File =>
      new File([new Uint8Array([1])], name, { type: 'image/png' })
    const hold = processAsset({
      assetId: 'hold',
      file: file('hold.png'),
      priority: 'prefetch',
    })
    const stale = processAsset({
      assetId: 'spread',
      file: file('stale.png'),
      priority: 'prefetch',
    })
    const film = processAsset({
      assetId: 'film',
      file: file('film.png'),
      priority: 'prefetch',
    })
    await Promise.resolve()
    release?.()
    await Promise.all([hold, stale, film])
    expect(order).toEqual(['film.png', 'hold.png', 'stale.png'])
  })

  it('setVisibleAssetIds clears prior spread preference', async () => {
    const order: string[] = []
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
        order.push(data.file.name)
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
    warmAssetPool()
    setSpreadVisibleAssetIds('s0', ['spread'])
    setVisibleAssetIds(['film-only'])

    const file = (name: string): File =>
      new File([new Uint8Array([1])], name, { type: 'image/png' })
    const hold = processAsset({
      assetId: 'hold',
      file: file('hold.png'),
      priority: 'prefetch',
    })
    const cleared = processAsset({
      assetId: 'spread',
      file: file('cleared.png'),
      priority: 'prefetch',
    })
    const filmOnly = processAsset({
      assetId: 'film-only',
      file: file('film-only.png'),
      priority: 'prefetch',
    })
    await Promise.resolve()
    release?.()
    await Promise.all([hold, cleared, filmOnly])
    expect(order).toEqual(['film-only.png', 'hold.png', 'cleared.png'])
  })

  it('prefers visible assets when draining a single-worker queue', async () => {
    const order: string[] = []
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
        order.push(data.file.name)
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
    warmAssetPool()

    setVisibleAssetIds(['visible'])
    const blocker = processAsset({
      assetId: 'hold',
      file: new File([new Uint8Array([1])], 'hold.jpg', { type: 'image/jpeg' }),
      priority: 'visible',
    })
    const background = processAsset({
      assetId: 'bg',
      file: new File([new Uint8Array([1])], 'bg.png', { type: 'image/png' }),
      priority: 'background',
    })
    const visible = processAsset({
      assetId: 'visible',
      file: new File([new Uint8Array([1])], 'vis.jpg', { type: 'image/jpeg' }),
      priority: 'prefetch',
    })
    expect(order).toEqual(['hold.jpg'])
    release?.()
    await Promise.all([blocker, background, visible])
    expect(order).toEqual(['hold.jpg', 'vis.jpg', 'bg.png'])
  })

  it('runs zoom jobs after visible work and before prefetch', async () => {
    const order: string[] = []
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
        order.push(data.file.name)
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
    warmAssetPool()

    const jpeg = (name: string): File =>
      new File([new Uint8Array([1])], name, { type: 'image/png' })
    const png = (name: string): File =>
      new File([new Uint8Array([1])], name, { type: 'image/png' })
    const hold = processAsset({
      assetId: 'hold',
      file: jpeg('hold.jpg'),
      priority: 'visible',
    })
    const prefetch = processAsset({
      assetId: 'pre',
      file: png('pre.png'),
      priority: 'prefetch',
    })
    const zoom = processAsset({
      assetId: 'zoom',
      file: jpeg('zoom.jpg'),
      priority: 'zoom',
    })
    expect(order).toEqual(['hold.jpg'])
    release?.()
    await Promise.all([hold, prefetch, zoom])
    expect(order).toEqual(['hold.jpg', 'zoom.jpg', 'pre.png'])
  })

  it('resetAssetPool rejects jobs still waiting in the queue', async () => {
    hangWorker()
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 1,
    })
    warmAssetPool()
    const first = processAsset({
      assetId: 'a',
      file: new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
      priority: 'visible',
    })
    const second = processAsset({
      assetId: 'b',
      file: new File([new Uint8Array([1])], 'b.png', { type: 'image/png' }),
      priority: 'background',
    })
    const secondResult = second.then(
      () => 'resolved' as const,
      (error: unknown) =>
        error instanceof Error ? error.message : String(error),
    )
    resetAssetPool()
    await expect(secondResult).resolves.toMatch(/reset/)
    first.catch(() => undefined)
  })

  it('keeps deferred HEIC off the queue when visibility changes elsewhere', () => {
    hangWorker()
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'stay.heic', {
      type: 'image/heic',
    })
    const pending = processAsset({
      assetId: 'heic-stay',
      file: heic,
      priority: 'prefetch',
    })
    pending.catch(() => undefined)
    expect(getDeferredHeicAssetIds()).toContain('heic-stay')
    setFilmstripVisibleAssetIds(['other-asset'])
    expect(getDeferredHeicAssetIds()).toContain('heic-stay')
    expect(getQueuedDecodeAssetIds()).not.toContain('heic-stay')
    resetAssetPool()
  })

  it('abortDecodeForTests is a no-op when no controller exists', () => {
    expect(() => {
      abortDecodeForTests('missing-controller')
    }).not.toThrow()
  })

  it('does not queue off-screen HEIC at prefetch; queues when visible', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'phone.heic',
      mimeType: 'image/heic',
      byteLength: 1,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'phone.heic', {
      type: 'image/heic',
    })
    expect(shouldDeferHeicDecode('heic-off', heic, 'prefetch')).toBe(true)

    const pending = processAsset({
      assetId: 'heic-off',
      file: heic,
      priority: 'prefetch',
    })
    expect(getDeferredHeicAssetIds()).toContain('heic-off')
    expect(getQueuedDecodeAssetIds()).not.toContain('heic-off')

    setVisibleAssetIds(['heic-off'])
    expect(getDeferredHeicAssetIds()).not.toContain('heic-off')
    await expect(pending).resolves.toMatchObject({ assetId: 'heic-off' })
  })

  it('does not queue off-screen JPEG at prefetch; queues when visible (lazy like HEIC)', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'big.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/webp',
      sourceBuffer: new Uint8Array([9]).buffer,
    })
    warmAssetPool()
    const jpeg = new File([new Uint8Array([1])], 'big.jpg', {
      type: 'image/jpeg',
    })
    expect(shouldDeferLazyDecode('jpeg-off', jpeg, 'prefetch')).toBe(true)
    expect(shouldDeferHeicDecode('jpeg-off', jpeg, 'prefetch')).toBe(false)

    const pending = processAsset({
      assetId: 'jpeg-off',
      file: jpeg,
      priority: 'prefetch',
    })
    expect(getDeferredLazyAssetIds()).toContain('jpeg-off')
    expect(getQueuedDecodeAssetIds()).not.toContain('jpeg-off')

    setVisibleAssetIds(['jpeg-off'])
    expect(getDeferredLazyAssetIds()).not.toContain('jpeg-off')
    const result = await pending
    expect(result.assetId).toBe('jpeg-off')
    expect(result.sourceBuffer).toBeDefined()
  })

  it('runImportBatch defers off-screen JPEG without awaiting full decode', async () => {
    hangWorker()
    warmAssetPool()
    const jpeg = new File([new Uint8Array([1])], 'defer.jpg', {
      type: 'image/jpeg',
    })
    const batch = runImportBatch([{ assetId: 'jpeg-defer', file: jpeg }], {
      priority: 'prefetch',
    })
    const outcome = await batch
    expect(outcome.results).toEqual([])
    expect(getDeferredLazyAssetIds()).toContain('jpeg-defer')
    expect(getQueuedDecodeAssetIds()).not.toContain('jpeg-defer')
    resetAssetPool()
  })

  it('raises effective decode concurrency while import is active', () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 14,
    })
    expect(getDecodeImportActiveForTests()).toBe(false)
    expect(getEffectiveDecodeSlotLimitForTests()).toBe(4)
    setDecodeImportActive(true)
    expect(getDecodeImportActiveForTests()).toBe(true)
    expect(getEffectiveDecodeSlotLimitForTests()).toBe(DECODE_POOL_CAP)
    noteDecodePressure({ memoryPressure: true })
    expect(getEffectiveDecodeSlotLimitForTests()).toBe(1)
    noteDecodePressure({ memoryPressure: false })
    setDecodeImportActive(false)
    expect(getDecodeImportActiveForTests()).toBe(false)
    expect(getEffectiveDecodeSlotLimitForTests()).toBe(4)
  })

  it('warmAssetPool allocates import-cap worker slots even when idle', () => {
    let created = 0
    class CountingWorker {
      addEventListener(): void {
        // no-op
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

      constructor() {
        created += 1
      }
    }
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 32,
    })
    vi.stubGlobal('Worker', CountingWorker)
    expect(getDecodeImportActiveForTests()).toBe(false)
    warmAssetPool()
    expect(created).toBe(DECODE_POOL_CAP_IMPORT)
  })

  it('assignWorkingFields leaves sourceBuffer unset when the worker omitted it', () => {
    const base: AssetProcessResult = {
      assetId: 'x',
      name: 'x.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer: new ArrayBuffer(1),
      previewMimeType: 'image/webp',
    }
    const none: AssetProcessResult = { ...base }
    assignWorkingFields(none, { workingMimeType: 'image/webp' })
    expect(Object.hasOwn(none, 'sourceBuffer')).toBe(false)
  })

  it('deferred JPEG decode failure invokes onError (unlike HEIC)', async () => {
    mockWorkerFailure('jpeg boom')
    warmAssetPool()
    const onError = vi.fn()
    const jpeg = new File([new Uint8Array([1])], 'bad.jpg', {
      type: 'image/jpeg',
    })
    const batch = runImportBatch([{ assetId: 'jpeg-async-fail', file: jpeg }], {
      priority: 'prefetch',
      onError,
    })
    await Promise.resolve()
    expect(getDeferredLazyAssetIds()).toContain('jpeg-async-fail')
    setVisibleAssetIds(['jpeg-async-fail'])
    await batch
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'jpeg-async-fail',
        expect.objectContaining({
          reason: 'decode-failed',
          message: 'jpeg boom',
        }),
      )
    })
  })

  it('promotes deferred tail JPEG ahead of start-ordered background', async () => {
    const order: string[] = []
    class OrderedWorker {
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
        order.push(data.file.name)
        queueMicrotask(() => {
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
              previewMimeType: 'image/webp',
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
    vi.stubGlobal('Worker', OrderedWorker)
    warmAssetPool()
    setDecodeBackgroundIdleForTests(true)
    // Fill pool so later enqueue stays queued until we free a slot via visibility.
    setVisibleAssetIds([])
    const early = new File([new Uint8Array([1])], 'early.jpg', {
      type: 'image/jpeg',
    })
    const tail = new File([new Uint8Array([2])], 'tail.jpg', {
      type: 'image/jpeg',
    })
    void processAsset({
      assetId: 'early',
      file: early,
      priority: 'prefetch',
    }).catch(() => undefined)
    void processAsset({
      assetId: 'tail',
      file: tail,
      priority: 'prefetch',
    }).catch(() => undefined)
    expect([...getDeferredLazyAssetIds()].sort()).toEqual(['early', 'tail'])
    setVisibleAssetIds(['tail'])
    await vi.waitFor(() => {
      expect(order[0]).toBe('tail.jpg')
    })
  })

  it('queues deferred HEIC when marked book-used', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'placed.heic',
      mimeType: 'image/heic',
      byteLength: 1,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'placed.heic', {
      type: 'image/heic',
    })
    const pending = processAsset({
      assetId: 'heic-placed',
      file: heic,
      priority: 'prefetch',
    })
    expect(getDeferredHeicAssetIds()).toContain('heic-placed')

    setBookUsedAssetIds(['heic-placed'])
    await expect(pending).resolves.toMatchObject({ assetId: 'heic-placed' })
    expect(getDeferredHeicAssetIds()).not.toContain('heic-placed')
  })

  it('decodes HEIC immediately at zoom priority when off-screen', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'zoom.heic',
      mimeType: 'image/heic',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'zoom.heic', {
      type: 'image/heic',
    })
    expect(shouldDeferHeicDecode('heic-zoom', heic, 'zoom')).toBe(false)

    const pending = processAsset({
      assetId: 'heic-zoom',
      file: heic,
      priority: 'zoom',
    })
    expect(getDeferredHeicAssetIds()).toEqual([])
    await expect(pending).resolves.toMatchObject({ assetId: 'heic-zoom' })
  })

  it('resetAssetPool rejects deferred HEIC waiters and clears the map', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'defer.heic',
      mimeType: 'image/heic',
      byteLength: 1,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'defer.heic', {
      type: 'image/heic',
    })
    const pending = processAsset({
      assetId: 'heic-defer-reset',
      file: heic,
      priority: 'prefetch',
    })
    expect(getDeferredHeicAssetIds()).toContain('heic-defer-reset')
    resetAssetPool()
    await expect(pending).rejects.toThrow(/reset/)
    expect(getDeferredHeicAssetIds()).toEqual([])
  })

  it('setBookUsedAssetIds promotes deferred HEIC off the wait map', () => {
    hangWorker()
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'placed.heic', {
      type: 'image/heic',
    })
    void processAsset({
      assetId: 'heic-pump',
      file: heic,
      priority: 'prefetch',
    })
    expect(getDeferredHeicAssetIds()).toContain('heic-pump')
    setBookUsedAssetIds(['heic-pump'])
    expect(getDeferredHeicAssetIds()).not.toContain('heic-pump')
  })

  it('bookUsedIdsUnchanged compares membership ignoring order', () => {
    expect(bookUsedIdsUnchanged(new Set(['a', 'b']), ['b', 'a'])).toBe(true)
    expect(bookUsedIdsUnchanged(new Set(['a']), ['a', 'b'])).toBe(false)
    expect(bookUsedIdsUnchanged(new Set(['a', 'b']), ['a'])).toBe(false)
    expect(bookUsedIdsUnchanged(new Set(['a']), ['a', 'a'])).toBe(false)
    expect(bookUsedIdsUnchanged(new Set(['a', 'b']), ['a', 'c'])).toBe(false)
    expect(bookUsedIdsUnchanged(new Set(), [])).toBe(true)
  })

  it('setBookUsedAssetIds skips promote when ids are unchanged', () => {
    hangWorker()
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'stable.heic', {
      type: 'image/heic',
    })
    void processAsset({
      assetId: 'heic-stable',
      file: heic,
      priority: 'prefetch',
    })
    expect(getDeferredHeicAssetIds()).toContain('heic-stable')
    setBookUsedAssetIds([])
    // Unchanged empty membership must not pump/promote.
    setBookUsedAssetIds([])
    expect(getDeferredHeicAssetIds()).toContain('heic-stable')
    setBookUsedAssetIds(['heic-stable'])
    expect(getDeferredHeicAssetIds()).not.toContain('heic-stable')
  })

  it('ignores AbortError from deferred HEIC imports in batch progress', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'abort.heic',
      mimeType: 'image/heic',
      byteLength: 1,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'abort.heic', {
      type: 'image/heic',
    })
    const progressErrors: ImportFileError[][] = []
    const batch = runImportBatch([{ assetId: 'heic-ab-batch', file: heic }], {
      priority: 'prefetch',
      onProgress: (state) => {
        progressErrors.push([...state.errors])
      },
    })
    await Promise.resolve()
    abortDecodeForTests('heic-ab-batch')
    setVisibleAssetIds(['heic-ab-batch'])
    await batch
    expect(progressErrors.at(-1)).toEqual([])
  })

  it('records async HEIC decode failures from deferred imports', async () => {
    mockWorkerFailure('heic decode failed')
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'fail.heic', {
      type: 'image/heic',
    })
    const progress: ImportFileError[][] = []
    const batch = runImportBatch([{ assetId: 'heic-fail', file: heic }], {
      priority: 'prefetch',
      onProgress: (state) => {
        progress.push([...state.errors])
      },
    })
    expect(getDeferredHeicAssetIds()).toContain('heic-fail')
    setVisibleAssetIds(['heic-fail'])
    await batch
    await vi.waitFor(() => {
      expect(progress.at(-1)?.some((e) => e.assetId === 'heic-fail')).toBe(true)
    })
  })

  it('runImportBatch queues visible-priority HEIC instead of deferring', async () => {
    hangWorker()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'vis.heic', {
      type: 'image/heic',
    })
    const batch = runImportBatch([{ assetId: 'heic-vis', file: heic }], {
      priority: 'visible',
    })
    await Promise.resolve()
    expect(getDeferredHeicAssetIds()).not.toContain('heic-vis')
    resetAssetPool()
    await batch
  })

  it('getQueuedDecodeAssetIds lists waiting jobs', () => {
    hangWorker()
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 1,
    })
    warmAssetPool()
    const file = new File([new Uint8Array([1])], 'wait.png', {
      type: 'image/png',
    })
    void processAsset({
      assetId: 'queued',
      file,
      priority: 'background',
    }).catch(() => undefined)
    void processAsset({
      assetId: 'queued-2',
      file,
      priority: 'background',
    }).catch(() => undefined)
    expect(getQueuedDecodeAssetIds()).toContain('queued-2')
    resetAssetPool()
  })

  it('rejects deferred HEIC when its abort signal fires before promotion', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'abort.heic',
      mimeType: 'image/heic',
      byteLength: 1,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    warmAssetPool()
    const controller = new AbortController()
    const heic = new File([new Uint8Array([1])], 'abort.heic', {
      type: 'image/heic',
    })
    const pending = processAsset({
      assetId: 'heic-abort',
      file: heic,
      priority: 'prefetch',
      signal: controller.signal,
    })
    controller.abort()
    setVisibleAssetIds(['heic-abort'])
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('promoted deferred HEIC forwards cover:false to the worker', () => {
    const posted: PhotoWorkerRequest[] = []
    class CaptureWorker {
      addEventListener(): void {
        // hang
      }
      removeEventListener(): void {
        // no-op
      }
      postMessage(data: PhotoWorkerRequest): void {
        posted.push(data)
      }
      terminate(): void {
        // no-op
      }
    }
    vi.stubGlobal('Worker', CaptureWorker)
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'plain.heic', {
      type: 'image/heic',
    })
    void processAsset({
      assetId: 'heic-no-cover',
      file: heic,
      priority: 'prefetch',
      cover: false,
    }).catch(() => undefined)
    setBookUsedAssetIds(['heic-no-cover'])
    expect(posted).toHaveLength(1)
    expect(posted[0]).not.toHaveProperty('cover')
    expect(posted[0]).not.toHaveProperty('returnSource')
    resetAssetPool()
  })

  it('runImportBatch asks for the source body only on returnSource items', async () => {
    const posted: PhotoWorkerRequest[] = []
    class CaptureWorker {
      private onMessage: ((event: MessageEvent) => void) | undefined

      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        if (type === 'message') {
          this.onMessage = listener
        }
      }
      removeEventListener(): void {
        this.onMessage = undefined
      }
      postMessage(data: PhotoWorkerRequest): void {
        posted.push(data)
        queueMicrotask(() => {
          this.onMessage?.({
            data: {
              id: data.id,
              ok: true,
              name: data.file.name,
              mimeType: 'image/png',
              byteLength: 1,
              width: 1,
              height: 1,
              correctedWidth: 1,
              correctedHeight: 1,
              orientation: 1,
              previewBuffer: new Uint8Array([1]).buffer,
              previewMimeType: 'image/webp',
            },
          } as MessageEvent)
        })
      }
      terminate(): void {
        // no-op
      }
    }
    vi.stubGlobal('Worker', CaptureWorker)
    warmAssetPool()
    await runImportBatch(
      [
        {
          assetId: 'memory-root',
          file: new File([new Uint8Array([1])], 'm.png', {
            type: 'image/png',
          }),
          returnSource: true,
        },
        {
          assetId: 'fsa-root',
          file: new File([new Uint8Array([1])], 'f.png', {
            type: 'image/png',
          }),
        },
      ],
      { priority: 'visible' },
    )
    expect(posted).toHaveLength(2)
    const byName = new Map(posted.map((post) => [post.file.name, post]))
    expect(byName.get('m.png')?.returnSource).toBe(true)
    expect(byName.get('f.png')).not.toHaveProperty('returnSource')
    resetAssetPool()
  })

  it('promoted deferred HEIC keeps returnSource on the worker request', () => {
    const posted: PhotoWorkerRequest[] = []
    class CaptureWorker {
      addEventListener(): void {
        // hang
      }
      removeEventListener(): void {
        // no-op
      }
      postMessage(data: PhotoWorkerRequest): void {
        posted.push(data)
      }
      terminate(): void {
        // no-op
      }
    }
    vi.stubGlobal('Worker', CaptureWorker)
    warmAssetPool()
    void processAsset({
      assetId: 'heic-src',
      file: new File([new Uint8Array([1])], 'src.heic', {
        type: 'image/heic',
      }),
      priority: 'prefetch',
      returnSource: true,
    }).catch(() => undefined)
    setBookUsedAssetIds(['heic-src'])
    expect(posted).toEqual([expect.objectContaining({ returnSource: true })])
    resetAssetPool()
  })

  it('promoted deferred HEIC forwards maxEdge cover and signal to the worker', () => {
    const posted: PhotoWorkerRequest[] = []
    class CaptureWorker {
      addEventListener(): void {
        // hang
      }
      removeEventListener(): void {
        // no-op
      }
      postMessage(data: PhotoWorkerRequest): void {
        posted.push(data)
      }
      terminate(): void {
        // no-op
      }
    }
    vi.stubGlobal('Worker', CaptureWorker)
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'opts.heic', {
      type: 'image/heic',
    })
    void processAsset({
      assetId: 'heic-opts',
      file: heic,
      priority: 'prefetch',
      maxEdge: 96,
      cover: true,
    }).catch(() => undefined)
    setBookUsedAssetIds(['heic-opts'])
    expect(posted).toEqual([
      expect.objectContaining({ maxEdge: 96, cover: true }),
    ])
    resetAssetPool()
  })

  it('does not invoke onError for visible HEIC decode failures', async () => {
    mockWorkerFailure('no heic decoder')
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'fail.heic', {
      type: 'image/heic',
    })
    const onError = vi.fn()
    await runImportBatch([{ assetId: 'heic-sync-fail', file: heic }], {
      priority: 'visible',
      onError,
    })
    expect(onError).not.toHaveBeenCalled()
  })

  it('resolves deferred HEIC through runImportBatch onResult', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'late.heic',
      mimeType: 'image/heic',
      byteLength: 1,
      width: 3,
      height: 3,
      correctedWidth: 3,
      correctedHeight: 3,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'late.heic', {
      type: 'image/heic',
    })
    const onResult = vi.fn()
    const batchPromise = runImportBatch(
      [{ assetId: 'heic-late', file: heic }],
      {
        priority: 'prefetch',
        onResult,
      },
    )
    setVisibleAssetIds(['heic-late'])
    const batch = await batchPromise
    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ assetId: 'heic-late' }),
      )
    })
    expect(batch.results.some((result) => result.assetId === 'heic-late')).toBe(
      true,
    )
  })

  it('assigns distinct worker request ids per queued job', async () => {
    const ids: string[] = []
    class IdWorker {
      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void,
      ): void {
        if (type !== 'message') {
          return
        }
        queueMicrotask(() => {
          listener({
            data: {
              id: ids.at(-1),
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
          } as MessageEvent)
        })
      }
      removeEventListener(): void {
        // no-op
      }
      postMessage(data: { id: string }): void {
        ids.push(data.id)
      }
      terminate(): void {
        // no-op
      }
    }
    vi.stubGlobal('Worker', IdWorker)
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 2,
    })
    warmAssetPool()
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    await Promise.all([
      processAsset({ assetId: 'id-a', file, priority: 'visible' }),
      processAsset({ assetId: 'id-b', file, priority: 'visible' }),
    ])
    expect(new Set(ids).size).toBe(2)
    expect(ids[0]).toMatch(/asset-\d+/)
    expect(ids[1]).toMatch(/asset-\d+/)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('runImportBatch finishes without waiting on deferred HEIC', async () => {
    mockWorkerSuccess({
      ok: true,
      name: 'ok.png',
      mimeType: 'image/png',
      byteLength: 1,
      width: 2,
      height: 2,
      correctedWidth: 2,
      correctedHeight: 2,
      orientation: 1,
      previewBuffer: new Uint8Array([1]).buffer,
      previewMimeType: 'image/jpeg',
    })
    warmAssetPool()
    const heic = new File([new Uint8Array([1])], 'idle.heic', {
      type: 'image/heic',
    })
    const png = new File([new Uint8Array([1])], 'ok.png', {
      type: 'image/png',
    })

    const outcome = await runImportBatch(
      [
        { assetId: 'heic-idle', file: heic },
        { assetId: 'png-ok', file: png },
      ],
      { priority: 'prefetch' },
    )

    expect(getDeferredHeicAssetIds()).toContain('heic-idle')
    expect(outcome.results.some((r) => r.assetId === 'png-ok')).toBe(true)

    setVisibleAssetIds(['heic-idle'])
    await vi.waitFor(() => {
      expect(getDeferredHeicAssetIds()).not.toContain('heic-idle')
    })
  })
})
