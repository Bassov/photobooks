import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFsaAssetSource,
  createMemoryAssetDirectory,
  createMemoryAssetSource,
  resetScanWorker,
} from '../assets'
import { stubScanWorker } from '../assets/scanWorkerMock.test-helpers'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getAssetSource, resetAssetSources } from '../photo/assetSources'
import * as assetSources from '../photo/assetSources'
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
import {
  persistScannedEntryIndex,
  getSourceRootEntryIndex,
  putSourceRootEntryIndex,
} from '../project/session/sourceRootEntryIndex'

describe('startFolderRescan', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    stubScanWorker()
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

  it('enqueues from the folder manifest before scanRoot resolves', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const tree = createMemoryAssetDirectory()
    tree.putFile('early.jpg', new Uint8Array([1, 2]), 10)
    tree.putFile('late.jpg', new Uint8Array([3]), 11)
    const sourceRootId = 'root-manifest-first'
    const source = createFsaAssetSource({
      rootId: sourceRootId,
      directory: tree.root,
    })
    registerAssetSource(sourceRootId, source)

    await putSourceRootEntryIndex(sourceRootId, {
      version: 1,
      entries: {
        'early.jpg': {
          byteSize: 2,
          mtimeMs: 10,
          width: 400,
          height: 200,
          orientation: 1,
        },
        'gone.jpg': {
          byteSize: 1,
          mtimeMs: 1,
          width: 100,
          height: 100,
          orientation: 1,
        },
      },
    })

    let releaseScan!: () => void
    const scanGate = new Promise<void>((resolve) => {
      releaseScan = resolve
    })
    const realScan = source.scanRoot.bind(source)
    vi.spyOn(source, 'scanRoot').mockImplementation(async (rootId) => {
      await scanGate
      return realScan(rootId)
    })

    resetBookStore({
      book: makeBook({ gallery: [], assets: {} }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    const pending = startFolderRescan({ sourceRootId, runLazy: false })
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBeGreaterThan(0)
    })
    const beforeScan = getBookStoreSnapshot()
    expect(
      beforeScan.book.gallery.map(
        (id) => beforeScan.book.assets[id]?.relativePath,
      ),
    ).toEqual(expect.arrayContaining(['early.jpg', 'gone.jpg']))
    const earlyId = beforeScan.book.gallery.find(
      (id) => beforeScan.book.assets[id]?.relativePath === 'early.jpg',
    )
    expect(beforeScan.sessionMeta.get(earlyId ?? '')?.aspect).toBe(2)

    releaseScan()
    await pending
    await awaitFolderRescanForTests()

    const after = getBookStoreSnapshot()
    const paths = after.book.gallery.map(
      (id) => after.book.assets[id]?.relativePath,
    )
    expect(paths).toEqual(expect.arrayContaining(['early.jpg', 'late.jpg']))
    expect(paths).not.toContain('gone.jpg')
  })

  it('resets aspect for size/mtime-changed paths after scan', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const tree = createMemoryAssetDirectory()
    // Disk identity differs from manifest (changed).
    tree.putFile('shot.jpg', new Uint8Array([1, 2, 3]), 99)
    const sourceRootId = 'root-changed-aspect'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )
    await putSourceRootEntryIndex(sourceRootId, {
      version: 1,
      entries: {
        'shot.jpg': {
          byteSize: 2,
          mtimeMs: 10,
          width: 400,
          height: 100,
          orientation: 1,
        },
      },
    })
    resetBookStore({
      book: makeBook({
        gallery: ['a1'],
        assets: {
          a1: {
            sourceRootId,
            relativePath: 'shot.jpg',
            byteSize: 2,
            mtimeMs: 10,
          },
        },
      }),
      sessionMeta: new Map([
        [
          'a1',
          {
            name: 'shot.jpg',
            correctedWidth: 400,
            correctedHeight: 100,
            orientation: 1 as const,
            aspect: 4,
          },
        ],
      ]),
      importRunning: false,
      importExpectedCount: 0,
    })

    await startFolderRescan({ sourceRootId, runLazy: false })
    await awaitFolderRescanForTests()
    expect(getBookStoreSnapshot().sessionMeta.get('a1')?.aspect).toBe(1)
  })

  it('verifies each changed path once, taking the first gallery id per path', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('shot.jpg', new Uint8Array([1, 2, 3]), 99)
    tree.putFile('other.jpg', new Uint8Array([4, 5, 6]), 98)
    const sourceRootId = 'root-changed-once'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )
    await putSourceRootEntryIndex(sourceRootId, {
      version: 1,
      entries: {
        'shot.jpg': { byteSize: 2, mtimeMs: 10 },
        'other.jpg': { byteSize: 2, mtimeMs: 11 },
      },
    })
    resetBookStore({
      book: makeBook({
        gallery: ['in-root', 'loose-first', 'loose-second'],
        assets: {
          'in-root': {
            sourceRootId,
            relativePath: 'shot.jpg',
            byteSize: 2,
            mtimeMs: 10,
          },
          // Not tied to this root, so only the changed-path pass verifies it.
          'loose-first': { relativePath: 'other.jpg' },
          'loose-second': { relativePath: 'other.jpg' },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const retainSpy = vi.spyOn(assetSources, 'retainAssetSource')

    await startFolderRescan({ sourceRootId, runLazy: false })
    await awaitFolderRescanForTests()

    expect(retainSpy.mock.calls.map(([assetId]) => assetId)).toEqual([
      'in-root',
      'loose-first',
    ])
    expect(getBookStoreSnapshot().book.assets['loose-first']).toMatchObject({
      sourceRootId,
      byteSize: 3,
      mtimeMs: 98,
    })
  })

  it('always walks scanRoot even when a matching entry index already exists', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('shot.jpg', new Uint8Array([1, 2]), 10)
    const sourceRootId = 'root-always-walk'
    const source = createFsaAssetSource({
      rootId: sourceRootId,
      directory: tree.root,
    })
    registerAssetSource(sourceRootId, source)
    const scanSpy = vi.spyOn(source, 'scanRoot')
    await persistScannedEntryIndex(sourceRootId, [
      { relativePath: 'shot.jpg', byteSize: 2, mtimeMs: 10 },
    ])
    const prior = await getSourceRootEntryIndex(sourceRootId)
    expect(prior.ok).toBe(true)

    resetBookStore({
      book: makeBook({
        gallery: ['a1'],
        assets: {
          a1: {
            sourceRootId,
            relativePath: 'shot.jpg',
            byteSize: 2,
            mtimeMs: 10,
          },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    await startFolderRescan({ sourceRootId, runLazy: false })
    expect(scanSpy).toHaveBeenCalledWith(sourceRootId)
    await awaitFolderRescanForTests()
  })

  it('rehydrates prioritized assets and reuses matching metadata', async () => {
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
    await awaitFolderRescanForTests()
    expect(phases[0]).toBe('priority')
    // List-first flush puts unused scanned paths into gallery → priority verify
    // retains Files; no lazy import phase when every accepted path is planned.
    expect(phases.includes('lazy')).toBe(false)
    const lazyId = getBookStoreSnapshot().book.gallery.find(
      (id) =>
        getBookStoreSnapshot().book.assets[id]?.relativePath === 'lazy.jpg',
    )
    expect(getAssetSource(lazyId ?? '')?.name).toBe('lazy.jpg')
    expect(getFolderRescanProgress()).toBeNull()
  })

  it('updates identity when size/mtime differ without hashing', async () => {
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
    await vi.waitFor(() => {
      const asset = getBookStoreSnapshot().book.assets.a1
      expect(asset?.byteSize).toBe(3)
      expect(asset?.mtimeMs).toBe(99)
      expect(asset?.contentHash).toBeUndefined()
    })
  })

  it('lazy unused remainder does not stall awaitPendingHashes / Save', async () => {
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
          },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    const trackSpy = vi.spyOn(pendingHashes, 'trackHashJob')
    const pending = startFolderRescan({ sourceRootId, runLazy: true })
    await pending
    // Priority finished; rescan must not enqueue content-hash jobs.
    expect(trackSpy).not.toHaveBeenCalled()
    let saveDone = false
    const saveWait = awaitPendingHashes().then(() => {
      saveDone = true
    })
    await Promise.resolve()
    expect(saveDone).toBe(true)
    await saveWait
    await awaitFolderRescanForTests()
  })

  it('list-enqueues missing scanned paths into priority verify instead of lazy import', async () => {
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
    // After gallery flush-before-plan, new list-first rows are priority-verified
    // (File retain) rather than misclassified into lazy importPhotoFiles.
    expect(importSpy).not.toHaveBeenCalled()
    const paths = getBookStoreSnapshot().book.gallery.map(
      (id) => getBookStoreSnapshot().book.assets[id]?.relativePath,
    )
    expect(paths).toEqual(expect.arrayContaining(['used.jpg', 'missing.jpg']))
    expect(getAssetSource('u')?.name).toBe('used.jpg')
    const missingId = getBookStoreSnapshot().book.gallery.find(
      (id) =>
        getBookStoreSnapshot().book.assets[id]?.relativePath === 'missing.jpg',
    )
    expect(missingId).toBeDefined()
    expect(getAssetSource(missingId ?? '')?.name).toBe('missing.jpg')
  })

  it('unchanged priority verify skips readForHash and File.arrayBuffer', async () => {
    const fileCount = 32
    const tree = createMemoryAssetDirectory()
    const gallery: string[] = []
    const assets: Record<
      string,
      {
        sourceRootId: string
        relativePath: string
        byteSize: number
        mtimeMs: number
      }
    > = {}
    for (let i = 0; i < fileCount; i += 1) {
      const path = `shot-${String(i)}.jpg`
      const bytes = new Uint8Array([i + 1, i + 2])
      tree.putFile(path, bytes, 100 + i)
      const assetId = `a${String(i)}`
      gallery.push(assetId)
      assets[assetId] = {
        sourceRootId: 'root-skip-body',
        relativePath: path,
        byteSize: bytes.byteLength,
        mtimeMs: 100 + i,
      }
    }
    const sourceRootId = 'root-skip-body'
    const source = createFsaAssetSource({
      rootId: sourceRootId,
      directory: tree.root,
    })
    registerAssetSource(sourceRootId, source)
    const readSpy = vi.spyOn(source, 'readForHash')
    const arrayBufferSpy = vi.spyOn(File.prototype, 'arrayBuffer')

    resetBookStore({
      book: makeBook({ gallery, assets }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    await startFolderRescan({ sourceRootId, runLazy: false })
    await awaitFolderRescanForTests()

    expect(readSpy).not.toHaveBeenCalled()
    expect(arrayBufferSpy).not.toHaveBeenCalled()
    for (const assetId of gallery) {
      expect(getAssetSource(assetId)?.name).toMatch(/\.jpg$/)
    }
  })

  it('falls back to resolveFile with import-cap concurrency when the scan has no Files', async () => {
    const fileCount = 32
    const source = createMemoryAssetSource()
    const gallery: string[] = []
    const assets: Record<
      string,
      {
        sourceRootId: string
        relativePath: string
        byteSize: number
        mtimeMs: number
      }
    > = {}
    for (let i = 0; i < fileCount; i += 1) {
      const path = `p-${String(i)}.jpg`
      source.seedFile('root-conc', path, new Uint8Array([i]).buffer, i)
      const assetId = `p${String(i)}`
      gallery.push(assetId)
      assets[assetId] = {
        sourceRootId: 'root-conc',
        relativePath: path,
        byteSize: 1,
        mtimeMs: i,
      }
    }
    const sourceRootId = 'root-conc'
    registerAssetSource(sourceRootId, source)

    let inFlight = 0
    let peak = 0
    const realResolve = source.resolveFile.bind(source)
    vi.spyOn(source, 'resolveFile').mockImplementation(async (...args) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 5)
      })
      try {
        return await realResolve(...args)
      } finally {
        inFlight -= 1
      }
    })

    resetBookStore({
      book: makeBook({ gallery, assets }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    await startFolderRescan({ sourceRootId, runLazy: false })
    await awaitFolderRescanForTests()

    expect(peak).toBeGreaterThanOrEqual(8)
    expect(peak).toBeLessThanOrEqual(16)
    expect(gallery.filter((id) => getAssetSource(id) === undefined)).toEqual([])
  })

  it('flushes list-first gallery before priority plan so new paths are not lazy-imported', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        // Defer rAF so pending gallery would lag without awaitPendingGalleryFlush.
        queueMicrotask(() => {
          cb(0)
        })
        return 1
      },
    )
    const tree = createMemoryAssetDirectory()
    tree.putFile('new-a.jpg', new Uint8Array([1, 2]), 10)
    tree.putFile('new-b.jpg', new Uint8Array([3]), 11)
    const sourceRootId = 'root-flush-plan'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )
    resetBookStore({
      book: makeBook({ gallery: [], assets: {} }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const importSpy = vi
      .spyOn(importPhotos, 'importPhotoFiles')
      .mockResolvedValue({
        imported: 0,
        errors: [],
        skipped: 0,
      })

    await startFolderRescan({
      sourceRootId,
      directory: tree.root,
      runLazy: true,
    })
    await awaitFolderRescanForTests()

    expect(importSpy).not.toHaveBeenCalled()
    const paths = getBookStoreSnapshot().book.gallery.map(
      (id) => getBookStoreSnapshot().book.assets[id]?.relativePath,
    )
    expect(paths).toEqual(expect.arrayContaining(['new-a.jpg', 'new-b.jpg']))
    for (const id of getBookStoreSnapshot().book.gallery) {
      expect(getAssetSource(id)).toBeDefined()
    }
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
