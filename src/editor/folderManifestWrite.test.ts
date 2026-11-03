import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSourceRootEntryIndex } from '../project/session/sourceRootEntryIndex'
import {
  tryMarkManifestDecodeFailed,
  tryPatchManifestFromAsset,
} from './folderManifestWrite'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})

describe('tryPatchManifestFromAsset', () => {
  it('schedules a write for a complete identity asset', async () => {
    const scheduled = tryPatchManifestFromAsset(
      {
        sourceRootId: 'root-1',
        relativePath: 'a.jpg',
        byteSize: 10,
        mtimeMs: 2,
      },
      { width: 100, height: 50, orientation: 1 },
    )
    expect(scheduled).toBe(true)
    await vi.waitFor(async () => {
      const got = await getSourceRootEntryIndex('root-1')
      expect(got.ok && got.value.entries['a.jpg']).toEqual({
        byteSize: 10,
        mtimeMs: 2,
        width: 100,
        height: 50,
        orientation: 1,
      })
    })
  })

  it.each([
    [undefined, { width: 1, height: 1, orientation: 1 }],
    [{}, { width: 1, height: 1, orientation: 1 }],
    [
      { sourceRootId: '', relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 },
      { width: 1, height: 1, orientation: 1 },
    ],
    [
      {
        sourceRootId: 'r',
        relativePath: '',
        byteSize: 1,
        mtimeMs: 1,
      },
      { width: 1, height: 1, orientation: 1 },
    ],
    [
      {
        sourceRootId: 'r',
        relativePath: 'a.jpg',
        byteSize: 1,
      },
      { width: 1, height: 1, orientation: 1 },
    ],
    [
      {
        sourceRootId: 'r',
        relativePath: 'a.jpg',
        byteSize: 1,
        mtimeMs: 1,
      },
      { width: 0, height: 1, orientation: 1 },
    ],
    [
      {
        sourceRootId: 'r',
        relativePath: 'a.jpg',
        byteSize: 1,
        mtimeMs: 1,
      },
      { width: 1, height: 1, orientation: 9 },
    ],
  ] as const)('rejects incomplete identity or dims %#', (asset, dims) => {
    expect(tryPatchManifestFromAsset(asset, dims)).toBe(false)
  })
})

describe('tryMarkManifestDecodeFailed', () => {
  it('marks the identity as decode-failed in the folder manifest', async () => {
    const scheduled = tryMarkManifestDecodeFailed({
      sourceRootId: 'root-bad',
      relativePath: 'broken.jpg',
      byteSize: 12,
      mtimeMs: 3,
    })
    expect(scheduled).toBe(true)
    await vi.waitFor(async () => {
      const got = await getSourceRootEntryIndex('root-bad')
      expect(got.ok && got.value.entries['broken.jpg']).toEqual({
        byteSize: 12,
        mtimeMs: 3,
        decodeFailed: true,
      })
    })
  })

  it.each([
    undefined,
    {},
    { sourceRootId: '', relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 },
    { sourceRootId: 'r', relativePath: '', byteSize: 1, mtimeMs: 1 },
    { sourceRootId: 'r', relativePath: 'a.jpg', mtimeMs: 1 },
  ] as const)('skips an incomplete identity %#', (asset) => {
    expect(tryMarkManifestDecodeFailed(asset)).toBe(false)
  })
})
