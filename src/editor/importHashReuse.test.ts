import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueGalleryAssets,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import { createBodyReadGate } from './importBodyReads'
import { resolveByContentHash } from './importHashReuse'
import {
  registerAssetSource,
  resetProjectSessionForTests,
} from './projectSession'
import { createMemoryAssetSource } from '../assets'
import { resetPendingHashesForTests } from './pendingHashes'

const SAMPLE_A =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SAMPLE_B =
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const SAMPLE_C =
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'

const hashContentMock = vi.hoisted(() =>
  vi.fn((buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf)
    if (bytes[4] === 0xaa) {
      return Promise.resolve(SAMPLE_A)
    }
    if (bytes[4] === 0xcc) {
      return Promise.resolve(SAMPLE_C)
    }
    return Promise.resolve(SAMPLE_B)
  }),
)

vi.mock('../assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../assets')>()
  return {
    ...actual,
    hashContent: (buf: ArrayBuffer) => hashContentMock(buf),
  }
})

describe('resolveByContentHash', () => {
  beforeEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetPendingHashesForTests()
    hashContentMock.mockClear()
    hashContentMock.mockImplementation((buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf)
      if (bytes[4] === 0xaa) {
        return Promise.resolve(SAMPLE_A)
      }
      if (bytes[4] === 0xcc) {
        return Promise.resolve(SAMPLE_C)
      }
      return Promise.resolve(SAMPLE_B)
    })
    vi.stubGlobal(
      'Worker',
      class {
        terminate(): void {
          /* no-op */
        }
      },
    )
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
  })

  afterEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetPendingHashesForTests()
    vi.unstubAllGlobals()
  })

  it('returns empty for an empty job list', async () => {
    const gate = createBodyReadGate(16)
    const result = await resolveByContentHash({
      jobs: [],
      hashIndex: new Map(),
      batchRootId: 'root',
      withBodyRead: gate.withBodyRead,
      enqueueNew: () => {
        throw new Error('enqueueNew must not run')
      },
    })
    expect(result).toEqual({ prepared: [], errors: [] })
  })

  it('reuses an existing id when contentHash matches', async () => {
    enqueueGalleryAssets([
      {
        assetId: 'existing',
        meta: {
          name: 'a.jpg',
          correctedWidth: 1,
          correctedHeight: 1,
          orientation: 1,
          aspect: 1,
        },
        asset: {
          sourceRootId: 'root-old',
          relativePath: 'a.jpg',
          byteSize: 5,
          mtimeMs: 1,
          contentHash: SAMPLE_A,
        },
      },
    ])
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toContain('existing')
    })
    registerAssetSource('root-old', createMemoryAssetSource())
    const gate = createBodyReadGate(16)
    const file = new File([new Uint8Array([1, 2, 3, 4, 0xaa])], 'a.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'Trip/a.jpg',
    })
    const enqueued: string[] = []
    const result = await resolveByContentHash({
      jobs: [{ file, relativePath: 'Trip/a.jpg', index: 0 }],
      hashIndex: new Map([[SAMPLE_A, 'existing']]),
      batchRootId: 'root-new',
      withBodyRead: gate.withBodyRead,
      enqueueNew: (entry) => {
        enqueued.push(entry.assetId)
      },
    })
    expect(enqueued).toEqual([])
    expect(result.errors).toEqual([])
    expect(result.prepared).toHaveLength(1)
    expect(result.prepared[0]?.assetId).toBe('existing')
    expect(result.prepared[0]?.reused).toBe(true)
  })

  it('mints and enqueues when contentHash is new', async () => {
    const gate = createBodyReadGate(16)
    const file = new File([new Uint8Array([1, 2, 3, 4, 0xbb])], 'b.jpg', {
      type: 'image/jpeg',
    })
    const hashIndex = new Map<string, string>()
    const enqueued: string[] = []
    const result = await resolveByContentHash({
      jobs: [{ file, relativePath: 'Trip/b.jpg', index: 0 }],
      hashIndex,
      batchRootId: 'root-new',
      withBodyRead: gate.withBodyRead,
      enqueueNew: (entry) => {
        enqueued.push(entry.assetId)
      },
    })
    expect(enqueued).toHaveLength(1)
    expect(result.errors).toEqual([])
    expect(result.prepared).toHaveLength(1)
    expect(result.prepared[0]?.reused).toBe(false)
    expect(result.prepared[0]?.assetId).toBe(enqueued[0])
    expect(hashIndex.get(SAMPLE_B)).toBe(enqueued[0])
  })

  it('seeds with a usable copy when hashContent detaches its input', async () => {
    hashContentMock.mockImplementation((buf: ArrayBuffer) => {
      const marker = new Uint8Array(buf)[4]
      // Mimic enqueueHash → worker.postMessage(..., [buffer]) transfer.
      structuredClone(buf, { transfer: [buf] })
      expect(() => buf.slice(0)).toThrow()
      if (marker === 0xaa) {
        return Promise.resolve(SAMPLE_A)
      }
      return Promise.resolve(SAMPLE_B)
    })

    const gate = createBodyReadGate(16)
    const file = new File([new Uint8Array([1, 2, 3, 4, 0xbb])], 'new.jpg', {
      type: 'image/jpeg',
    })
    const enqueued: string[] = []
    const result = await resolveByContentHash({
      jobs: [{ file, relativePath: 'new.jpg', index: 0 }],
      hashIndex: new Map(),
      batchRootId: 'root-new',
      withBodyRead: gate.withBodyRead,
      enqueueNew: (entry) => {
        enqueued.push(entry.assetId)
        // Prepared bytes must still be sliceable after hash transfer.
        expect(entry.bytes.byteLength).toBe(5)
        expect(() => entry.bytes.slice(0)).not.toThrow()
      },
    })
    expect(result.errors).toEqual([])
    expect(result.prepared).toHaveLength(1)
    expect(enqueued).toHaveLength(1)
    expect(result.prepared[0]?.bytes.byteLength).toBe(5)
  })

  it('records one failing job as an error and still prepares the others', async () => {
    const gate = createBodyReadGate(2)
    const goodA = new File([new Uint8Array([1, 2, 3, 4, 0xbb])], 'good-a.jpg', {
      type: 'image/jpeg',
    })
    const bad = new File([new Uint8Array([1, 2, 3, 4, 0xcc])], 'bad.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(bad, 'arrayBuffer', {
      value: () => Promise.reject(new Error('read failed')),
    })
    const goodB = new File([new Uint8Array([1, 2, 3, 4, 0xaa])], 'good-b.jpg', {
      type: 'image/jpeg',
    })
    const enqueued: string[] = []
    const result = await resolveByContentHash({
      jobs: [
        { file: goodA, relativePath: 'good-a.jpg', index: 0 },
        { file: bad, relativePath: 'bad.jpg', index: 1 },
        { file: goodB, relativePath: 'good-b.jpg', index: 2 },
      ],
      hashIndex: new Map(),
      batchRootId: 'root-new',
      withBodyRead: gate.withBodyRead,
      enqueueNew: (entry) => {
        enqueued.push(entry.file.name)
      },
    })
    expect(result.errors).toEqual([
      expect.objectContaining({
        name: 'bad.jpg',
        message: 'read failed',
        reason: 'decode-failed',
      }),
    ])
    expect(result.prepared).toHaveLength(2)
    expect(enqueued.sort()).toEqual(['good-a.jpg', 'good-b.jpg'])
  })

  it('maps a non-Error rejection to the generic import error message', async () => {
    const gate = createBodyReadGate(16)
    const bad = new File([new Uint8Array([1, 2, 3, 4, 0xcc])], 'odd.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(bad, 'arrayBuffer', {
      value: () =>
        new Promise<ArrayBuffer>((_resolve, reject) => {
          // Cover the non-Error catch branch (generic message).
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- intentional
          reject('not-an-error')
        }),
    })
    const result = await resolveByContentHash({
      jobs: [{ file: bad, relativePath: 'odd.jpg', index: 0 }],
      hashIndex: new Map(),
      batchRootId: 'root-new',
      withBodyRead: gate.withBodyRead,
      enqueueNew: () => {
        throw new Error('enqueueNew must not run')
      },
    })
    expect(result.prepared).toEqual([])
    expect(result.errors).toEqual([
      expect.objectContaining({
        name: 'odd.jpg',
        message: 'Content-hash resolve failed',
        reason: 'decode-failed',
      }),
    ])
  })
})
