import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '../core'
import {
  buildContentHashIndex,
  buildReuseIndex,
  createBodyReadGate,
  findReusableAssetId,
  findReusableAssetIdByContentHash,
  IMPORT_BODY_READ_CAP,
  mapWithConcurrency,
  relativePathFor,
  reuseIdentityKey,
} from './importBodyReads'

describe('relativePathFor', () => {
  it('prefers non-empty webkitRelativePath', () => {
    const file = new File([new Uint8Array([1])], 'leaf.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'album/leaf.jpg',
    })
    expect(relativePathFor(file)).toBe('album/leaf.jpg')
  })

  it('falls back to file.name when webkitRelativePath is empty', () => {
    const file = new File([new Uint8Array([1])], 'only.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(file, 'webkitRelativePath', { value: '' })
    expect(relativePathFor(file)).toBe('only.jpg')
  })

  it('falls back to file.name when webkitRelativePath is missing', () => {
    const file = new File([new Uint8Array([1])], 'plain.jpg', {
      type: 'image/jpeg',
    })
    expect(relativePathFor(file)).toBe('plain.jpg')
  })
})

describe('findReusableAssetId', () => {
  const gallery = ['a1', 'a2', 'missing'] as const
  const assets: Record<string, Asset | undefined> = {
    a1: {
      relativePath: 'a.jpg',
      byteSize: 10,
      mtimeMs: 100,
    },
    a2: {
      relativePath: 'b.jpg',
      byteSize: 20,
      mtimeMs: 200,
    },
    missing: undefined,
  }

  it('returns the matching gallery id', () => {
    expect(findReusableAssetId(gallery, assets, 'b.jpg', 20, 200)).toBe('a2')
  })

  it('skips undefined asset slots and continues', () => {
    expect(findReusableAssetId(gallery, assets, 'a.jpg', 10, 100)).toBe('a1')
  })

  it('requires path, size, and mtime all match', () => {
    expect(
      findReusableAssetId(gallery, assets, 'a.jpg', 10, 999),
    ).toBeUndefined()
    expect(
      findReusableAssetId(gallery, assets, 'a.jpg', 11, 100),
    ).toBeUndefined()
    expect(
      findReusableAssetId(gallery, assets, 'z.jpg', 10, 100),
    ).toBeUndefined()
  })

  it('returns undefined for an empty gallery', () => {
    expect(findReusableAssetId([], assets, 'a.jpg', 10, 100)).toBeUndefined()
  })

  it('buildReuseIndex skips incomplete identity and keeps the first id', () => {
    const index = buildReuseIndex(['a1', 'a2', 'a3'], {
      a1: { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 100 },
      a2: { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 100 },
      a3: { relativePath: 'c.jpg', byteSize: 1 },
    })
    expect(index.get(reuseIdentityKey('a.jpg', 10, 100))).toBe('a1')
    expect(index.has(reuseIdentityKey('c.jpg', 1, 0))).toBe(false)
  })

  it('buildReuseIndex skips when any of path, size, or mtime is missing', () => {
    const index = buildReuseIndex(['a', 'b', 'c'], {
      a: { byteSize: 1, mtimeMs: 1 },
      b: { relativePath: 'b.jpg', mtimeMs: 1 },
      c: { relativePath: 'c.jpg', byteSize: 1 },
    })
    expect(index.size).toBe(0)
  })

  it('buildContentHashIndex keeps the first id per hash and skips empty', () => {
    const index = buildContentHashIndex(['a1', 'a2', 'a3', 'a4', 'missing'], {
      a1: { contentHash: 'hhh' },
      a2: { contentHash: 'hhh' },
      a3: { contentHash: '' },
      a4: {},
      missing: undefined,
    })
    expect(index.get('hhh')).toBe('a1')
    expect(index.size).toBe(1)
    expect(
      findReusableAssetIdByContentHash(
        ['a1'],
        { a1: { contentHash: 'hhh' } },
        'hhh',
      ),
    ).toBe('a1')
    expect(
      findReusableAssetIdByContentHash(
        ['a1'],
        { a1: { contentHash: 'hhh' } },
        'nope',
      ),
    ).toBeUndefined()
  })
})

describe('createBodyReadGate', () => {
  it('caps concurrent body reads at the limit', async () => {
    const gate = createBodyReadGate(3)
    let pending = 0
    let peak = 0
    await Promise.all(
      Array.from({ length: 10 }, () =>
        gate.withBodyRead(async () => {
          pending += 1
          peak = Math.max(peak, pending)
          await Promise.resolve()
          pending -= 1
        }),
      ),
    )
    expect(peak).toBe(3)
    expect(gate.inFlight()).toBe(0)
  })
})

describe('mapWithConcurrency', () => {
  it('is a no-op for an empty list', async () => {
    const fn = vi.fn(() => Promise.resolve())
    await mapWithConcurrency([], 16, fn)
    expect(fn).not.toHaveBeenCalled()
  })

  it('caps in-flight work at concurrency', async () => {
    let pending = 0
    let peak = 0
    const items = Array.from({ length: 24 }, (_, i) => i)
    await mapWithConcurrency(items, IMPORT_BODY_READ_CAP, () => {
      pending += 1
      peak = Math.max(peak, pending)
      return Promise.resolve().then(() => {
        pending -= 1
      })
    })
    expect(peak).toBeLessThanOrEqual(IMPORT_BODY_READ_CAP)
    expect(peak).toBe(IMPORT_BODY_READ_CAP)
  })

  it('clamps concurrency below 1 up to 1', async () => {
    const seen: number[] = []
    await mapWithConcurrency([1, 2, 3], 0, (n) => {
      seen.push(n)
      return Promise.resolve()
    })
    expect(seen).toEqual([1, 2, 3])
  })

  it('runs every item exactly once', async () => {
    const seen: number[] = []
    await mapWithConcurrency([10, 20, 30], 2, (n) => {
      seen.push(n)
      return Promise.resolve()
    })
    expect(seen.sort((a, b) => a - b)).toEqual([10, 20, 30])
  })

  it('never invokes the worker with undefined when concurrency exceeds length', async () => {
    const seen: unknown[] = []
    await mapWithConcurrency([7, 8], 8, (n) => {
      seen.push(n)
      expect(typeof n).toBe('number')
      return Promise.resolve()
    })
    expect(seen).toEqual([7, 8])
  })
})
