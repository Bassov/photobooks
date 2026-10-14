import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBookStoreSnapshot,
  getGalleryIdsSnapshot,
  resetBookStore,
} from './bookStore'
import { getThumbUrl, resetThumbCache } from './thumbCache'

const runImportBatch = vi.hoisted(() => vi.fn())

vi.mock('../photo/assetPool', async () => {
  const actual =
    await vi.importActual<typeof import('../photo/assetPool')>(
      '../photo/assetPool',
    )
  return {
    ...actual,
    runImportBatch: (...args: unknown[]): unknown =>
      runImportBatch(...args) as unknown,
  }
})

import { importPhotoFiles } from './importPhotos'

describe('importPhotoFiles', () => {
  afterEach(() => {
    resetBookStore()
    resetThumbCache()
    runImportBatch.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns early errors for unsupported files without calling the pool', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const tiff = new File([new Uint8Array([1])], 'scan.tiff', {
      type: 'image/tiff',
    })
    const progress = vi.fn()
    const result = await importPhotoFiles([tiff], { onProgress: progress })
    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.name).toBe('scan.tiff')
    expect(runImportBatch).not.toHaveBeenCalled()
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: 1,
        total: 1,
        running: false,
      }),
    )
    expect(getBookStoreSnapshot().importRunning).toBe(false)
  })

  it('enqueues accepted files, applies results, and sets thumbs', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:imported')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const jpeg = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
          onProgress?: (state: {
            total: number
            completed: number
            errors: unknown[]
            running: boolean
          }) => void
        },
      ) => {
        const item = items[0]
        if (!item) {
          return Promise.resolve({ results: [], errors: [] })
        }
        options.onProgress?.({
          total: 1,
          completed: 0,
          errors: [],
          running: true,
        })
        options.onResult?.({
          assetId: item.assetId,
          name: item.file.name,
          correctedWidth: 40,
          correctedHeight: 20,
          orientation: 1,
          previewBuffer: new Uint8Array([9]).buffer,
          previewMimeType: 'image/jpeg',
        })
        options.onProgress?.({
          total: 1,
          completed: 1,
          errors: [],
          running: false,
        })
        return Promise.resolve({
          results: [
            {
              assetId: item.assetId,
              name: item.file.name,
              mimeType: 'image/jpeg',
              byteLength: 1,
              width: 40,
              height: 20,
              correctedWidth: 40,
              correctedHeight: 20,
              orientation: 1,
              previewBuffer: new Uint8Array([9]).buffer,
              previewMimeType: 'image/jpeg',
            },
          ],
          errors: [],
        })
      },
    )

    const result = await importPhotoFiles([jpeg])
    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(runImportBatch).toHaveBeenCalledOnce()

    for (const cb of callbacks) {
      cb(0)
    }

    const gallery = getGalleryIdsSnapshot()
    expect(gallery).toHaveLength(1)
    const assetId = gallery[0] ?? ''
    expect(assetId.length).toBeGreaterThan(0)
    expect(getBookStoreSnapshot().sessionMeta.get(assetId)?.aspect).toBe(2)
    expect(getThumbUrl(assetId)).toBe('blob:imported')
    expect(getBookStoreSnapshot().importRunning).toBe(false)
  })

  it('merges pool errors with early reject errors', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const jpeg = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const tiff = new File([new Uint8Array([1])], 'b.tiff', {
      type: 'image/tiff',
    })
    runImportBatch.mockResolvedValue({
      results: [],
      errors: [{ name: 'a.jpg', message: 'decode failed' }],
    })

    const result = await importPhotoFiles([jpeg, tiff])
    expect(result.imported).toBe(0)
    expect(result.errors.map((e) => e.name).sort()).toEqual(['a.jpg', 'b.tiff'])
  })
})
