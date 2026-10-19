import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetScanWorker } from '../assets'
import { stubScanWorker } from '../assets/scanWorkerMock.test-helpers'
import {
  createMemoryLibraryStorage,
  createMemorySessionState,
} from '../project'
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
const hashContentMock = vi.hoisted(() =>
  vi.fn((buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf)
    return Promise.resolve(`hash-${[...bytes].join('.')}`)
  }),
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

vi.mock('../assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../assets')>()
  return {
    ...actual,
    hashContent: (buf: ArrayBuffer): Promise<string> => hashContentMock(buf),
  }
})

import { IMPORT_BODY_READ_CAP } from './importBodyReads'
import { importPhotoFiles } from './importPhotos'

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

  it('re-import via different relativePath reuses by content hash', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        terminate(): void {
          /* no-op */
        }
      },
    )
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
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.assets[assetId]?.contentHash).toBe(
        'hash-255.216.255.217.1',
      )
    })

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
      expect(book.gallery.length).toBe(1)
      expect(book.gallery[0]).toBe(assetId)
    })
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

  it('hash fallback mints a new asset when content does not match', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        terminate(): void {
          /* no-op */
        }
      },
    )
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
    await vi.waitFor(() => {
      expect(
        getBookStoreSnapshot().book.assets[firstId]?.contentHash,
      ).toBeTypeOf('string')
    })

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

  it('enqueues and starts decode before body reads finish; caps in-flight reads', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    let pendingReads = 0
    let peakPending = 0
    const files = Array.from({ length: 24 }, (_, i) =>
      neverResolvingFile(`slow-${String(i).padStart(2, '0')}.jpg`, () => {
        pendingReads += 1
        peakPending = Math.max(peakPending, pendingReads)
      }),
    )

    let batchStarted = false
    runImportBatch.mockImplementation((items: unknown[]) => {
      batchStarted = true
      expect(items.length).toBe(24)
      // Resolve decode immediately; capped body reads start afterward.
      return Promise.resolve({ results: [], errors: [] })
    })

    void importPhotoFiles(files, {
      libraryBacked: true,
      sourceRootId: 'root-slow',
    })

    await vi.waitFor(() => {
      expect(getGalleryIdsSnapshot().length).toBeGreaterThan(0)
    })
    await vi.waitFor(() => {
      expect(batchStarted).toBe(true)
    })
    await vi.waitFor(() => {
      expect(peakPending).toBeGreaterThan(0)
    })
    expect(
      peakPending,
      `observed peak in-flight body reads ${String(peakPending)}`,
    ).toBeLessThanOrEqual(IMPORT_BODY_READ_CAP)
    expect(pendingReads).toBeLessThanOrEqual(IMPORT_BODY_READ_CAP)
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
})
