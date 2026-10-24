import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScannedEntry } from '../../assets'
import type { SessionIdb } from './idb'
import {
  clearSourceRootEntryIndex,
  diffEntryIndex,
  entryIndexFromScanned,
  FOLDER_MANIFEST_VERSION,
  getSourceRootEntryIndex,
  parseFolderManifest,
  patchManifestDimensions,
  persistScannedEntryIndex,
  putSourceRootEntryIndex,
  type SourceRootEntryIndex,
} from './sourceRootEntryIndex'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})

const scanned: ScannedEntry[] = [
  { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 },
  { relativePath: 'b.jpg', byteSize: 20, mtimeMs: 2 },
]

function memoryIdb(
  initial?: Record<string, unknown>,
): SessionIdb & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}))
  return {
    store,
    get(key) {
      if (!store.has(key)) {
        return Promise.resolve({ present: false as const })
      }
      return Promise.resolve({
        present: true as const,
        value: store.get(key),
      })
    },
    set(key, value) {
      store.set(key, value)
      return Promise.resolve()
    },
    del(key) {
      store.delete(key)
      return Promise.resolve()
    },
    keys() {
      return Promise.resolve([...store.keys()])
    },
    runReadwrite(mutations) {
      for (const mutation of mutations) {
        if (mutation.op === 'set') {
          store.set(mutation.key, mutation.value)
        } else {
          store.delete(mutation.key)
        }
      }
      return Promise.resolve()
    },
  }
}

describe('entryIndexFromScanned / diffEntryIndex', () => {
  it('builds a versioned manifest from scan metadata', () => {
    expect(entryIndexFromScanned(scanned)).toEqual({
      version: FOLDER_MANIFEST_VERSION,
      entries: {
        'a.jpg': { byteSize: 10, mtimeMs: 1 },
        'b.jpg': { byteSize: 20, mtimeMs: 2 },
      },
    })
  })

  it('preserves dims when size and mtime are unchanged', () => {
    const previous: SourceRootEntryIndex = {
      version: FOLDER_MANIFEST_VERSION,
      entries: {
        'a.jpg': {
          byteSize: 10,
          mtimeMs: 1,
          width: 200,
          height: 100,
          orientation: 1,
        },
        'b.jpg': {
          byteSize: 20,
          mtimeMs: 2,
          width: 50,
          height: 50,
          orientation: 6,
        },
      },
    }
    expect(entryIndexFromScanned(scanned, previous)).toEqual({
      version: FOLDER_MANIFEST_VERSION,
      entries: {
        'a.jpg': {
          byteSize: 10,
          mtimeMs: 1,
          width: 200,
          height: 100,
          orientation: 1,
        },
        'b.jpg': {
          byteSize: 20,
          mtimeMs: 2,
          width: 50,
          height: 50,
          orientation: 6,
        },
      },
    })
    expect(
      entryIndexFromScanned(
        [{ relativePath: 'a.jpg', byteSize: 11, mtimeMs: 1 }],
        previous,
      ).entries['a.jpg'],
    ).toEqual({ byteSize: 11, mtimeMs: 1 })
  })

  it('detects new changed unchanged and removed vs a prior index', () => {
    const previous = entryIndexFromScanned(scanned)
    const next: ScannedEntry[] = [
      { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 },
      { relativePath: 'b.jpg', byteSize: 99, mtimeMs: 2 },
      { relativePath: 'c.jpg', byteSize: 3, mtimeMs: 3 },
    ]
    expect(diffEntryIndex(previous, next)).toEqual({
      newPaths: ['c.jpg'],
      changedPaths: ['b.jpg'],
      unchangedPaths: ['a.jpg'],
      removedPaths: [],
    })
    expect(
      diffEntryIndex(previous, [
        { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 },
      ]),
    ).toMatchObject({ removedPaths: ['b.jpg'] })
  })

  it('treats a null prior index as all-new', () => {
    expect(diffEntryIndex(null, scanned).newPaths).toEqual(['a.jpg', 'b.jpg'])
  })

  it('treats size-only or mtime-only drift as changed', () => {
    const previous: SourceRootEntryIndex = {
      version: FOLDER_MANIFEST_VERSION,
      entries: { 'a.jpg': { byteSize: 10, mtimeMs: 1 } },
    }
    expect(
      diffEntryIndex(previous, [
        { relativePath: 'a.jpg', byteSize: 11, mtimeMs: 1 },
      ]).changedPaths,
    ).toEqual(['a.jpg'])
    expect(
      diffEntryIndex(previous, [
        { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 2 },
      ]).changedPaths,
    ).toEqual(['a.jpg'])
  })
})

