import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_KEY_MEMO_MAX, cacheKeyFromIdentity } from './cacheKey'
import { sha256HexSync } from './sha256Sync'

vi.mock('./sha256Sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sha256Sync')>()
  return { sha256HexSync: vi.fn(actual.sha256HexSync) }
})

const hashSpy = vi.mocked(sha256HexSync)

function identity(tag: string, index = 0) {
  return {
    sourceRootId: `root-${tag}`,
    relativePath: `p/${String(index)}.jpg`,
    byteSize: 10,
    mtimeMs: 1,
  }
}

function nodeDigest(id: ReturnType<typeof identity>): string {
  return createHash('sha256')
    .update(
      `${id.sourceRootId}\n${id.relativePath}\n${String(id.byteSize)}\n${String(id.mtimeMs)}`,
    )
    .digest('hex')
}

describe('cacheKeyFromIdentity memo', () => {
  beforeEach(() => {
    hashSpy.mockClear()
  })

  it('hashes an identity once and serves repeats from the memo', () => {
    const id = identity('repeat')

    const first = cacheKeyFromIdentity(id)
    const second = cacheKeyFromIdentity({ ...id })

    expect(first).toBe(nodeDigest(id))
    expect(second).toBe(first)
    expect(hashSpy).toHaveBeenCalledTimes(1)
  })

  it('hashes a changed identity again', () => {
    const id = identity('changed')
    cacheKeyFromIdentity(id)

    const touched = cacheKeyFromIdentity({ ...id, mtimeMs: 2 })

    expect(touched).toBe(nodeDigest({ ...id, mtimeMs: 2 }))
    expect(hashSpy).toHaveBeenCalledTimes(2)
  })

  it('drops only the oldest digest once the memo is full', () => {
    for (let i = 0; i < CACHE_KEY_MEMO_MAX; i += 1) {
      cacheKeyFromIdentity(identity('fill', i))
    }
    hashSpy.mockClear()

    // One more identity evicts the oldest entry only.
    cacheKeyFromIdentity(identity('fill', CACHE_KEY_MEMO_MAX))
    expect(cacheKeyFromIdentity(identity('fill', CACHE_KEY_MEMO_MAX - 1))).toBe(
      nodeDigest(identity('fill', CACHE_KEY_MEMO_MAX - 1)),
    )
    expect(hashSpy).toHaveBeenCalledTimes(1)

    const evicted = identity('fill', 0)
    expect(cacheKeyFromIdentity(evicted)).toBe(nodeDigest(evicted))
    expect(hashSpy).toHaveBeenCalledTimes(2)
  })
})
