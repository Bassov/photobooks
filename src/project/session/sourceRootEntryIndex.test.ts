import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScannedEntry } from '../../assets'
import type { SessionIdb } from './idb'
import {
  clearSourceRootEntryIndex,
  diffEntryIndex,
  entryIndexFromScanned,
  getSourceRootEntryIndex,
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
  it('builds an index from scan metadata', () => {
    expect(entryIndexFromScanned(scanned)).toEqual({
      entries: {
        'a.jpg': { byteSize: 10, mtimeMs: 1 },
        'b.jpg': { byteSize: 20, mtimeMs: 2 },
      },
    })
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
      value: { entries: { ok: { byteSize: 1, mtimeMs: 2 } } },
    })
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
