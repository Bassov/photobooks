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
  })
})
