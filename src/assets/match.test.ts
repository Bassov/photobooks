import { describe, expect, it } from 'vitest'

import { matchAssets, type ScannedEntry } from './index'

const HASH_A =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const HASH_B =
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('matchAssets', () => {
  it('rejects a non-string sourceRootId', () => {
    expect(() =>
      matchAssets({}, [], {
        sourceRootId: null as unknown as string,
      }),
    ).toThrow(TypeError)
  })

  it('ignores content hash when path size or mtime differ', () => {
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

    expect(result.matched.has('a')).toBe(false)
    expect(result.statuses.get('a')).toBe('missing')
  })

  it('matches on path, size, and mtime', () => {
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

  it('matches path size mtime across a different source root (relink)', () => {
    const entries: ScannedEntry[] = [
      { relativePath: 'shot.jpg', byteSize: 4, mtimeMs: 42 },
    ]
    const result = matchAssets(
      {
        a: {
          sourceRootId: 'old-root',
          relativePath: 'shot.jpg',
          byteSize: 4,
          mtimeMs: 42,
        },
      },
      entries,
      { sourceRootId: 'relink-new' },
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

  it('reports modified when same path differs in size or mtime', () => {
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

  it('does not match hash-only records without path metadata', () => {
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

    expect(result.matched.size).toBe(0)
    expect(result.unmatchedAssetIds).toEqual(['a', 'b'])
  })

  it('metadata-matches across different source roots for relink', () => {
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

    expect(result.matched.get('a')).toEqual(entries[0])
    expect(result.statuses.get('a')).toBe('ok')
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

    expect(result.matched.get('a')).toEqual(entries[0])
    expect(result.statuses.get('a')).toBe('ok')
  })

  it('does not treat matching hashes as ok when size and mtime differ', () => {
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

    expect(result.matched.has('a')).toBe(false)
    expect(result.statuses.get('a')).toBe('modified')
  })

  it('skips status for empty records with no identity fields', () => {
    const result = matchAssets({ empty: {} }, [], { sourceRootId: 'root' })
    expect(result.statuses.has('empty')).toBe(false)
  })

  it('reports modified when size and mtime differ', () => {
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

  it('skips status when relativePath is absent', () => {
    const result = matchAssets(
      {
        a: { contentHash: undefined, relativePath: undefined },
      },
      [],
      { sourceRootId: 'root' },
    )
    expect(result.statuses.has('a')).toBe(false)
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
