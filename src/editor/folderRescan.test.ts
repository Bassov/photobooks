import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as assets from '../assets'
import {
  createFsaAssetSource,
  createMemoryAssetDirectory,
  resetScanWorker,
} from '../assets'
import { stubScanWorker } from '../assets/scanWorkerMock.test-helpers'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getAssetSource, resetAssetSources } from '../photo/assetSources'
import {
  clearRegisteredAssetSources,
  registerAssetSource,
} from './assetSourceRegistry'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  awaitFolderRescanForTests,
  cancelFolderRescan,
  getFolderRescanProgress,
  resetFolderRescanForTests,
  startFolderRescan,
  subscribeFolderRescanProgress,
} from './photoRootSession'
import * as importPhotos from './importPhotos'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'
import * as pendingHashes from './pendingHashes'

describe('startFolderRescan', () => {
  beforeEach(() => {
    stubScanWorker()
    vi.spyOn(assets, 'hashContent').mockResolvedValue('c'.repeat(64))
    resetBookStore()
    clearRegisteredAssetSources()
    resetAssetSources()
    resetFolderRescanForTests()
    resetPendingHashesForTests()
  })

  afterEach(() => {
    resetFolderRescanForTests()
    resetScanWorker()
    clearRegisteredAssetSources()
    resetAssetSources()
    resetBookStore()
    resetPendingHashesForTests()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('no-ops when the source root is unregistered', async () => {
    await startFolderRescan({ sourceRootId: 'missing', runLazy: false })
    expect(getFolderRescanProgress()).toBeNull()
  })

  it('no-ops when scanRoot fails', async () => {
    const tree = createMemoryAssetDirectory()
    const source = createFsaAssetSource({
      rootId: 'root',
      directory: tree.root,
    })
    source.setPermissionRequired(true)
    registerAssetSource('root', source)
    await startFolderRescan({ sourceRootId: 'root', runLazy: false })
    expect(getFolderRescanProgress()).toBeNull()
  })

  it('rehydrates prioritized assets and reuses matching hashes', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('used.jpg', new Uint8Array([9, 9]), 42)
    tree.putFile('lazy.jpg', new Uint8Array([1]), 1)
    const sourceRootId = 'root-dir'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )

    resetBookStore({
      book: makeBook({
        spreads: [
          makeSpread({
            id: 's0',
            frames: [makeFrame({ assetId: 'u' })],
          }),
        ],
        gallery: ['u'],
        assets: {
          u: {
            sourceRootId,
            relativePath: 'used.jpg',
            byteSize: 2,
            mtimeMs: 42,
            contentHash: 'a'.repeat(64),
          },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    const phases: string[] = []
    subscribeFolderRescanProgress((state) => {
      if (state?.phase !== undefined) {
        phases.push(state.phase)
      }
    })

    await startFolderRescan({ sourceRootId, runLazy: true })
    expect(getAssetSource('u')?.name).toBe('used.jpg')
    expect(assets.hashContent).not.toHaveBeenCalled()
    await awaitFolderRescanForTests()
    expect(phases[0]).toBe('priority')
    expect(phases.includes('lazy')).toBe(true)
    expect(getFolderRescanProgress()).toBeNull()
  })

  it('rehashes when size/mtime differ', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('shot.jpg', new Uint8Array([1, 2, 3]), 99)
    const sourceRootId = 'root-src'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )
    resetBookStore({
      book: makeBook({
        gallery: ['a1'],
        assets: {
          a1: {
            sourceRootId,
            relativePath: 'shot.jpg',
            byteSize: 1,
            mtimeMs: 1,
            contentHash: 'b'.repeat(64),
          },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    await startFolderRescan({ sourceRootId, runLazy: false })
    expect(getAssetSource('a1')?.name).toBe('shot.jpg')
    expect(assets.hashContent).toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.assets.a1?.contentHash).toBe(
        'c'.repeat(64),
      )
    })
  })

  it('lazy unused hashing does not stall awaitPendingHashes / Save', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('used.jpg', new Uint8Array([9, 9]), 42)
    tree.putFile('lazy.jpg', new Uint8Array([1]), 1)
    const sourceRootId = 'root-save'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )
    resetBookStore({
      book: makeBook({
        gallery: ['u'],
        assets: {
          u: {
            sourceRootId,
            relativePath: 'used.jpg',
            byteSize: 2,
            mtimeMs: 42,
            contentHash: 'a'.repeat(64),
          },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    let releaseLazy!: () => void
    const lazyHang = new Promise<string>((resolve) => {
      releaseLazy = () => {
        resolve('d'.repeat(64))
      }
    })
    const trackSpy = vi.spyOn(pendingHashes, 'trackHashJob')
    vi.spyOn(assets, 'hashContent').mockImplementation(async (bytes) => {
      // Priority path reuses hash when size/mtime match; lazy still hashes.
      if (bytes.byteLength === 1) {
        return lazyHang
      }
      return 'c'.repeat(64)
    })

    const pending = startFolderRescan({ sourceRootId, runLazy: true })
    await pending
    // Priority finished; lazy hash may still be in flight but must not be tracked.
    expect(trackSpy).not.toHaveBeenCalled()
    let saveDone = false
    const saveWait = awaitPendingHashes().then(() => {
      saveDone = true
    })
    await Promise.resolve()
    expect(saveDone).toBe(true)
    await saveWait
    releaseLazy()
    await awaitFolderRescanForTests()
  })

  it('continues importing scanned paths missing from the open gallery', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('used.jpg', new Uint8Array([9, 9]), 42)
    tree.putFile('missing.jpg', new Uint8Array([3, 3]), 3)
    const sourceRootId = 'root-continue'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )
    resetBookStore({
      book: makeBook({
        gallery: ['u'],
        assets: {
          u: {
            sourceRootId,
            relativePath: 'used.jpg',
            byteSize: 2,
            mtimeMs: 42,
            contentHash: 'a'.repeat(64),
          },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const importSpy = vi
      .spyOn(importPhotos, 'importPhotoFiles')
      .mockResolvedValue({
        imported: 1,
        errors: [],
        skipped: 0,
      })

    await startFolderRescan({
      sourceRootId,
      directory: tree.root,
      runLazy: true,
    })
    await awaitFolderRescanForTests()
    expect(importSpy).toHaveBeenCalled()
    const importedFiles = importSpy.mock.calls.flatMap((call) => call[0])
    // Memory directory Files use a generic name; assert we imported the one
    // missing path (not the already-gallery used.jpg) as a single-file batch.
    expect(importedFiles).toHaveLength(1)
    expect(importSpy.mock.calls[0]?.[1]).toMatchObject({
      source: 'folder',
      sourceRootId,
      libraryBacked: true,
    })
  })

  it('cancel during priority prevents lazy phase', async () => {
    const tree = createMemoryAssetDirectory()
    for (let i = 0; i < 20; i += 1) {
      tree.putFile(`f${String(i)}.jpg`, new Uint8Array([i]), i)
    }
    tree.putFile('used.jpg', new Uint8Array([9]), 1)
    const sourceRootId = 'root-cancel'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )
    resetBookStore({
      book: makeBook({
        gallery: ['u'],
        assets: {
          u: {
            sourceRootId,
            relativePath: 'used.jpg',
            byteSize: 1,
            mtimeMs: 1,
            contentHash: 'a'.repeat(64),
          },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    const phases: string[] = []
    subscribeFolderRescanProgress((state) => {
      if (state?.phase !== undefined) {
        phases.push(state.phase)
      }
      if (state?.phase === 'priority') {
        cancelFolderRescan()
      }
    })

    await startFolderRescan({ sourceRootId, runLazy: true })
    await awaitFolderRescanForTests()
    expect(phases.includes('lazy')).toBe(false)
  })
})
