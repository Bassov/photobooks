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
const seedWorkingPreview = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
)

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

vi.mock('../photo/tierCache', async () => {
  const actual =
    await vi.importActual<typeof import('../photo/tierCache')>(
      '../photo/tierCache',
    )
  return {
    ...actual,
    seedWorkingPreview: (...args: unknown[]): unknown =>
      seedWorkingPreview(...args) as unknown,
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
    seedWorkingPreview.mockReset()
    seedWorkingPreview.mockResolvedValue(undefined)
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

  it('sniffs extension-less octet-stream HEIC into the gallery batch', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    runImportBatch.mockResolvedValue({ results: [], errors: [] })
    const size = 20
    const bytes = new Uint8Array(size)
    bytes[0] = 0
    bytes[1] = 0
    bytes[2] = 0
    bytes[3] = size
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    bytes.set([0x68, 0x65, 0x69, 0x63], 8)
    const nameless = new File([bytes], 'IMG_0042', {
      type: 'application/octet-stream',
    })
    const { isKnownHeicFile } = await import('../photo/heic')
    const result = await importPhotoFiles([nameless])
    expect(result.errors).toEqual([])
    expect(runImportBatch).toHaveBeenCalled()
    const batchFiles = (
      runImportBatch.mock.calls[0] as [{ file: File }[], unknown] | undefined
    )?.[0]
    expect(batchFiles?.some((entry) => entry.file.name === 'IMG_0042')).toBe(
      true,
    )
    expect(isKnownHeicFile(nameless)).toBe(true)
  })

  it('folder source skips non-image files and excludes them from total', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const readme = new File(['# hi'], 'README.md', { type: 'text/markdown' })
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' })
    const progress = vi.fn()
    const result = await importPhotoFiles([readme, txt], {
      source: 'folder',
      onProgress: progress,
    })
    expect(result).toEqual({ imported: 0, errors: [], skipped: 2 })
    expect(runImportBatch).not.toHaveBeenCalled()
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: 0,
        total: 0,
        running: false,
        errors: [],
      }),
    )
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
    expect(seedWorkingPreview).not.toHaveBeenCalled()
  })

  it('seeds working preview only when both workingBuffer and workingMimeType are set', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dual')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const jpeg = new File([new Uint8Array([1])], 'dual.jpg', {
      type: 'image/jpeg',
    })
    const workingBuffer = new Uint8Array([2, 3]).buffer
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
            workingBuffer?: ArrayBuffer
            workingMimeType?: string
          }) => void
        },
      ) => {
        const item = items[0]
        if (!item) {
          return Promise.resolve({ results: [], errors: [] })
        }
        options.onResult?.({
          assetId: item.assetId,
          name: item.file.name,
          correctedWidth: 40,
          correctedHeight: 20,
          orientation: 1,
          previewBuffer: new Uint8Array([9]).buffer,
          previewMimeType: 'image/webp',
          workingBuffer,
          workingMimeType: 'image/webp',
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
              previewMimeType: 'image/webp',
              workingBuffer,
              workingMimeType: 'image/webp',
            },
          ],
          errors: [],
        })
      },
    )

    const result = await importPhotoFiles([jpeg])
    expect(result.imported).toBe(1)
    expect(seedWorkingPreview).toHaveBeenCalledOnce()
    expect(seedWorkingPreview).toHaveBeenCalledWith(
      expect.any(String),
      workingBuffer,
      'image/webp',
      undefined,
    )
  })

  it('does not seed working preview when only one dual-tier field is present', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:partial')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const emitPartial = (partial: {
      workingBuffer?: ArrayBuffer
      workingMimeType?: string
    }): void => {
      runImportBatch.mockImplementationOnce(
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
              workingBuffer?: ArrayBuffer
              workingMimeType?: string
            }) => void
          },
        ) => {
          const item = items[0]
          if (!item) {
            return Promise.resolve({ results: [], errors: [] })
          }
          options.onResult?.({
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 10,
            correctedHeight: 10,
            orientation: 1,
            previewBuffer: new Uint8Array([1]).buffer,
            previewMimeType: 'image/webp',
            ...partial,
          })
          return Promise.resolve({ results: [], errors: [] })
        },
      )
    }

    emitPartial({ workingBuffer: new Uint8Array([2]).buffer })
    await importPhotoFiles([
      new File([new Uint8Array([1])], 'buf-only.jpg', { type: 'image/jpeg' }),
    ])
    emitPartial({ workingMimeType: 'image/webp' })
    await importPhotoFiles([
      new File([new Uint8Array([1])], 'mime-only.jpg', { type: 'image/jpeg' }),
    ])
    expect(seedWorkingPreview).not.toHaveBeenCalled()
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
    const onDecodeError = vi.fn()
    const result = await importPhotoFiles([file], { onDecodeError })
    for (const cb of callbacks) {
      cb(0)
    }
    expect(result.imported).toBe(0)
    expect(getGalleryIdsSnapshot()).toEqual([])
    expect(getSelectedAssetId()).toBeNull()
    expect(getAssetSource(result.errors[0]?.assetId ?? '')).toBeUndefined()
    expect(onDecodeError).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'decode-failed',
        name: 'bad.jpg',
      }),
    )
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

  it('does not double-enqueue session gallery without listAlreadyEnqueued', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    runImportBatch.mockResolvedValue({ results: [], errors: [] })
    const enqueueSpy = vi.spyOn(
      await import('./bookStore'),
      'enqueueGalleryAssets',
    )
    const jpeg = new File([new Uint8Array([1])], 'solo.jpg', {
      type: 'image/jpeg',
    })
    await importPhotoFiles([jpeg], { libraryBacked: false })
    expect(getGalleryIdsSnapshot()).toHaveLength(1)
    expect(enqueueSpy).toHaveBeenCalledTimes(1)
    enqueueSpy.mockRestore()
  })

  it('listAlreadyEnqueued mints session placeholders for new files', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    runImportBatch.mockResolvedValue({ results: [], errors: [] })
    const jpeg = new File([new Uint8Array([1])], 'new.jpg', {
      type: 'image/jpeg',
    })
    await importPhotoFiles([jpeg], { listAlreadyEnqueued: true })
    expect(getGalleryIdsSnapshot()).toHaveLength(1)
    const id = getGalleryIdsSnapshot()[0] ?? ''
    expect(getBookStoreSnapshot().sessionMeta.get(id)).toEqual(
      expect.objectContaining({ name: 'new.jpg', correctedWidth: 1 }),
    )
  })

  it('onError keeps HEIC gallery placeholders after decode failure', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onError?: (assetId: string, error: ImportFileError) => void
        },
      ) => {
        const item = items.find((entry) => entry.file.name === 'phone.heic')
        if (item) {
          options?.onError?.(item.assetId, {
            id: 'heic-err',
            name: 'phone.heic',
            message: 'unsupported',
            reason: 'heic',
            assetId: item.assetId,
          })
        }
        return Promise.resolve({ results: [], errors: [] })
      },
    )
    const heic = new File([new Uint8Array([1])], 'phone.heic', {
      type: 'image/heic',
    })
    const result = await importPhotoFiles([heic])
    expect(result.errors).toEqual([])
    expect(getGalleryIdsSnapshot()).toHaveLength(1)
  })

  it('marks signature-sniffed HEIC files for lazy decode', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    runImportBatch.mockResolvedValue({ results: [], errors: [] })
    const size = 20
    const bytes = new Uint8Array(size)
    bytes[0] = 0
    bytes[1] = 0
    bytes[2] = 0
    bytes[3] = size
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    bytes.set([0x68, 0x65, 0x69, 0x63], 8)
    const nameless = new File([bytes], 'IMG_0042', {
      type: 'application/octet-stream',
    })
    const { isKnownHeicFile } = await import('../photo/heic')
    await importPhotoFiles([nameless])
    expect(isKnownHeicFile(nameless)).toBe(true)
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