describe('persistScannedEntryIndex', () => {
  it('round-trips path size and mtime and clears', async () => {
    const put = await persistScannedEntryIndex('root-1', scanned)
    expect(put.ok).toBe(true)
    const got = await getSourceRootEntryIndex('root-1')
    expect(got.ok && got.value).toEqual(entryIndexFromScanned(scanned))
    const cleared = await clearSourceRootEntryIndex('root-1')
    expect(cleared.ok).toBe(true)
    const missing = await getSourceRootEntryIndex('root-1')
    expect(missing.ok).toBe(false)
  })

  it('rejects empty sourceRootId for put get and clear', async () => {
    const get = vi.fn()
    const set = vi.fn()
    const del = vi.fn()
    const idb = {
      get,
      set,
      del,
      keys: () => Promise.resolve([]),
      runReadwrite: () => Promise.resolve(),
    } satisfies SessionIdb
    await expect(
      putSourceRootEntryIndex('', entryIndexFromScanned([]), {
        entryIndexIdb: idb,
      }),
    ).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(
      getSourceRootEntryIndex('', { entryIndexIdb: idb }),
    ).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(
      clearSourceRootEntryIndex('', { entryIndexIdb: idb }),
    ).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    expect(get).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('returns not-found for missing clear and corrupt stored values', async () => {
    const idb = memoryIdb({ 'root-bad': 'not-an-index' })
    await expect(
      getSourceRootEntryIndex('root-bad', { entryIndexIdb: idb }),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    const del = vi.fn(() => Promise.resolve())
    const missingIdb: SessionIdb = {
      get: () => Promise.resolve({ present: false as const }),
      set: () => Promise.resolve(),
      del,
      keys: () => Promise.resolve([]),
      runReadwrite: () => Promise.resolve(),
    }
    await expect(
      clearSourceRootEntryIndex('missing', { entryIndexIdb: missingIdb }),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    expect(del).not.toHaveBeenCalled()
  })

  it('ignores value payload when the idb row is marked absent', async () => {
    const idb: SessionIdb = {
      get: () =>
        Promise.resolve({
          present: false as const,
          // Tempting payload — must not parse when present is false.
          value: {
            entries: { 'a.jpg': { byteSize: 1, mtimeMs: 1 } },
          },
        } as Awaited<ReturnType<SessionIdb['get']>>),
      set: () => Promise.resolve(),
      del: () => Promise.resolve(),
      keys: () => Promise.resolve([]),
      runReadwrite: () => Promise.resolve(),
    }
    await expect(
      getSourceRootEntryIndex('root-ghost', { entryIndexIdb: idb }),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
  })

  it('rejects non-object roots and non-object entries maps', async () => {
    for (const bad of [null, 1, 'x', { entries: null }, { entries: 3 }]) {
      const idb = memoryIdb({ 'root-shape': bad })
      await expect(
        getSourceRootEntryIndex('root-shape', { entryIndexIdb: idb }),
      ).resolves.toEqual({ ok: false, code: 'not-found' })
    }
  })

  it('skips invalid entry rows when parsing a stored index', async () => {
    const idb = memoryIdb({
      'root-partial': {
        entries: {
          ok: { byteSize: 1, mtimeMs: 2 },
          bad: null,
          nan: { byteSize: Number.NaN, mtimeMs: 1 },
          incomplete: { byteSize: 1 },
          inf: { byteSize: 1, mtimeMs: Number.POSITIVE_INFINITY },
        },
      },
    })
    await expect(
      getSourceRootEntryIndex('root-partial', { entryIndexIdb: idb }),
    ).resolves.toEqual({
      ok: true,
      value: {
        version: FOLDER_MANIFEST_VERSION,
        entries: { ok: { byteSize: 1, mtimeMs: 2 } },
      },
    })
  })

  it('rejects unsupported manifest versions', () => {
    expect(
      parseFolderManifest({
        version: 99,
        entries: { 'a.jpg': { byteSize: 1, mtimeMs: 1 } },
      }),
    ).toBeNull()
  })

  it('accepts legacy manifests without a version field', () => {
    expect(
      parseFolderManifest({
        entries: { 'a.jpg': { byteSize: 1, mtimeMs: 1 } },
      }),
    ).toEqual({
      version: FOLDER_MANIFEST_VERSION,
      entries: { 'a.jpg': { byteSize: 1, mtimeMs: 1 } },
    })
  })

  it('patches dimensions onto an existing or new manifest entry', async () => {
    const idb = memoryIdb()
    await persistScannedEntryIndex('root-dims', scanned, { entryIndexIdb: idb })
    const patched = await patchManifestDimensions(
      'root-dims',
      {
        relativePath: 'a.jpg',
        byteSize: 10,
        mtimeMs: 1,
        width: 400,
        height: 200,
        orientation: 1,
      },
      { entryIndexIdb: idb },
    )
    expect(patched.ok).toBe(true)
    const got = await getSourceRootEntryIndex('root-dims', {
      entryIndexIdb: idb,
    })
    expect(got.ok && got.value.entries['a.jpg']).toEqual({
      byteSize: 10,
      mtimeMs: 1,
      width: 400,
      height: 200,
      orientation: 1,
    })
  })

  it('seeds a manifest when patching dims before any scan persist', async () => {
    const idb = memoryIdb()
    const seeded = await patchManifestDimensions(
      'root-seed',
      {
        relativePath: 'solo.jpg',
        byteSize: 5,
        mtimeMs: 9,
        width: 80,
        height: 40,
        orientation: 6,
      },
      { entryIndexIdb: idb },
    )
    expect(seeded.ok).toBe(true)
    const got = await getSourceRootEntryIndex('root-seed', {
      entryIndexIdb: idb,
    })
    expect(got.ok && got.value.entries['solo.jpg']).toEqual({
      byteSize: 5,
      mtimeMs: 9,
      width: 80,
      height: 40,
      orientation: 6,
    })
  })

  it('ignores stale size or mtime when patching dimensions', async () => {
    const idb = memoryIdb()
    await persistScannedEntryIndex('root-stale', scanned, {
      entryIndexIdb: idb,
    })
    await patchManifestDimensions(
      'root-stale',
      {
        relativePath: 'a.jpg',
        byteSize: 10,
        mtimeMs: 1,
        width: 400,
        height: 200,
        orientation: 1,
      },
      { entryIndexIdb: idb },
    )
    await patchManifestDimensions(
      'root-stale',
      {
        relativePath: 'a.jpg',
        byteSize: 999,
        mtimeMs: 1,
        width: 1,
        height: 1,
        orientation: 1,
      },
      { entryIndexIdb: idb },
    )
    await patchManifestDimensions(
      'root-stale',
      {
        relativePath: 'a.jpg',
        byteSize: 10,
        mtimeMs: 999,
        width: 2,
        height: 2,
        orientation: 1,
      },
      { entryIndexIdb: idb },
    )
    const still = await getSourceRootEntryIndex('root-stale', {
      entryIndexIdb: idb,
    })
    expect(still.ok && still.value.entries['a.jpg']).toEqual({
      byteSize: 10,
      mtimeMs: 1,
      width: 400,
      height: 200,
      orientation: 1,
    })
  })

  it('rejects invalid patch inputs', async () => {
    const idb = memoryIdb()
    await expect(
      patchManifestDimensions(
        '',
        {
          relativePath: 'a.jpg',
          byteSize: 1,
          mtimeMs: 1,
          width: 1,
          height: 1,
          orientation: 1,
        },
        { entryIndexIdb: idb },
      ),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(
      patchManifestDimensions(
        'root',
        {
          relativePath: '',
          byteSize: 1,
          mtimeMs: 1,
          width: 1,
          height: 1,
          orientation: 1,
        },
        { entryIndexIdb: idb },
      ),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(
      patchManifestDimensions(
        'root',
        {
          relativePath: 'a.jpg',
          byteSize: 1,
          mtimeMs: 1,
          width: 0,
          height: 1,
          orientation: 1,
        },
        { entryIndexIdb: idb },
      ),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(
      patchManifestDimensions(
        'root',
        {
          relativePath: 'a.jpg',
          byteSize: 1,
          mtimeMs: 1,
          width: 1,
          height: 1,
          orientation: 9,
        },
        { entryIndexIdb: idb },
      ),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
  })

  it('merges prior dims on re-persist and yields for large scans', async () => {
    const idb = memoryIdb()
    await putSourceRootEntryIndex(
      'root-merge',
      {
        version: FOLDER_MANIFEST_VERSION,
        entries: {
          'a.jpg': {
            byteSize: 10,
            mtimeMs: 1,
            width: 200,
            height: 100,
            orientation: 1,
          },
        },
      },
      { entryIndexIdb: idb },
    )
    let yields = 0
    const big = Array.from({ length: 300 }, (_, i) => ({
      relativePath: `f-${String(i)}.jpg`,
      byteSize: i + 1,
      mtimeMs: i + 1,
    }))
    big[0] = { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 }
    await persistScannedEntryIndex('root-merge', big, {
      entryIndexIdb: idb,
      yieldFn: () => {
        yields += 1
        return Promise.resolve()
      },
    })
    expect(yields).toBeGreaterThan(1)
    const got = await getSourceRootEntryIndex('root-merge', {
      entryIndexIdb: idb,
    })
    expect(got.ok && got.value.entries['a.jpg']).toEqual({
      byteSize: 10,
      mtimeMs: 1,
      width: 200,
      height: 100,
      orientation: 1,
    })
    expect(got.ok && Object.keys(got.value.entries)).toHaveLength(300)
  })

  it('parses width height and orientation from stored rows', async () => {
    const idb = memoryIdb({
      'root-full': {
        version: FOLDER_MANIFEST_VERSION,
        entries: {
          'a.jpg': {
            byteSize: 1,
            mtimeMs: 2,
            width: 10,
            height: 20,
            orientation: 3,
          },
          'orient8.jpg': {
            byteSize: 1,
            mtimeMs: 2,
            width: 3,
            height: 4,
            orientation: 8,
          },
          'bad-orient.jpg': {
            byteSize: 1,
            mtimeMs: 2,
            width: 10,
            height: 20,
            orientation: 0,
          },
          'float-orient.jpg': {
            byteSize: 1,
            mtimeMs: 2,
            width: 10,
            height: 20,
            orientation: 1.5,
          },
          'width-only.jpg': {
            byteSize: 1,
            mtimeMs: 2,
            width: 10,
          },
          'zero-width.jpg': {
            byteSize: 1,
            mtimeMs: 2,
            width: 0,
            height: 20,
          },
          'string-size.jpg': {
            byteSize: '1',
            mtimeMs: 2,
          },
        },
      },
    })
    const got = await getSourceRootEntryIndex('root-full', {
      entryIndexIdb: idb,
    })
    expect(got.ok && got.value.entries['a.jpg']).toEqual({
      byteSize: 1,
      mtimeMs: 2,
      width: 10,
      height: 20,
      orientation: 3,
    })
    expect(got.ok && got.value.entries['orient8.jpg']?.orientation).toBe(8)
    expect(got.ok && got.value.entries['bad-orient.jpg']).toEqual({
      byteSize: 1,
      mtimeMs: 2,
      width: 10,
      height: 20,
    })
    expect(got.ok && got.value.entries['float-orient.jpg']?.orientation).toBe(
      undefined,
    )
    expect(got.ok && got.value.entries['width-only.jpg']).toEqual({
      byteSize: 1,
      mtimeMs: 2,
    })
    expect(got.ok && got.value.entries['zero-width.jpg']).toEqual({
      byteSize: 1,
      mtimeMs: 2,
    })
    expect(got.ok && got.value.entries['string-size.jpg']).toBeUndefined()
  })

  it('maps idb failures to not-found', async () => {
    const failing: SessionIdb = {
      get: () => Promise.reject(new Error('boom')),
      set: () => Promise.reject(new Error('boom')),
      del: () => Promise.reject(new Error('boom')),
      keys: () => Promise.resolve([]),
      runReadwrite: () => Promise.reject(new Error('boom')),
    }
    await expect(
      getSourceRootEntryIndex('root', { entryIndexIdb: failing }),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(
      putSourceRootEntryIndex('root', entryIndexFromScanned(scanned), {
        entryIndexIdb: failing,
      }),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
    await expect(
      clearSourceRootEntryIndex('root', { entryIndexIdb: failing }),
    ).resolves.toEqual({ ok: false, code: 'not-found' })
  })
})
