import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetScanWorker } from '../../assets'
import { finalizeMemoryScanEntries } from '../../assets/scanWalk'
import { resetAssetPool } from '../../photo/assetPool'
import { getAssetSource, resetAssetSources } from '../../photo/assetSources'
import { resetPoolCoordination } from '../../photo/poolCoordination'
import { getBookStoreSnapshot, resetBookStore } from '../bookStore'
import { detectMissingAssets } from './detect'
import * as projectSession from '../projectSession'
import {
  clearPendingRelinkMatches,
  getPendingRelinkMatches,
  locateMissingAsset,
  rescanRelinkFiles,
  resolvePendingRelink,
} from './rescan'
import {
  getFoundRelinkIds,
  getRelinkProgress,
  getRelinkStatus,
  resetRelinkStore,
} from './statusStore'

const EMPTY_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function seedBook(gallery: string[], assets: Record<string, object>): void {
  resetBookStore({
    book: {
      ...getBookStoreSnapshot().book,
      gallery,
      assets,
    },
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function stubScanAndHashWorker(): void {
  class CombinedWorker {
    private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

    addEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void {
      const set = this.listeners.get(type) ?? new Set()
      set.add(listener)
      this.listeners.set(type, set)
    }

    removeEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void {
      this.listeners.get(type)?.delete(listener)
    }

    postMessage(data: {
      id: string
      kind?: 'directory' | 'memory-files'
      files?: readonly {
        relativePath: string
        byteSize: number
        mtimeMs: number
      }[]
      buffer?: ArrayBuffer
    }): void {
      let event: MessageEvent
      if (data.kind === 'memory-files' && data.files) {
        const entries = finalizeMemoryScanEntries(data.files)
        event = {
          data: { id: data.id, ok: true as const, entries },
        } as MessageEvent
      } else {
        event = {
          data: {
            id: data.id,
            ok: false as const,
            error: 'unexpected worker message',
          },
        } as MessageEvent
      }
      for (const listener of this.listeners.get('message') ?? []) {
        listener(event)
      }
    }

    terminate(): void {
      this.listeners.clear()
    }
  }
  vi.stubGlobal('Worker', CombinedWorker)
}

describe('rescanRelinkFiles', () => {
  beforeEach(() => {
    stubScanAndHashWorker()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      'relink-test-root' as `${string}-${string}-${string}-${string}-${string}`,
    )
  })

  afterEach(() => {
    clearPendingRelinkMatches()
    resetRelinkStore()
    resetAssetSources()
    resetBookStore()
    resetScanWorker()
    resetAssetPool()
    resetPoolCoordination()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('matches same path size and mtime and resolve reattaches Files', async () => {
    seedBook(['photo-a'], {
      'photo-a': {
        contentHash: EMPTY_HASH,
        relativePath: 'album/a.jpg',
        sourceRootId: 'relink-test-root',
        byteSize: 0,
        mtimeMs: 99,
      },
    })
    detectMissingAssets({ openDialog: false })
    expect(getRelinkStatus('photo-a')).toBe('missing')

    const file = new File([new Uint8Array()], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 99,
    })
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'album/a.jpg',
    })

    const result = await rescanRelinkFiles([file], {
      sourceRootId: 'relink-test-root',
    })

    expect(result.matched).toHaveLength(1)
    expect(getFoundRelinkIds().has('photo-a')).toBe(true)

    const applied = await resolvePendingRelink()
    expect(applied).toBe(1)
    expect(getAssetSource('photo-a')).toBe(file)
    expect(getBookStoreSnapshot().book.assets['photo-a']?.relativePath).toBe(
      'album/a.jpg',
    )
    expect(getRelinkStatus('photo-a')).toBeUndefined()
  })

  it('locate applies only when size and mtime match', async () => {
    seedBook(['photo-a'], {
      'photo-a': {
        relativePath: 'a.jpg',
        byteSize: 0,
        mtimeMs: 1,
      },
    })

    const mismatch = new File([new Uint8Array([1, 2, 3])], 'b.jpg', {
      type: 'image/jpeg',
      lastModified: 99,
    })
    await expect(locateMissingAsset('photo-a', mismatch)).resolves.toBe(
      'hash-mismatch',
    )
    expect(getAssetSource('photo-a')).toBeUndefined()

    const match = new File([new Uint8Array()], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    })
    await expect(locateMissingAsset('photo-a', match)).resolves.toBe('ok')
    expect(getAssetSource('photo-a')).toBe(match)
  })

  it('locate returns no-hash when the asset has no size/mtime', async () => {
    seedBook(['photo-a'], {
      'photo-a': { relativePath: 'a.jpg' },
    })
    const file = new File([new Uint8Array()], 'a.jpg', { type: 'image/jpeg' })
    await expect(locateMissingAsset('photo-a', file)).resolves.toBe('no-hash')
  })

  it('locate reuses pending sourceRootId when present', async () => {
    seedBook(['photo-a'], {
      'photo-a': {
        relativePath: 'old.jpg',
        byteSize: 0,
        mtimeMs: 1,
      },
    })
    // Non-matching path keeps pendingMatches with the chosen root id.
    await rescanRelinkFiles(
      [
        new File([new Uint8Array([9])], 'other.jpg', {
          type: 'image/jpeg',
          lastModified: 9,
        }),
      ],
      { sourceRootId: 'pending-root' },
    )
    expect(getPendingRelinkMatches()?.sourceRootId).toBe('pending-root')
    const match = new File([new Uint8Array()], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    })
    await expect(locateMissingAsset('photo-a', match)).resolves.toBe('ok')
    expect(getAssetSource('photo-a')).toBe(match)
    expect(getBookStoreSnapshot().book.assets['photo-a']?.sourceRootId).toBe(
      'pending-root',
    )
  })

  it('reports progress during rescan and resolve with no pending is zero', async () => {
    seedBook(['photo-a'], {
      'photo-a': {
        relativePath: 'a.jpg',
        sourceRootId: 'relink-progress',
        byteSize: 0,
        mtimeMs: 1,
      },
    })
    const register = vi.spyOn(projectSession, 'registerAssetSource')
    const progress: {
      total: number
      completed: number
      running: boolean
    }[] = []
    const file = new File([new Uint8Array()], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    })
    await rescanRelinkFiles([file], {
      sourceRootId: 'relink-progress',
      onProgress: (state) => {
        progress.push({ ...state })
      },
    })
    expect(register).toHaveBeenCalledWith('relink-progress', expect.anything())
    expect(progress[0]).toEqual({ total: 1, completed: 0, running: true })
    // Mid-scan ticks coalesce on rAF; terminal done always publishes.
    expect(progress.at(-1)).toEqual({
      total: 1,
      completed: 1,
      running: false,
    })
    expect(progress.some((p) => !p.running)).toBeTruthy()
    expect(getRelinkProgress()).toEqual({
      total: 1,
      completed: 1,
      running: false,
    })
    expect(getPendingRelinkMatches()?.matched.length).toBeGreaterThan(0)

    clearPendingRelinkMatches()
    expect(getPendingRelinkMatches()).toBeNull()
    expect(getFoundRelinkIds().size).toBe(0)
    await expect(resolvePendingRelink()).resolves.toBe(0)
  })

  it('defaults sourceRootId from crypto.randomUUID when omitted', async () => {
    seedBook(['photo-a'], {
      'photo-a': {
        relativePath: 'a.jpg',
        byteSize: 0,
        mtimeMs: 1,
      },
    })
    const file = new File([new Uint8Array()], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    })
    const result = await rescanRelinkFiles([file])
    expect(result.sourceRootId).toBe('relink-relink-test-root')
  })

  it('resolvePendingRelink applies matches and clears progress', async () => {
    seedBook(['photo-a'], {
      'photo-a': {
        relativePath: 'a.jpg',
        sourceRootId: 'relink-test-root',
        byteSize: 0,
        mtimeMs: 1,
      },
    })
    const file = new File([new Uint8Array()], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 1,
    })
    await rescanRelinkFiles([file], { sourceRootId: 'relink-test-root' })
    expect(getPendingRelinkMatches()?.matched).toHaveLength(1)
    const applied = await resolvePendingRelink()
    expect(applied).toBe(1)
    expect(getPendingRelinkMatches()).toBeNull()
    expect(getRelinkProgress()).toBeNull()
    expect(getRelinkStatus('photo-a')).toBeUndefined()
  })

  it('returns empty result when scanRoot fails', async () => {
    const { createMemoryAssetSource } = await import('../../assets')
    const failing = createMemoryAssetSource()
    failing.setPermissionRequired(true)
    vi.spyOn(
      await import('../../assets'),
      'createMemoryAssetSource',
    ).mockReturnValue(failing)

    seedBook(['photo-a'], {
      'photo-a': { contentHash: EMPTY_HASH, relativePath: 'a.jpg' },
    })
    const progress: { running: boolean; completed: number; total: number }[] =
      []
    const file = new File([new Uint8Array()], 'a.jpg', { type: 'image/jpeg' })
    const result = await rescanRelinkFiles([file], {
      sourceRootId: 'relink-test-root',
      onProgress: (state) => {
        progress.push({ ...state })
      },
    })
    expect(result.matched).toEqual([])
    expect(result.byAssetId.size).toBe(0)
    expect(getPendingRelinkMatches()?.matched).toEqual([])
    expect(progress.at(-1)).toEqual({
      total: 1,
      completed: 1,
      running: false,
    })
    await expect(resolvePendingRelink()).resolves.toBe(0)
  })

  it('indexes modified path hits by asset id', async () => {
    seedBook(['photo-a'], {
      'photo-a': {
        contentHash: EMPTY_HASH,
        relativePath: 'a.jpg',
        sourceRootId: 'relink-test-root',
        byteSize: 0,
        mtimeMs: 1,
      },
    })
    // Same path, different bytes → modified (hash differs, size/mtime differ).
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 99,
    })
    const result = await rescanRelinkFiles([file], {
      sourceRootId: 'relink-test-root',
    })
    expect(result.byAssetId.has('photo-a')).toBe(true)
  })

  it('keeps unscanned entries when readForHash fails', async () => {
    const assets = await import('../../assets')
    const source = assets.createMemoryAssetSource()
    vi.spyOn(source, 'readForHash').mockResolvedValue({
      ok: false as const,
      code: 'not-found',
    })
    vi.spyOn(assets, 'createMemoryAssetSource').mockReturnValue(source)

    seedBook(['photo-a'], {
      'photo-a': { contentHash: EMPTY_HASH, relativePath: 'a.jpg' },
    })
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const result = await rescanRelinkFiles([file], {
      sourceRootId: 'relink-test-root',
    })
    // Failed reads skip hashing; no content-hash match, but scan completed.
    expect(result.sourceRootId).toBe('relink-test-root')
    expect(result.matched).toEqual([])
    expect(getRelinkProgress()?.running).toBe(false)
    expect(getRelinkProgress()?.completed).toBe(1)
  })
})
