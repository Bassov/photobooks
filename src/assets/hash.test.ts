import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetAssetPool } from '../photo/assetPool'
import {
  beginMetadataJob,
  endMetadataJob,
  resetPoolCoordination,
} from '../photo/poolCoordination'
import { computeSha256Hex } from './hashDigest'
import {
  hashContent,
  resolveContentHash,
  shouldReuseContentHash,
  type ScannedEntry,
} from './index'

const EMPTY_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function mockHashWorker(): void {
  class MockWorker {
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

    postMessage(data: { id: string; buffer?: ArrayBuffer; file?: File }): void {
      void (async () => {
        let payload:
          | { id: string; ok: true; hash: string }
          | {
              id: string
              ok: false
              error: string
            }
        if (data.buffer) {
          const hash = await computeSha256Hex(data.buffer)
          payload = { id: data.id, ok: true, hash }
        } else {
          payload = {
            id: data.id,
            ok: true,
            hash: EMPTY_HASH,
          }
        }
        const event = { data: payload } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event)
        }
      })()
    }

    terminate(): void {
      this.listeners.clear()
    }
  }
  vi.stubGlobal('Worker', MockWorker)
}

describe('hash helpers', () => {
  afterEach(() => {
    resetAssetPool()
    resetPoolCoordination()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reuses content hash when metadata matches', () => {
    const entry: ScannedEntry = {
      relativePath: 'a.jpg',
      byteSize: 3,
      mtimeMs: 10,
    }
    expect(
      shouldReuseContentHash(
        {
          sourceRootId: 'root',
          relativePath: 'a.jpg',
          byteSize: 3,
          mtimeMs: 10,
          contentHash: EMPTY_HASH,
        },
        entry,
        'root',
      ),
    ).toBe(true)
  })

  it.each([
    [
      'mtime',
      {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 3,
        mtimeMs: 10,
        contentHash: EMPTY_HASH,
      },
      { relativePath: 'a.jpg', byteSize: 3, mtimeMs: 11 },
      'root',
    ],
    [
      'byteSize',
      {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 3,
        mtimeMs: 10,
        contentHash: EMPTY_HASH,
      },
      { relativePath: 'a.jpg', byteSize: 4, mtimeMs: 10 },
      'root',
    ],
    [
      'relativePath',
      {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 3,
        mtimeMs: 10,
        contentHash: EMPTY_HASH,
      },
      { relativePath: 'b.jpg', byteSize: 3, mtimeMs: 10 },
      'root',
    ],
    [
      'sourceRootId',
      {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 3,
        mtimeMs: 10,
        contentHash: EMPTY_HASH,
      },
      { relativePath: 'a.jpg', byteSize: 3, mtimeMs: 10 },
      'other-root',
    ],
    [
      'missing hash',
      {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 3,
        mtimeMs: 10,
      },
      { relativePath: 'a.jpg', byteSize: 3, mtimeMs: 10 },
      'root',
    ],
    [
      'short hash',
      {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 3,
        mtimeMs: 10,
        contentHash: 'abcd',
      },
      { relativePath: 'a.jpg', byteSize: 3, mtimeMs: 10 },
      'root',
    ],
  ] as const)(
    'does not reuse when %s mismatches',
    (_label, record, entry, sourceRootId) => {
      expect(shouldReuseContentHash(record, entry, sourceRootId)).toBe(false)
    },
  )

  it('hashes through the worker pool', async () => {
    mockHashWorker()
    const hash = await hashContent(new ArrayBuffer(0))
    expect(hash).toBe(EMPTY_HASH)
  })

  it('waits for pending metadata before hashing', async () => {
    mockHashWorker()
    beginMetadataJob()
    let hashed = false
    const pending = hashContent(new ArrayBuffer(0)).then((hash) => {
      hashed = true
      return hash
    })
    await Promise.resolve()
    expect(hashed).toBe(false)
    endMetadataJob()
    await expect(pending).resolves.toBe(EMPTY_HASH)
    expect(hashed).toBe(true)
  })

  it('resolveContentHash skips read on fast path', async () => {
    mockHashWorker()
    let readCalls = 0
    const hash = await resolveContentHash({
      sourceRootId: 'root',
      record: {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 0,
        mtimeMs: 1,
        contentHash: EMPTY_HASH,
      },
      entry: { relativePath: 'a.jpg', byteSize: 0, mtimeMs: 1 },
      read: () => {
        readCalls += 1
        return Promise.resolve(new ArrayBuffer(0))
      },
    })
    expect(hash).toBe(EMPTY_HASH)
    expect(readCalls).toBe(0)
  })

  it('resolveContentHash reads when source root differs', async () => {
    mockHashWorker()
    let readCalls = 0
    const hash = await resolveContentHash({
      sourceRootId: 'other-root',
      record: {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 0,
        mtimeMs: 1,
        contentHash: EMPTY_HASH,
      },
      entry: { relativePath: 'a.jpg', byteSize: 0, mtimeMs: 1 },
      read: () => {
        readCalls += 1
        return Promise.resolve(new ArrayBuffer(0))
      },
    })
    expect(hash).toBe(EMPTY_HASH)
    expect(readCalls).toBe(1)
  })

  it('resolveContentHash reads and hashes when metadata differs', async () => {
    mockHashWorker()
    let readCalls = 0
    const hash = await resolveContentHash({
      sourceRootId: 'root',
      record: {
        sourceRootId: 'root',
        relativePath: 'a.jpg',
        byteSize: 0,
        mtimeMs: 1,
        contentHash: EMPTY_HASH,
      },
      entry: { relativePath: 'a.jpg', byteSize: 0, mtimeMs: 2 },
      read: () => {
        readCalls += 1
        return Promise.resolve(new ArrayBuffer(0))
      },
    })
    expect(hash).toBe(EMPTY_HASH)
    expect(readCalls).toBe(1)
  })
})
