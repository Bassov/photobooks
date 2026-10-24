import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  cacheKeyFromIdentity,
  identityKeyString,
  tryCacheKeyFromAsset,
} from './cacheKey'
import { sha256HexSync } from './sha256Sync'

describe('cacheKeyFromIdentity', () => {
  it('matches Node crypto SHA-256 of the canonical string', () => {
    const identity = {
      sourceRootId: 'root-a',
      relativePath: 'photos/a.jpg',
      byteSize: 100,
      mtimeMs: 1234,
    }
    const canonical = identityKeyString(identity)
    const expected = createHash('sha256')
      .update(canonical, 'utf8')
      .digest('hex')
    expect(sha256HexSync(canonical)).toBe(expected)
    expect(cacheKeyFromIdentity(identity)).toBe(expected)
    expect(cacheKeyFromIdentity(identity)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes when size or mtime changes', () => {
    const base = {
      sourceRootId: 'root-a',
      relativePath: 'a.jpg',
      byteSize: 10,
      mtimeMs: 1,
    }
    const a = cacheKeyFromIdentity(base)
    const b = cacheKeyFromIdentity({ ...base, byteSize: 11 })
    const c = cacheKeyFromIdentity({ ...base, mtimeMs: 2 })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
    expect(b).not.toBe(c)
  })

  it('tryCacheKeyFromAsset returns undefined when identity is incomplete', () => {
    expect(tryCacheKeyFromAsset({})).toBeUndefined()
    expect(
      tryCacheKeyFromAsset({
        sourceRootId: 'r',
        relativePath: 'a.jpg',
        byteSize: 1,
      }),
    ).toBeUndefined()
    expect(
      tryCacheKeyFromAsset({
        sourceRootId: 'r',
        relativePath: 'a.jpg',
        byteSize: 1,
        mtimeMs: 2,
      }),
    ).toMatch(/^[0-9a-f]{64}$/)
  })
})
