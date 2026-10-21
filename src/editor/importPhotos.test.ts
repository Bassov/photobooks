import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBookStoreSnapshot,
  getGalleryIdsSnapshot,
  getPlacementCountSnapshot,
  resetBookStore,
  dispatchBookOp,
} from './bookStore'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import {
  getSelectedAssetId,
  resetGallerySelection,
  setSelectedAssetId,
} from './gallerySelection'
// frameSelection subscribes to bookStore and clears move-source when the
// sourced frame loses its asset (removeFromGallery cascade).
import { getAssetSource, resetAssetSources } from '../photo/assetSources'
import { getThumbUrl, resetThumbCache } from './thumbCache'
import type { ImportFileError } from '../photo/assetPool'

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
    resetAssetSources()
    resetGallerySelection()
    resetFrameSelection()
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

  it('rejects-only import succeeds without an onProgress callback', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const tiff = new File([new Uint8Array([1])], 'solo.tiff', {
      type: 'image/tiff',
    })
    const result = await importPhotoFiles([tiff])
    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(runImportBatch).not.toHaveBeenCalled()
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
    expect(getAssetSource(assetId)?.name).toBe('a.jpg')
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
    const progress = vi.fn()
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onProgress?: (state: {
            total: number
            completed: number
            errors: ImportFileError[]
            running: boolean
          }) => void
          onError?: (assetId: string, error: ImportFileError) => void
        },
      ) => {
        const item = items[0]
        const decodeError: ImportFileError = {
          id: 'err-decode',
          name: 'a.jpg',
          message: 'decode failed',
          reason: 'decode-failed',
          ...(item === undefined ? {} : { assetId: item.assetId }),
        }
        if (item) {
          options?.onError?.(item.assetId, decodeError)
        }
        options?.onProgress?.({
          total: 1,
          completed: 1,
          errors: [decodeError],
          running: false,
        })
        return Promise.resolve({
          results: [],
          errors: [decodeError],
        })
      },
    )

    const result = await importPhotoFiles([jpeg, tiff], {
      onProgress: progress,
    })
    expect(result.imported).toBe(0)
    expect(result.errors.map((e) => e.name).sort()).toEqual(['a.jpg', 'b.tiff'])
    expect(getGalleryIdsSnapshot()).toEqual([])
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 2,
        completed: 2,
        errors: expect.arrayContaining([
          expect.objectContaining({ name: 'a.jpg' }),
          expect.objectContaining({ name: 'b.tiff' }),
        ]),
      }),
    )
  })

  it('onError leaves an unrelated gallery selection intact', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    setSelectedAssetId('other-asset')
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onError?: (assetId: string, error: ImportFileError) => void
        },
      ) => {
        const item = items[0]
        if (!item) {
          return Promise.resolve({ results: [], errors: [] })
        }
        const error: ImportFileError = {
          id: 'err',
          name: item.file.name,
          message: 'decode failed',
          reason: 'decode-failed',
          assetId: item.assetId,
        }
        options?.onError?.(item.assetId, error)
        return Promise.resolve({ results: [], errors: [error] })
      },
    )
    await importPhotoFiles([
      new File([new Uint8Array([1])], 'bad.jpg', { type: 'image/jpeg' }),
    ])
    expect(getSelectedAssetId()).toBe('other-asset')
  })

  it('onError removes a pending decode failure from the gallery', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onError?: (assetId: string, error: ImportFileError) => void
        },
      ) => {
        const item = items[0]
        if (!item) {
          return Promise.resolve({ results: [], errors: [] })
        }
        setSelectedAssetId(item.assetId)
        const error: ImportFileError = {
          id: 'err',
          name: item.file.name,
          message: 'decode failed',
          reason: 'decode-failed',
          assetId: item.assetId,
        }
        options?.onError?.(item.assetId, error)
        return Promise.resolve({ results: [], errors: [error] })
      },
    )

    const file = new File([new Uint8Array([1])], 'bad.jpg', {
      type: 'image/jpeg',
    })
    const result = await importPhotoFiles([file])
    for (const cb of callbacks) {
      cb(0)
    }
    expect(result.imported).toBe(0)
    expect(getGalleryIdsSnapshot()).toEqual([])
    expect(getSelectedAssetId()).toBeNull()
    expect(getAssetSource(result.errors[0]?.assetId ?? '')).toBeUndefined()
  })

  it('onError removes a flushed id, placement, selection; move source clears via store', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onError?: (assetId: string, error: ImportFileError) => void
        },
      ) => {
        const item = items[0]
        if (!item) {
          return Promise.resolve({ results: [], errors: [] })
        }
        for (const cb of callbacks.splice(0)) {
          cb(0)
        }
        setSelectedAssetId(item.assetId)
        const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
        const frameId = getBookStoreSnapshot().book.spreads[0]?.frames[0]?.id
        assert.ok(spreadId)
        assert.ok(frameId)
        dispatchBookOp({
          type: 'place',
          spreadId,
          frameId,
          assetId: item.assetId,
        })
        setFrameSource({ spreadId, frameId })
        expect(getGalleryIdsSnapshot()).toContain(item.assetId)
        expect(getPlacementCountSnapshot(item.assetId)).toBe(1)

        const error: ImportFileError = {
          id: 'err',
          name: item.file.name,
          message: 'decode failed',
          reason: 'decode-failed',
          assetId: item.assetId,
        }
        options?.onError?.(item.assetId, error)
        return Promise.resolve({ results: [], errors: [error] })
      },
    )

    const result = await importPhotoFiles([
      new File([new Uint8Array([1])], 'late.jpg', { type: 'image/jpeg' }),
    ])
    for (const cb of callbacks) {
      cb(0)
    }
    expect(result.imported).toBe(0)
    expect(getGalleryIdsSnapshot()).toEqual([])
    expect(getSelectedAssetId()).toBeNull()
    expect(getFrameSource()).toBeNull()
    expect(getAssetSource(result.errors[0]?.assetId ?? '')).toBeUndefined()
  })

  it('enqueues session placeholder meta before decode', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    let metaAtBatch: { name?: string; correctedWidth?: number } | undefined
    runImportBatch.mockImplementation((items: { assetId: string }[]) => {
      const id = items[0]?.assetId
      if (id) {
        metaAtBatch = getBookStoreSnapshot().sessionMeta.get(id)
      }
      return Promise.resolve({ results: [], errors: [] })
    })
    await importPhotoFiles([
      new File([new Uint8Array([1])], 'sess.jpg', { type: 'image/jpeg' }),
    ])
    expect(metaAtBatch).toEqual(
      expect.objectContaining({
        name: 'sess.jpg',
        correctedWidth: 1,
        correctedHeight: 1,
        orientation: 1,
        aspect: 1,
      }),
    )
  })
})
