import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  processAsset,
  resetAssetPool,
  runImportBatch,
  setVisibleAssetIds,
  warmAssetPool,
} from './assetPool'
import { mockWorkerFailure, mockWorkerSuccess } from './photo.test-helpers'

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

  it('aborts in-flight work when an asset scrolls away', async () => {
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
    setVisibleAssetIds(['gone'])
    const file = new File([new Uint8Array([1])], 'gone.jpg', {
      type: 'image/jpeg',
    })
    const pending = processAsset({
      assetId: 'gone',
      file,
      priority: 'prefetch',
    })
    setVisibleAssetIds(['other'])
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
