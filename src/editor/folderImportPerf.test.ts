import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFsaAssetSource,
  createMemoryAssetDirectory,
  resetScanWorker,
} from '../assets'
import { stubScanWorker } from '../assets/scanWorkerMock.test-helpers'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { PERF_BUDGETS } from '../perf/budgets'
import {
  clearRegisteredAssetSources,
  registerAssetSource,
} from './assetSourceRegistry'
import { resetBookStore } from './bookStore'
import {
  awaitFolderRescanForTests,
  cancelFolderRescan,
  resetFolderRescanForTests,
  startFolderRescan,
  subscribeFolderRescanProgress,
} from './photoRootSession'
import { planRescanPriority } from './photoRootSession'
import { resetPendingHashesForTests } from './pendingHashes'

const LARGE_FOLDER_COUNT = 3200

describe('folder import / re-scan responsiveness', () => {
  beforeEach(() => {
    stubScanWorker()
    resetBookStore()
    clearRegisteredAssetSources()
    resetFolderRescanForTests()
    resetPendingHashesForTests()
  })

  afterEach(() => {
    resetFolderRescanForTests()
    resetScanWorker()
    clearRegisteredAssetSources()
    resetBookStore()
    resetPendingHashesForTests()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps priority scheduler slices under the long-task ceiling and orders used-in-book first', async () => {
    const tree = createMemoryAssetDirectory()
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    for (let i = 0; i < LARGE_FOLDER_COUNT; i += 1) {
      tree.putFile(
        `img-${String(i).padStart(4, '0')}.jpg`,
        bytes,
        1_700_000_000_000 + i,
      )
    }
    tree.putFile('used-visible.jpg', bytes, 1)
    tree.putFile('used-other.jpg', bytes, 2)

    const sourceRootId = 'root-large'
    registerAssetSource(
      sourceRootId,
      createFsaAssetSource({ rootId: sourceRootId, directory: tree.root }),
    )

    const visible = makeSpread({
      id: 'spread-0',
      frames: [makeFrame({ id: 'f0', assetId: 'asset-visible' })],
    })
    const book = makeBook({
      spreads: [visible],
      gallery: ['asset-visible', 'asset-other'],
      assets: {
        'asset-visible': {
          sourceRootId,
          relativePath: 'used-visible.jpg',
          byteSize: bytes.byteLength,
          mtimeMs: 1,
          contentHash: 'a'.repeat(64),
        },
        'asset-other': {
          sourceRootId,
          relativePath: 'used-other.jpg',
          byteSize: bytes.byteLength,
          mtimeMs: 2,
          contentHash: 'b'.repeat(64),
        },
      },
    })
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    expect(
      planRescanPriority({
        openBook: book,
        sourceRootId,
        visibleSpreadId: 'spread-0',
        otherBookAssets: [],
      }).map((ref) => ref.relativePath),
    ).toEqual(['used-visible.jpg', 'used-other.jpg'])

    const phases: string[] = []
    const longTasks: number[] = []
    let mark = 0
    let measuring = false
    let cancelledDuringPriority = false
    const unsubscribe = subscribeFolderRescanProgress((state) => {
      const now = performance.now()
      if (!measuring) {
        measuring = true
        mark = now
      } else {
        longTasks.push(now - mark)
        mark = now
      }
      if (state?.phase !== undefined) {
        phases.push(state.phase)
      }
      // List-first flush puts the whole folder into gallery → priority covers
      // unused paths too (no lazy phase). Cancel mid-priority once used-in-book
      // ordering has been scheduled and slices are measurable.
      if (
        state !== null &&
        state.phase === 'priority' &&
        state.completed >= 2 &&
        !cancelledDuringPriority
      ) {
        cancelledDuringPriority = true
        cancelFolderRescan()
      }
    })

    await startFolderRescan({
      sourceRootId,
      visibleSpreadId: 'spread-0',
      runLazy: true,
    })
    await awaitFolderRescanForTests()
    unsubscribe()

    const maxSlice = Math.max(0, ...longTasks)
    expect(maxSlice).toBeLessThanOrEqual(PERF_BUDGETS.scanSchedulerLongTaskMs)
    expect(phases.includes('priority')).toBe(true)
    expect(phases.includes('lazy')).toBe(false)
    expect(cancelledDuringPriority).toBe(true)
  }, 60_000)

  it('cancelFolderRescan stops a subsequent idle remainder', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('used.jpg', new Uint8Array([1]), 1)
    tree.putFile('lazy.jpg', new Uint8Array([2]), 2)
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

    const pending = startFolderRescan({ sourceRootId, runLazy: true })
    cancelFolderRescan()
    await pending
    await awaitFolderRescanForTests()
    expect(phases.includes('lazy')).toBe(false)
  })
})
