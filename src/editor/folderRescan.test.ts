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
import { resetPendingHashesForTests } from './pendingHashes'

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
