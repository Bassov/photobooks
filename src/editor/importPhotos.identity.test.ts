import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetScanWorker } from '../assets'
import { stubScanWorker } from '../assets/scanWorkerMock.test-helpers'
import {
  createMemoryLibraryStorage,
  createMemorySessionState,
} from '../project'
import { getSourceRootEntryIndex } from '../project/session/sourceRootEntryIndex'
import {
  getBookStoreSnapshot,
  getGalleryIdsSnapshot,
  resetBookStore,
} from './bookStore'
import { resetAssetSources } from '../photo/assetSources'
import {
  attachLibraryForTests,
  createBookInLibrary,
  getRegisteredAssetSource,
  resetProjectSessionForTests,
} from './projectSession'
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
import * as pendingHashes from './pendingHashes'
import * as seedLibraryImport from './seedLibraryImport'

function tinyJpeg(name = 'shot.jpg', lastModified = 1_700_000_000_000): File {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  return new File([bytes], name, {
    type: 'image/jpeg',
    lastModified,
  })
}

function neverResolvingFile(name: string, onArrayBuffer: () => void): File {
  const file = tinyJpeg(name)
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => {
      onArrayBuffer()
      return new Promise<ArrayBuffer>(() => {
        // Never resolves — body read stays pending.
      })
    },
  })
  return file
}

