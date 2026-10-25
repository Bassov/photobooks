import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFsaAssetSource,
  createMemoryAssetDirectory,
  resetScanWorker,
} from '../assets'
import { stubScanWorker } from '../assets/scanWorkerMock.test-helpers'
import { IMPORT_BODY_READ_CAP } from './importBodyReads'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  importFilesInBatches,
  importScannedEntriesInBatches,
} from './photoRootSession'
import * as importPhotos from './importPhotos'
import { resetPendingHashesForTests } from './pendingHashes'
import { detectMissingAssets } from './relink/detect'
import { isRelinkDialogOpen, resetRelinkStore } from './relink/statusStore'

describe('folderImportBatches', () => {
  beforeEach(() => {
    stubScanWorker()
    resetPendingHashesForTests()
    resetBookStore()
    resetRelinkStore()
  })

  afterEach(() => {
    resetScanWorker()
    resetPendingHashesForTests()
    resetBookStore()
    resetRelinkStore()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('importFilesInBatches is a no-op for an empty list', async () => {
    const onProgress = vi.fn()
    const onErrors = vi.fn()
    await expect(
      importFilesInBatches([], {
        sourceRootId: 'root',
        onProgress,
        onErrors,
      }),
    ).resolves.toEqual({ imported: 0, errors: [], skipped: 0 })
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('importFilesInBatches delegates to one chrome import', async () => {
    const spy = vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 2,
      errors: [],
      skipped: 0,
    })
    const files = [
      new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' }),
    ]
    const onProgress = vi.fn()
    const result = await importFilesInBatches(files, {
      sourceRootId: 'root',
      libraryBacked: true,
      onProgress,
      onErrors: vi.fn(),
    })
    expect(spy).toHaveBeenCalledOnce()
    expect(result.imported).toBe(2)
  })

  it('importScannedEntriesInBatches calls onFirstBatchYielded after the first yield', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('a.jpg', new Uint8Array([1]), 1)
    const source = createFsaAssetSource({
      rootId: 'root',
      directory: tree.root,
    })
    const scanned = await source.scanRoot('root')
    const entries = scanned.ok ? scanned.value : []
    vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 1,
      errors: [],
      skipped: 0,
    })
    const onFirstBatchYielded = vi.fn()
    await importScannedEntriesInBatches(tree.root, entries, {
      sourceRootId: 'root',
      onProgress: vi.fn(),
      onErrors: vi.fn(),
      onFirstBatchYielded,
    })
    expect(onFirstBatchYielded).toHaveBeenCalledOnce()
  })

  it('importScannedEntriesInBatches resolves then imports per batch', async () => {
    const tree = createMemoryAssetDirectory()
    tree.putFile('a.jpg', new Uint8Array([1]), 1)
    tree.putFile('b.jpg', new Uint8Array([2]), 2)
    const source = createFsaAssetSource({
      rootId: 'root',
      directory: tree.root,
    })
    const scanned = await source.scanRoot('root')
    expect(scanned).toEqual({
      ok: true,
      value: expect.arrayContaining([
        expect.objectContaining({ relativePath: 'a.jpg' }),
        expect.objectContaining({ relativePath: 'b.jpg' }),
      ]),
    })
    const entries = scanned.ok ? scanned.value : []
    const spy = vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 1,
      errors: [],
      skipped: 0,
    })
    const onProgress = vi.fn()
    const result = await importScannedEntriesInBatches(tree.root, entries, {
      sourceRootId: 'root',
      onProgress,
      onErrors: vi.fn(),
    })
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(result.imported).toBeGreaterThanOrEqual(1)
    expect(onProgress).toHaveBeenCalled()
    // Progressive import starts on the first resolve batch (not after full File[]).
    expect(spy.mock.calls[0]?.[1]).toMatchObject({
      source: 'folder',
      sourceRootId: 'root',
      manageImportRunning: false,
    })
  })

  it('holds importRunning across multi-batch waves so missing detect stays quiet', async () => {
    const tree = createMemoryAssetDirectory()
    const fileCount = IMPORT_BODY_READ_CAP + 1
    for (let i = 0; i < fileCount; i += 1) {
      tree.putFile(`f${String(i)}.jpg`, new Uint8Array([i + 1]), i + 1)
    }
    const source = createFsaAssetSource({
      rootId: 'root',
      directory: tree.root,
    })
    const scanned = await source.scanRoot('root')
    const entries = scanned.ok ? scanned.value : []
    expect(entries.length).toBe(fileCount)

    // List-first style: identity placeholders without session Files.
    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        gallery: ['pending'],
        assets: {
          pending: {
            relativePath: 'pending.jpg',
            sourceRootId: 'root',
          },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })

    const runningAtWave: boolean[] = []
    const dialogAtWave: boolean[] = []
    const spy = vi
      .spyOn(importPhotos, 'importPhotoFiles')
      .mockImplementation(() => {
        runningAtWave.push(getBookStoreSnapshot().importRunning)
        detectMissingAssets({ openDialog: true })
        dialogAtWave.push(isRelinkDialogOpen())
        return Promise.resolve({ imported: 1, errors: [], skipped: 0 })
      })

    await importScannedEntriesInBatches(tree.root, entries, {
      sourceRootId: 'root',
      onProgress: vi.fn(),
      onErrors: vi.fn(),
    })

    expect(spy.mock.calls.length).toBe(2)
    expect(runningAtWave).toEqual([true, true])
    expect(dialogAtWave).toEqual([false, false])
    expect(getBookStoreSnapshot().importRunning).toBe(false)
    for (const call of spy.mock.calls) {
      expect(call[1]).toMatchObject({ manageImportRunning: false })
    }

    // Idle + still unsourced identity → Missing UI may open again.
    detectMissingAssets({ openDialog: true })
    expect(isRelinkDialogOpen()).toBe(true)
  })
})
