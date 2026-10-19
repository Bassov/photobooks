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

vi.mock('../assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../assets')>()
  return {
    ...actual,
    hashContent: vi.fn((buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf)
      if (bytes[4] === 0xaa) {
        return Promise.resolve(SAMPLE_A)
      }
      return Promise.resolve(SAMPLE_B)
    }),
  }
})

describe('resolveByContentHash', () => {
  beforeEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetPendingHashesForTests()
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
    expect(result).toEqual([])
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
    expect(result).toHaveLength(1)
    expect(result[0]?.assetId).toBe('existing')
    expect(result[0]?.reused).toBe(true)
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
    expect(result).toHaveLength(1)
    expect(result[0]?.reused).toBe(false)
    expect(result[0]?.assetId).toBe(enqueued[0])
    expect(hashIndex.get(SAMPLE_B)).toBe(enqueued[0])
  })
})
