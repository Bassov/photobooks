import { describe, expect, it } from 'vitest'

import { matchAssets, type ScannedEntry } from './index'

const HASH_A =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const HASH_B =
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('matchAssets', () => {
  it('prefers content hash even when path differs', () => {
    const entries: ScannedEntry[] = [
      {
        relativePath: 'moved/photo.jpg',
        byteSize: 10,
        mtimeMs: 1,
        contentHash: HASH_A,
      },
    ]

    const result = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'old/photo.jpg',
          byteSize: 99,
          mtimeMs: 2,
          contentHash: HASH_A,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.matched.get('a')).toEqual(entries[0])
    expect(result.unmatchedAssetIds).toEqual([])
    expect(result.unmatchedEntries).toEqual([])
    expect(result.statuses.get('a')).toBe('ok')
  })

  it('falls back to source root, path, size, and mtime', () => {
    const entries: ScannedEntry[] = [
      { relativePath: 'album/a.jpg', byteSize: 10, mtimeMs: 5 },
    ]

    const result = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.matched.get('a')).toEqual(entries[0])
    expect(result.statuses.get('a')).toBe('ok')
  })

  it('lists unmatched assets and entries', () => {
    const entries: ScannedEntry[] = [
      {
        relativePath: 'other.jpg',
        byteSize: 1,
        mtimeMs: 1,
        contentHash: HASH_B,
      },
    ]

    const result = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'a.jpg',
          byteSize: 1,
          mtimeMs: 1,
          contentHash: HASH_A,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.matched.size).toBe(0)
    expect(result.unmatchedAssetIds).toEqual(['a'])
    expect(result.unmatchedEntries).toEqual(entries)
    expect(result.statuses.get('a')).toBe('missing')
  })

  it('reports modified when same path differs in size mtime and hash', () => {
    const entries: ScannedEntry[] = [
      {
        relativePath: 'album/a.jpg',
        byteSize: 99,
        mtimeMs: 9,
        contentHash: HASH_B,
      },
    ]

    const result = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
          contentHash: HASH_A,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.statuses.get('a')).toBe('modified')
  })

  it('reports modified when path matches size mtime differ without both hashes', () => {
    const entries: ScannedEntry[] = [
      { relativePath: 'album/a.jpg', byteSize: 99, mtimeMs: 9 },
    ]

    const result = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
          contentHash: HASH_A,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.statuses.get('a')).toBe('modified')
  })

  it('reports modified when only size or only mtime matches on the same path', () => {
    const sameSize = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
        },
      },
      [{ relativePath: 'album/a.jpg', byteSize: 10, mtimeMs: 99 }],
      { sourceRootId: 'root' },
    )
    expect(sameSize.statuses.get('a')).toBe('modified')

    const sameMtime = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
        },
      },
      [{ relativePath: 'album/a.jpg', byteSize: 99, mtimeMs: 5 }],
      { sourceRootId: 'root' },
    )
    expect(sameMtime.statuses.get('a')).toBe('modified')
  })

  it('matches each hashed entry at most once', () => {
    const entries: ScannedEntry[] = [
      {
        relativePath: 'one.jpg',
        byteSize: 1,
        mtimeMs: 1,
        contentHash: HASH_A,
      },
    ]

    const result = matchAssets(
      {
        a: { contentHash: HASH_A },
        b: { contentHash: HASH_A },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.matched.size).toBe(1)
    expect(result.unmatchedAssetIds).toHaveLength(1)
  })

  it('does not metadata-match across different source roots', () => {
    const entries: ScannedEntry[] = [
      { relativePath: 'album/a.jpg', byteSize: 10, mtimeMs: 5 },
    ]

    const result = matchAssets(
      {
        a: {
          sourceRootId: 'other-root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.matched.size).toBe(0)
    expect(result.unmatchedAssetIds).toEqual(['a'])
    expect(result.statuses.has('a')).toBe(false)
  })

  it('reports ok for path+size+mtime when record has no sourceRootId', () => {
    const entries: ScannedEntry[] = [
      { relativePath: 'album/a.jpg', byteSize: 10, mtimeMs: 5 },
    ]

    const result = matchAssets(
      {
        a: {
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.matched.size).toBe(0)
    expect(result.statuses.get('a')).toBe('ok')
  })

  it('reports ok when path size mtime differ but hashes match after another asset took the hash pair', () => {
    const entries: ScannedEntry[] = [
      {
        relativePath: 'album/a.jpg',
        byteSize: 99,
        mtimeMs: 9,
        contentHash: HASH_A,
      },
    ]

    const result = matchAssets(
      {
        taken: { contentHash: HASH_A },
        a: {
          sourceRootId: 'root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
          contentHash: HASH_A,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )

    expect(result.matched.get('taken')).toEqual(entries[0])
    expect(result.matched.has('a')).toBe(false)
    expect(result.statuses.get('a')).toBe('ok')
  })

  it('skips status for empty records with no identity fields', () => {
    const result = matchAssets({ empty: {} }, [], { sourceRootId: 'root' })
    expect(result.statuses.has('empty')).toBe(false)
  })

  it('reports modified when neither side has a hash and size/mtime differ', () => {
    const result = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
        },
      },
      [{ relativePath: 'album/a.jpg', byteSize: 99, mtimeMs: 9 }],
      { sourceRootId: 'root' },
    )
    expect(result.statuses.get('a')).toBe('modified')
  })

  it('reports ok when size and mtime match even without hashes', () => {
    const entries: ScannedEntry[] = [
      { relativePath: 'album/a.jpg', byteSize: 10, mtimeMs: 5 },
    ]
    const result = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'album/a.jpg',
          byteSize: 10,
          mtimeMs: 5,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )
    expect(result.matched.get('a')).toEqual(entries[0])
    expect(result.statuses.get('a')).toBe('ok')
  })

  it('skips status for records that only have an empty contentHash skip path', () => {
    const result = matchAssets(
      {
        a: { contentHash: undefined, relativePath: undefined },
      },
      [],
      { sourceRootId: 'root' },
    )
    expect(result.statuses.has('a')).toBe(false)
  })

  it('does not reuse a used hashed entry for a second record', () => {
    const entries: ScannedEntry[] = [
      {
        relativePath: 'one.jpg',
        byteSize: 1,
        mtimeMs: 1,
        contentHash: HASH_A,
      },
      {
        relativePath: 'two.jpg',
        byteSize: 2,
        mtimeMs: 2,
        contentHash: HASH_A,
      },
    ]
    const result = matchAssets(
      {
        a: { contentHash: HASH_A },
        b: { contentHash: HASH_A },
      },
      entries,
      { sourceRootId: 'root' },
    )
    expect(result.matched.size).toBe(2)
    expect(result.matched.get('a')).toEqual(entries[0])
    expect(result.matched.get('b')).toEqual(entries[1])
  })

  it('skips metadata match when relativePath byteSize or mtimeMs is missing', () => {
    const entries: ScannedEntry[] = [
      { relativePath: 'album/a.jpg', byteSize: 10, mtimeMs: 5 },
    ]
    for (const record of [
      { sourceRootId: 'root', byteSize: 10, mtimeMs: 5 },
      { sourceRootId: 'root', relativePath: 'album/a.jpg', mtimeMs: 5 },
      { sourceRootId: 'root', relativePath: 'album/a.jpg', byteSize: 10 },
    ] as const) {
      const result = matchAssets({ a: record }, entries, {
        sourceRootId: 'root',
      })
      expect(result.matched.has('a')).toBe(false)
    }
  })

  it('keeps first path entry when duplicates share the same relative path', () => {
    const entries: ScannedEntry[] = [
      { relativePath: 'dup.jpg', byteSize: 1, mtimeMs: 1 },
      { relativePath: 'dup.jpg', byteSize: 9, mtimeMs: 9 },
    ]
    const result = matchAssets(
      {
        a: {
          sourceRootId: 'root',
          relativePath: 'dup.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
      entries,
      { sourceRootId: 'root' },
    )
    expect(result.matched.get('a')).toEqual(entries[0])
    expect(result.statuses.get('a')).toBe('ok')
  })
})