function mockBatchPassthrough(): void {
  runImportBatch.mockImplementation(
    (
      items: { assetId: string; file: File }[],
      options?: {
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
      const results = items.map((item) => {
        const result = {
          assetId: item.assetId,
          name: item.file.name,
          correctedWidth: 10,
          correctedHeight: 10,
          orientation: 1,
          previewBuffer: new Uint8Array([9]).buffer,
          previewMimeType: 'image/jpeg',
        }
        options?.onResult?.(result)
        return result
      })
      options?.onProgress?.({
        total: items.length,
        completed: items.length,
        errors: [],
        running: false,
      })
      return Promise.resolve({ results, errors: [] })
    },
  )
}

describe('importPhotoFiles library identity', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    stubScanWorker()
    resetBookStore()
    resetProjectSessionForTests()
    resetThumbCache()
    resetAssetSources()
    runImportBatch.mockReset()
    mockBatchPassthrough()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
  })

  afterEach(() => {
    resetScanWorker()
    resetBookStore()
    resetProjectSessionForTests()
    resetThumbCache()
    resetAssetSources()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('writes source root identity when library-backed', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    await importPhotoFiles([tinyJpeg()], {
      libraryBacked: true,
      sourceRootId: 'root-test',
    })

    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(1)
      const assetId = book.gallery[0]
      expect(assetId).toBeDefined()
      assert.ok(assetId)
      const asset = book.assets[assetId]
      expect(asset?.sourceRootId).toBe('root-test')
      expect(asset?.relativePath).toBe('shot.jpg')
      expect(asset?.byteSize).toBe(4)
    })
    // Seed is async alongside decode — wait for memory source registration.
    await vi.waitFor(() => {
      expect(getRegisteredAssetSource('root-test')).toBeDefined()
    })
    const source = getRegisteredAssetSource('root-test')
    const scanned = await source?.scanRoot('root-test')
    expect(scanned?.ok).toBe(true)
    assert.ok(scanned?.ok)
    expect(
      scanned.value.some((entry) => entry.relativePath === 'shot.jpg'),
    ).toBe(true)
  })

  it('skips identity fields without a library', async () => {
    await importPhotoFiles([tinyJpeg()], { libraryBacked: false })

    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(1)
      const assetId = book.gallery[0]
      expect(assetId).toBeDefined()
      assert.ok(assetId)
      expect(book.assets[assetId]?.sourceRootId).toBeUndefined()
    })
  })

  it('listAlreadyEnqueued reuses path placeholders without doubling gallery', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const { enqueueScannedGalleryList } =
      await import('./enqueueScannedGalleryList')
    // Stale mtime on the placeholder so path+size+mtime reuse misses; path map must hit.
    enqueueScannedGalleryList('root-list', [
      { relativePath: 'shot.jpg', byteSize: 4, mtimeMs: 1 },
    ])
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(1)
    const existingId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(existingId)

    await importPhotoFiles([tinyJpeg('shot.jpg', 1_700_000_000_000)], {
      libraryBacked: true,
      sourceRootId: 'root-list',
      listAlreadyEnqueued: true,
    })
    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery).toHaveLength(1)
      expect(book.gallery[0]).toBe(existingId)
    })
  })

  it('listAlreadyEnqueued skips gallery enqueue when every entry reuses a placeholder', async () => {
    const { enqueueScannedGalleryList } =
      await import('./enqueueScannedGalleryList')
    enqueueScannedGalleryList('root-reuse', [
      { relativePath: 'shot.jpg', byteSize: 4, mtimeMs: 1 },
    ])
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(1)
    const existingId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(existingId)

    await importPhotoFiles([tinyJpeg('shot.jpg', 1_700_000_000_000)], {
      libraryBacked: true,
      sourceRootId: 'root-reuse',
      listAlreadyEnqueued: true,
    })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toEqual([existingId])
    })
  })

  it('listAlreadyEnqueued enqueues only newly minted session placeholders', async () => {
    const { enqueueScannedGalleryList } =
      await import('./enqueueScannedGalleryList')
    enqueueScannedGalleryList('root-session', [
      { relativePath: 'existing.jpg', byteSize: 4, mtimeMs: 1 },
    ])
    const existingId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(existingId)

    await importPhotoFiles(
      [tinyJpeg('existing.jpg', 1_700_000_000_000), tinyJpeg('brand-new.jpg')],
      { libraryBacked: false, listAlreadyEnqueued: true },
    )
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toHaveLength(2)
    })
    expect(getBookStoreSnapshot().book.gallery[0]).toBe(existingId)
  })

  it('listAlreadyEnqueued enqueues library identity for newly minted files', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()
    await importPhotoFiles([tinyJpeg('brand-new.jpg')], {
      libraryBacked: true,
      sourceRootId: 'root-new',
      listAlreadyEnqueued: true,
    })
    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery).toHaveLength(1)
      const assetId = book.gallery[0]
      assert.ok(assetId)
      expect(book.assets[assetId]?.sourceRootId).toBe('root-new')
      expect(book.assets[assetId]?.relativePath).toBe('brand-new.jpg')
    })
  })

  it('listAlreadyEnqueued reuses path placeholders in session (non-library)', async () => {
    // Session editor: isLibraryBacked() is false; path map must still bind thumbs.
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const { enqueueScannedGalleryList } =
      await import('./enqueueScannedGalleryList')
    enqueueScannedGalleryList('root-session', [
      { relativePath: 'shot.jpg', byteSize: 4, mtimeMs: 1 },
    ])
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(1)
    const existingId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(existingId)

    await importPhotoFiles([tinyJpeg('shot.jpg', 1_700_000_000_000)], {
      libraryBacked: false,
      listAlreadyEnqueued: true,
    })
    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery).toHaveLength(1)
      expect(book.gallery[0]).toBe(existingId)
    })
    expect(runImportBatch.mock.calls[0]?.[0]?.[0]?.assetId).toBe(existingId)
  })

  it('does not reuse by content when relativePath size or mtime differ', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x01])
    const file = new File([bytes], 'shot.jpg', {
      type: 'image/jpeg',
      lastModified: 42,
    })
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-photos',
    })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBe(1)
    })
    const assetId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(assetId)

    const folderFile = new File([bytes], 'shot.jpg', {
      type: 'image/jpeg',
      lastModified: 99,
    })
    Object.defineProperty(folderFile, 'webkitRelativePath', {
      value: 'Trip/shot.jpg',
    })
    await importPhotoFiles([folderFile], {
      libraryBacked: true,
      sourceRootId: 'root-folder',
    })
    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(2)
      expect(book.gallery).toContain(assetId)
    })
  })

  it('sums imported count for multiple path+size+mtime files', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const pathBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x10])
    const otherBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x20])
    const pathFile = new File([pathBytes], 'path.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    })
    const otherFile = new File([otherBytes], 'other.jpg', {
      type: 'image/jpeg',
      lastModified: 2,
    })
    await importPhotoFiles([pathFile, otherFile], {
      libraryBacked: true,
      sourceRootId: 'root-sum',
    })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBe(2)
    })

    const pathReuse = new File([pathBytes], 'path.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    })
    const otherReuse = new File([otherBytes], 'other.jpg', {
      type: 'image/jpeg',
      lastModified: 2,
    })
    const result = await importPhotoFiles([pathReuse, otherReuse], {
      libraryBacked: true,
      sourceRootId: 'root-sum-2',
    })
    expect(result.imported).toBe(2)
    expect(getBookStoreSnapshot().book.gallery.length).toBe(2)
  })

  it('keeps same-name files in different folders separate when bytes differ', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const a = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0xaa])],
      'x.jpg',
      {
        type: 'image/jpeg',
        lastModified: 1,
      },
    )
    Object.defineProperty(a, 'webkitRelativePath', { value: 'Trip/x.jpg' })
    const b = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0xbb])],
      'x.jpg',
      {
        type: 'image/jpeg',
        lastModified: 1,
      },
    )
    Object.defineProperty(b, 'webkitRelativePath', { value: 'Other/x.jpg' })

    await importPhotoFiles([a, b], {
      libraryBacked: true,
      sourceRootId: 'root-two',
    })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBe(2)
    })
  })

  it('mints a new asset when path size or mtime differ', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const first = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x11])],
      'a.jpg',
      { type: 'image/jpeg', lastModified: 1 },
    )
    await importPhotoFiles([first], {
      libraryBacked: true,
      sourceRootId: 'root-a',
    })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBe(1)
    })
    const firstId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(firstId)

    const second = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x22])],
      'a.jpg',
      { type: 'image/jpeg', lastModified: 2 },
    )
    Object.defineProperty(second, 'webkitRelativePath', {
      value: 'Trip/a.jpg',
    })
    await importPhotoFiles([second], {
      libraryBacked: true,
      sourceRootId: 'root-b',
    })
    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(2)
      expect(book.gallery).toContain(firstId)
    })
  })

  it('re-import reuses asset ids and restores thumbnails', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const file = tinyJpeg('dup.jpg', 42)
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-first',
    })

    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBe(1)
    })
    const assetId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(assetId)
    expect(getThumbUrl(assetId)).toBeDefined()
    expect(getBookStoreSnapshot().book.assets[assetId]?.sourceRootId).toBe(
      'root-first',
    )

    resetThumbCache()
    expect(getThumbUrl(assetId)).toBeUndefined()

    await vi.waitFor(() => {
      const asset = getBookStoreSnapshot().book.assets[assetId]
      expect(asset?.byteSize).toBeTypeOf('number')
      expect(asset?.mtimeMs).toBeTypeOf('number')
      expect(asset?.relativePath).toBeTypeOf('string')
    })
    const sameFile = tinyJpeg('dup.jpg', 42)
    await importPhotoFiles([sameFile], {
      libraryBacked: true,
      sourceRootId: 'root-second',
    })

    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(1)
      expect(book.gallery[0]).toBe(assetId)
      expect(getThumbUrl(assetId)).toBeDefined()
    })
    // Reused entry keeps the original identity root (no duplicate gallery slot).
    expect(getBookStoreSnapshot().book.assets[assetId]?.sourceRootId).toBe(
      'root-first',
    )
    await vi.waitFor(() => {
      expect(getRegisteredAssetSource('root-first')).toBeDefined()
    })
  })

  it('enqueues gallery and starts decode without a second full-body seed read', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    let bodyReads = 0
    const files = Array.from({ length: 8 }, (_, i) =>
      neverResolvingFile(`slow-${String(i).padStart(2, '0')}.jpg`, () => {
        bodyReads += 1
      }),
    )

    let batchStarted = false
    const seedSpy = vi.spyOn(seedLibraryImport, 'seedAndHashEntry')
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
            sourceBuffer?: ArrayBuffer
          }) => void
        },
      ) => {
        batchStarted = true
        expect(items.length).toBe(8)
        for (const item of items) {
          const sourceBuffer = new Uint8Array([1, 2, 3]).buffer
          options?.onResult?.({
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 10,
            correctedHeight: 10,
            orientation: 1,
            previewBuffer: new Uint8Array([9]).buffer,
            previewMimeType: 'image/webp',
            sourceBuffer,
          })
        }
        return Promise.resolve({ results: [], errors: [] })
      },
    )

    await importPhotoFiles(files, {
      libraryBacked: true,
      sourceRootId: 'root-slow',
    })

    await vi.waitFor(() => {
      expect(getGalleryIdsSnapshot().length).toBe(8)
    })
    expect(batchStarted).toBe(true)
    await vi.waitFor(() => {
      expect(seedSpy).toHaveBeenCalled()
    })
    expect(
      seedSpy.mock.calls.every((call) => call[0].bytes !== undefined),
    ).toBe(true)
    // Worker-provided bytes must skip File.arrayBuffer on the seed path.
    expect(bodyReads).toBe(0)
  })

  it('defaults libraryBacked from the session and mints a root-* id', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    await importPhotoFiles([tinyJpeg('auto.jpg')])

    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(1)
      const assetId = book.gallery[0]
      assert.ok(assetId)
      expect(book.assets[assetId]?.sourceRootId).toMatch(/^root-/)
      expect(book.assets[assetId]?.relativePath).toBe('auto.jpg')
    })
  })

  it('honours libraryBacked:true without an attached library', async () => {
    await importPhotoFiles([tinyJpeg('override.jpg')], {
      libraryBacked: true,
      sourceRootId: 'root-override',
    })

    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(1)
      const assetId = book.gallery[0]
      assert.ok(assetId)
      expect(book.assets[assetId]?.sourceRootId).toBe('root-override')
    })
  })

  it('does not seed body reads for session-only imports', async () => {
    await importPhotoFiles([tinyJpeg()], {
      libraryBacked: false,
      sourceRootId: 'root-should-not-seed',
    })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBe(1)
    })
    expect(getRegisteredAssetSource('root-should-not-seed')).toBeUndefined()
    const assetId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(assetId)
    expect(getBookStoreSnapshot().book.assets[assetId]?.sourceRootId).toBe(
      undefined,
    )
  })

  it('reports progress totals including rejects and sets importRunning', async () => {
    const jpeg = tinyJpeg('ok.jpg')
    const tiff = new File([new Uint8Array([1])], 'bad.tiff', {
      type: 'image/tiff',
    })
    let sawRunning = false
    let sawExpected = 0
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
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
        sawRunning = getBookStoreSnapshot().importRunning
        sawExpected = getBookStoreSnapshot().importExpectedCount
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 10,
            correctedHeight: 10,
            orientation: 1,
            previewBuffer: new Uint8Array([9]).buffer,
            previewMimeType: 'image/jpeg',
          }
          options?.onResult?.(result)
          return result
        })
        options?.onProgress?.({
          total: items.length,
          completed: items.length,
          errors: [],
          running: false,
        })
        return Promise.resolve({ results, errors: [] })
      },
    )
    const progress = vi.fn()
    const result = await importPhotoFiles([jpeg, tiff], {
      libraryBacked: true,
      sourceRootId: 'root-progress',
      onProgress: progress,
    })
    expect(result.errors).toHaveLength(1)
    expect(sawRunning).toBe(true)
    expect(sawExpected).toBe(2)
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 2,
        completed: 2,
        errors: expect.arrayContaining([
          expect.objectContaining({ name: 'bad.tiff' }),
        ]),
      }),
    )
    expect(runImportBatch.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ priority: 'prefetch' }),
    )
    const assetId = getBookStoreSnapshot().book.gallery[0]
    assert.ok(assetId)
    expect(getBookStoreSnapshot().sessionMeta.get(assetId)?.name).toBe('ok.jpg')
    expect(
      getBookStoreSnapshot().sessionMeta.get(assetId)?.correctedWidth,
    ).toBe(10)
  })

  it('enqueues placeholder meta before decode for new library assets', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    let metaAtBatch: { name?: string; correctedWidth?: number } | undefined
    runImportBatch.mockImplementation((items: { assetId: string }[]) => {
      const id = items[0]?.assetId
      assert.ok(id)
      metaAtBatch = getBookStoreSnapshot().sessionMeta.get(id)
      return Promise.resolve({ results: [], errors: [] })
    })

    await importPhotoFiles([tinyJpeg('ph.jpg')], {
      libraryBacked: true,
      sourceRootId: 'root-ph',
    })
    expect(metaAtBatch).toEqual(
      expect.objectContaining({
        name: 'ph.jpg',
        correctedWidth: 1,
        correctedHeight: 1,
        orientation: 1,
        aspect: 1,
      }),
    )
  })

  it('does not await prior hashes on the import hot path', async () => {
    const awaitSpy = vi
      .spyOn(pendingHashes, 'awaitPendingHashes')
      .mockResolvedValue()
    await importPhotoFiles([tinyJpeg('wait.jpg')], {
      libraryBacked: true,
      sourceRootId: 'root-wait',
    })
    expect(awaitSpy).not.toHaveBeenCalled()
    await importPhotoFiles([tinyJpeg('session.jpg')], {
      libraryBacked: false,
    })
    expect(awaitSpy).not.toHaveBeenCalled()
  })

  it('does not load jpeg head pass for PNG-only imports', async () => {
    const jpegHead = await import('./jpegHeadPass')
    const spy = vi
      .spyOn(jpegHead, 'runJpegHeadPass')
      .mockResolvedValue(undefined)
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'only.png', {
      type: 'image/png',
    })
    await importPhotoFiles([png], { libraryBacked: false })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 30)
    })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('loads jpeg head pass when the batch includes a JPEG', async () => {
    const jpegHead = await import('./jpegHeadPass')
    const spy = vi
      .spyOn(jpegHead, 'runJpegHeadPass')
      .mockResolvedValue(undefined)
    await importPhotoFiles([tinyJpeg('head.jpg')], { libraryBacked: false })
    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalled()
    })
    spy.mockRestore()
  })

  it('loads jpeg head pass for a mixed JPEG and PNG batch', async () => {
    const jpegHead = await import('./jpegHeadPass')
    const spy = vi
      .spyOn(jpegHead, 'runJpegHeadPass')
      .mockResolvedValue(undefined)
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'mix.png', {
      type: 'image/png',
    })
    await importPhotoFiles([png, tinyJpeg('mix.jpg')], {
      libraryBacked: false,
    })
    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalled()
    })
    spy.mockRestore()
  })

  it('skips library seed when decode result lacks relativePath identity', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()
    const seedSpy = vi.spyOn(seedLibraryImport, 'seedAndHashEntry')
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
            sourceBuffer?: ArrayBuffer
          }) => void
        },
      ) => {
        for (const item of items) {
          // Strip relativePath so applyImportResult must refuse to seed.
          const book = getBookStoreSnapshot().book
          const asset = book.assets[item.assetId]
          if (asset !== undefined) {
            delete (asset as { relativePath?: string }).relativePath
          }
          options?.onResult?.({
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 10,
            correctedHeight: 10,
            orientation: 1,
            previewBuffer: new Uint8Array([1]).buffer,
            previewMimeType: 'image/webp',
            sourceBuffer: new Uint8Array([2]).buffer,
          })
        }
        return Promise.resolve({ results: [], errors: [] })
      },
    )
    await importPhotoFiles([tinyJpeg('no-path.jpg')], {
      libraryBacked: true,
      sourceRootId: 'root-no-path',
    })
    expect(seedSpy).not.toHaveBeenCalled()
  })

  it('seeds without bytes when worker omits sourceBuffer', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()
    const seedSpy = vi
      .spyOn(seedLibraryImport, 'seedAndHashEntry')
      .mockResolvedValue(undefined)
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        for (const item of items) {
          options?.onResult?.({
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 10,
            correctedHeight: 10,
            orientation: 1,
            previewBuffer: new Uint8Array([1]).buffer,
            previewMimeType: 'image/webp',
          })
        }
        return Promise.resolve({ results: [], errors: [] })
      },
    )
    await importPhotoFiles([tinyJpeg('no-src.jpg')], {
      libraryBacked: true,
      sourceRootId: 'root-no-src',
    })
    await vi.waitFor(() => {
      expect(seedSpy).toHaveBeenCalled()
    })
    expect(
      seedSpy.mock.calls.every((call) => call[0].bytes === undefined),
    ).toBe(true)
  })

  it('does not seed deferred HEIC body reads during prefetch import', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()
    const seedSpy = vi.spyOn(seedLibraryImport, 'seedAndHashEntry')
    runImportBatch.mockResolvedValue({ results: [], errors: [] })
    const heic = new File([new Uint8Array([1, 2, 3])], 'defer.heic', {
      type: 'image/heic',
    })
    await importPhotoFiles([heic], {
      libraryBacked: true,
      sourceRootId: 'root-defer-seed',
    })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBe(1)
    })
    expect(seedSpy).not.toHaveBeenCalled()
  })

  it('does not seed library bytes when session HEIC decode completes', async () => {
    const seedSpy = vi.spyOn(seedLibraryImport, 'seedAndHashEntry')
    const heic = new File([new Uint8Array([1, 2, 3, 4])], 'sess.heic', {
      type: 'image/heic',
    })
    await importPhotoFiles([heic], { libraryBacked: false })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBe(1)
    })
    expect(seedSpy).not.toHaveBeenCalled()
  })

  it('seeds library bytes after lazy HEIC decode completes', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()
    const seedSpy = vi
      .spyOn(seedLibraryImport, 'seedAndHashEntry')
      .mockResolvedValue(undefined)
    const heic = new File([new Uint8Array([1, 2, 3, 4])], 'lazy.heic', {
      type: 'image/heic',
    })
    await importPhotoFiles([heic], {
      libraryBacked: true,
      sourceRootId: 'root-lazy-seed',
    })
    await vi.waitFor(() => {
      expect(seedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          relativePath: 'lazy.heic',
          sourceRootId: 'root-lazy-seed',
        }),
      )
    })
  })

  it('skips session meta when decode matches the 1×1 enqueue placeholder', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const patchSpy = vi.spyOn(
      await import('./folderManifestWrite'),
      'tryPatchManifestFromAsset',
    )

    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 1,
            correctedHeight: 1,
            orientation: 1,
            previewBuffer: new ArrayBuffer(4),
            previewMimeType: 'image/png',
          }
          options?.onResult?.(result)
          return result
        })
        return Promise.resolve({ results, errors: [] })
      },
    )

    const file = new File([new Uint8Array([1, 2, 3])], 'tiny.png', {
      type: 'image/png',
      lastModified: 1_700_000_000_333,
    })
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-1x1',
    })
    // Placeholder was already 1×1 / orientation 1 / same name — no refine write.
    expect(patchSpy).not.toHaveBeenCalled()
    patchSpy.mockRestore()
  })

  it('skips session meta and manifest writes when dims already match', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const patchSpy = vi.spyOn(
      await import('./folderManifestWrite'),
      'tryPatchManifestFromAsset',
    )

    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 100,
            correctedHeight: 50,
            orientation: 1,
            previewBuffer: new ArrayBuffer(4),
            previewMimeType: 'image/jpeg',
          }
          options?.onResult?.(result)
          return result
        })
        return Promise.resolve({ results, errors: [] })
      },
    )

    const file = tinyJpeg('same-dims.jpg', 1_700_000_000_222)
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-same-dims',
    })
    expect(patchSpy).toHaveBeenCalled()
    patchSpy.mockClear()

    // Re-import same identity: decode reports identical dims — skip meta/IDB.
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-same-dims',
    })
    expect(patchSpy).not.toHaveBeenCalled()
    patchSpy.mockRestore()
  })

  it('rewrites session meta when orientation changes on re-import', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const patchSpy = vi.spyOn(
      await import('./folderManifestWrite'),
      'tryPatchManifestFromAsset',
    )

    let importPass = 0
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        importPass += 1
        const orientation = importPass === 1 ? 1 : 6
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 100,
            correctedHeight: 50,
            orientation,
            previewBuffer: new ArrayBuffer(4),
            previewMimeType: 'image/jpeg',
          }
          options?.onResult?.(result)
          return result
        })
        return Promise.resolve({ results, errors: [] })
      },
    )

    const file = tinyJpeg('orient.jpg', 1_700_000_000_333)
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-orient',
    })
    patchSpy.mockClear()
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-orient',
    })
    expect(patchSpy).toHaveBeenCalled()
    const assetId = getBookStoreSnapshot().book.gallery[0]
    expect(assetId).toBeTruthy()
    expect(
      getBookStoreSnapshot().sessionMeta.get(assetId ?? '')?.orientation,
    ).toBe(6)
    patchSpy.mockRestore()
  })

  it('rewrites session meta when decoded width changes on re-import', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const patchSpy = vi.spyOn(
      await import('./folderManifestWrite'),
      'tryPatchManifestFromAsset',
    )

    let importPass = 0
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        importPass += 1
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: importPass === 1 ? 100 : 120,
            correctedHeight: 50,
            orientation: 1,
            previewBuffer: new ArrayBuffer(4),
            previewMimeType: 'image/jpeg',
          }
          options?.onResult?.(result)
          return result
        })
        return Promise.resolve({ results, errors: [] })
      },
    )

    const file = tinyJpeg('width-change.jpg', 1_700_000_000_555)
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-w',
    })
    patchSpy.mockClear()
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-w',
    })
    expect(patchSpy).toHaveBeenCalled()
    const assetId = getBookStoreSnapshot().book.gallery[0]
    expect(
      getBookStoreSnapshot().sessionMeta.get(assetId ?? '')?.correctedWidth,
    ).toBe(120)
    patchSpy.mockRestore()
  })

  it('rewrites session meta when decoded height changes on re-import', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const patchSpy = vi.spyOn(
      await import('./folderManifestWrite'),
      'tryPatchManifestFromAsset',
    )

    let importPass = 0
    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        importPass += 1
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 100,
            correctedHeight: importPass === 1 ? 50 : 80,
            orientation: 1,
            previewBuffer: new ArrayBuffer(4),
            previewMimeType: 'image/jpeg',
          }
          options?.onResult?.(result)
          return result
        })
        return Promise.resolve({ results, errors: [] })
      },
    )

    const file = tinyJpeg('height-change.jpg', 1_700_000_000_666)
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-h',
    })
    patchSpy.mockClear()
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-h',
    })
    expect(patchSpy).toHaveBeenCalled()
    const assetId = getBookStoreSnapshot().book.gallery[0]
    expect(
      getBookStoreSnapshot().sessionMeta.get(assetId ?? '')?.correctedHeight,
    ).toBe(80)
    patchSpy.mockRestore()
  })

  it('writes then skips when decode settles on a 1×N size', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const patchSpy = vi.spyOn(
      await import('./folderManifestWrite'),
      'tryPatchManifestFromAsset',
    )

    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            // 1×50 refine from enqueue 1×1; re-import with the same dims skips.
            correctedWidth: 1,
            correctedHeight: 50,
            orientation: 1,
            previewBuffer: new ArrayBuffer(4),
            previewMimeType: 'image/jpeg',
          }
          options?.onResult?.(result)
          return result
        })
        return Promise.resolve({ results, errors: [] })
      },
    )

    const file = tinyJpeg('placeholder-w.jpg', 1_700_000_000_444)
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-ph-w',
    })
    expect(patchSpy).toHaveBeenCalled()
    patchSpy.mockClear()
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-ph-w',
    })
    expect(patchSpy).not.toHaveBeenCalled()
    patchSpy.mockRestore()
  })

  it('writes then skips when decode settles on an N×1 size', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    const patchSpy = vi.spyOn(
      await import('./folderManifestWrite'),
      'tryPatchManifestFromAsset',
    )

    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 50,
            correctedHeight: 1,
            orientation: 1,
            previewBuffer: new ArrayBuffer(4),
            previewMimeType: 'image/jpeg',
          }
          options?.onResult?.(result)
          return result
        })
        return Promise.resolve({ results, errors: [] })
      },
    )

    const file = tinyJpeg('placeholder-h.jpg', 1_700_000_000_445)
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-ph-h',
    })
    expect(patchSpy).toHaveBeenCalled()
    patchSpy.mockClear()
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-ph-h',
    })
    expect(patchSpy).not.toHaveBeenCalled()
    patchSpy.mockRestore()
  })

  it('writes corrected dimensions into the folder manifest after decode', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    runImportBatch.mockImplementation(
      (
        items: { assetId: string; file: File }[],
        options?: {
          onResult?: (result: {
            assetId: string
            name: string
            correctedWidth: number
            correctedHeight: number
            orientation: number
            previewBuffer: ArrayBuffer
            previewMimeType: string
          }) => void
        },
      ) => {
        const results = items.map((item) => {
          const result = {
            assetId: item.assetId,
            name: item.file.name,
            correctedWidth: 640,
            correctedHeight: 480,
            orientation: 1,
            previewBuffer: new ArrayBuffer(8),
            previewMimeType: 'image/jpeg',
          }
          options?.onResult?.(result)
          return result
        })
        return Promise.resolve({ results, errors: [] })
      },
    )

    const file = tinyJpeg('dims.jpg', 1_700_000_000_111)
    await importPhotoFiles([file], {
      libraryBacked: true,
      sourceRootId: 'root-dims',
    })

    await vi.waitFor(async () => {
      const manifest = await getSourceRootEntryIndex('root-dims')
      expect(manifest.ok).toBe(true)
      assert.ok(manifest.ok)
      expect(manifest.value.entries['dims.jpg']).toEqual({
        byteSize: file.size,
        mtimeMs: file.lastModified,
        width: 640,
        height: 480,
        orientation: 1,
      })
    })
  })
})
