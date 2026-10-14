import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  processAsset,
  resetAssetPool,
  runImportBatch,
  setVisibleAssetIds,
  warmAssetPool,
} from './assetPool'
import {
  mockWorkerFailure,
  mockWorkerRuntimeError,
  mockWorkerSuccess,
} from './photo.test-helpers'

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
  afterEach(() => {
    resetAssetPool()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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
    const result = await processAsset({ assetId: 'a1', file })
    expect(result.assetId).toBe('a1')
    expect(result.correctedWidth).toBe(10)
    expect(result.previewMimeType).toBe('image/jpeg')
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
      processAsset({ assetId: 'a1', file, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects when the worker posts a runtime error event', async () => {
    mockWorkerRuntimeError('worker crashed')
    warmAssetPool()
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    await expect(processAsset({ assetId: 'a1', file })).rejects.toThrow(
      /worker crashed|Photo worker failed/,
    )
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
    const { results, errors } = await runImportBatch(files, {
      onProgress: (state) => {
        progress.push({
          completed: state.completed,
          errors: state.errors.length,
        })
      },
    })
    expect(results).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toBe('boom')
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

  it('does not abort in-flight import work when visibility changes', async () => {
    const previewBuffer = new Uint8Array([9]).buffer
    mockWorkerSuccess({
      ok: true,
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 4,
      height: 4,
      correctedWidth: 4,
      correctedHeight: 4,
      orientation: 1,
      previewBuffer,
      previewMimeType: 'image/jpeg',
    })
    warmAssetPool()
    setVisibleAssetIds(['visible-only'])
    const pending = runImportBatch(
      [
        {
          assetId: 'offscreen-a',
          file: new File([new Uint8Array([1])], 'a.jpg', {
            type: 'image/jpeg',
          }),
        },
        {
          assetId: 'offscreen-b',
          file: new File([new Uint8Array([2])], 'b.jpg', {
            type: 'image/jpeg',
          }),
        },
      ],
      { priority: 'prefetch', maxEdge: 64 },
    )
    setVisibleAssetIds(['visible-only'])
    const { results, errors } = await pending
    expect(errors).toHaveLength(0)
    expect(results.map((r) => r.assetId).sort()).toEqual([
      'offscreen-a',
      'offscreen-b',
    ])
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
      priority: 'prefetch',
      signal: controller.signal,
    })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
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
      file: new File([new Uint8Array([1])], 'bg.jpg', { type: 'image/jpeg' }),
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
    expect(order).toEqual(['hold.jpg', 'vis.jpg', 'bg.jpg'])
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
      file: new File([new Uint8Array([1])], 'b.jpg', { type: 'image/jpeg' }),
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
})
