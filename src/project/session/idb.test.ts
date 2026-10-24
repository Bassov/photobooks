import { IDBDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeBrowserDirectory } from '../fsa/browserDirectory.test-helpers'
import { createBrowserSessionState } from './browserSessionState'
import {
  ACTIVE_KEY,
  createSessionIdb,
  LABEL_KEY,
  migrateLegacyRecents,
  RECENTS_KEY,
  type SessionIdb,
} from './idb'
import { DEFAULT_LIBRARY_ID } from './types'
import {
  createMemoryLockManager,
  installMemoryLockManager,
} from './locks.test-helpers'
import { runSessionStateContract } from './sessionState.contract.test-helpers'

const DB_NAME = 'photobooks-session'
const STORE_NAME = 'library-handles'
const LEGACY_LIBRARY_ID = 'library'

function resetIndexedDb(): void {
  vi.stubGlobal('indexedDB', new IDBFactory())
}

async function openRaw(
  version: number,
  onUpgrade?: (db: IDBDatabase, tx: IDBTransaction | null) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version)
    request.onerror = () => {
      reject(request.error ?? new Error('open failed'))
    }
    request.onupgradeneeded = () => {
      onUpgrade?.(request.result, request.transaction)
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

/**
 * Real createSessionIdb for every op; keeps live directory handles in a side
 * map so Node structured clone does not strip FSA methods used by the contract.
 */
function createSessionIdbWithLiveHandles(): SessionIdb {
  const real = createSessionIdb()
  const live = new Map<string, unknown>()

  function isDirectoryHandle(
    value: unknown,
  ): value is { kind: 'directory'; name: string } {
    if (typeof value !== 'object' || value === null) {
      return false
    }
    if (!('kind' in value) || !('name' in value)) {
      return false
    }
    return value.kind === 'directory' && typeof value.name === 'string'
  }

  return {
    async get(key) {
      if (live.has(key)) {
        return { present: true, value: live.get(key) }
      }
      return real.get(key)
    },
    async set(key, value) {
      if (isDirectoryHandle(value)) {
        live.set(key, value)
        await real.set(key, { kind: value.kind, name: value.name })
        return
      }
      live.delete(key)
      await real.set(key, value)
    },
    async del(key) {
      live.delete(key)
      await real.del(key)
    },
    async keys() {
      const fromReal = await real.keys()
      return [...new Set([...fromReal, ...live.keys()])]
    },
    async runReadwrite(mutations) {
      const rewritten = mutations.map((mutation) => {
        if (mutation.op === 'del') {
          live.delete(mutation.key)
          return mutation
        }
        if (isDirectoryHandle(mutation.value)) {
          live.set(mutation.key, mutation.value)
          return {
            op: 'set' as const,
            key: mutation.key,
            value: { kind: mutation.value.kind, name: mutation.value.name },
          }
        }
        live.delete(mutation.key)
        return mutation
      })
      await real.runReadwrite(rewritten)
    },
  }
}

beforeEach(() => {
  resetIndexedDb()
  installMemoryLockManager(createMemoryLockManager())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

runSessionStateContract(() => {
  const idb = createSessionIdbWithLiveHandles()
  const session = createBrowserSessionState({ idb })
  const handles = new Map<
    string,
    ReturnType<typeof createFakeBrowserDirectory>
  >()
  let handleSeq = 0

  return {
    session,
    setPermissionRequired(required) {
      for (const handle of handles.values()) {
        handle.setPermission(required ? 'prompt' : 'granted')
      }
    },
    createHandle() {
      handleSeq += 1
      const handle = createFakeBrowserDirectory({
        name: `fake-${String(handleSeq)}`,
      })
      handles.set(handle.name, handle)
      return handle
    },
  }
})

describe('createSessionIdb (fake-indexeddb)', () => {
  it('returns present: false for a missing key', async () => {
    const idb = createSessionIdb()

    await expect(idb.get('missing')).resolves.toEqual({ present: false })
  })

  it('creates the object store on upgrade and round-trips values', async () => {
    const idb = createSessionIdb()

    await idb.set('k1', { hello: 'world' })
    await expect(idb.get('k1')).resolves.toEqual({
      present: true,
      value: { hello: 'world' },
    })

    const db = await openRaw(3)
    expect([...db.objectStoreNames]).toContain(STORE_NAME)
    db.close()
  })

  it('closes the database after get, keys, and runReadwrite', async () => {
    const closeSpy = vi.spyOn(IDBDatabase.prototype, 'close')
    const idb = createSessionIdb()

    await idb.get('any')
    expect(closeSpy).toHaveBeenCalled()
    closeSpy.mockClear()

    await idb.keys()
    expect(closeSpy).toHaveBeenCalled()
    closeSpy.mockClear()

    await idb.set('k', 1)
    expect(closeSpy).toHaveBeenCalled()
    closeSpy.mockClear()

    await idb.del('k')
    expect(closeSpy).toHaveBeenCalled()
    closeSpy.mockRestore()
  })

  it('deletes keys and supports batched runReadwrite', async () => {
    const idb = createSessionIdb()
    await idb.runReadwrite([
      { op: 'set', key: 'a', value: 1 },
      { op: 'set', key: 'b', value: 2 },
    ])
    await idb.runReadwrite([{ op: 'del', key: 'a' }])

    await expect(idb.get('a')).resolves.toEqual({ present: false })
    await expect(idb.get('b')).resolves.toEqual({ present: true, value: 2 })
  })

  it('migrateLegacyRecents adopts the most recent handle and drops recents', async () => {
    const idb = createSessionIdb()
    await idb.runReadwrite([
      {
        op: 'set',
        key: 'old',
        value: { kind: 'directory', name: 'Old' },
      },
      {
        op: 'set',
        key: 'newer',
        value: { kind: 'directory', name: 'Newer' },
      },
      {
        op: 'set',
        key: RECENTS_KEY,
        value: [
          { id: 'newer', label: 'Newer' },
          { id: 'old', label: 'Old' },
        ],
      },
    ])

    await migrateLegacyRecents(idb)

    await expect(idb.get(RECENTS_KEY)).resolves.toEqual({ present: false })
    await expect(idb.get('old')).resolves.toEqual({ present: false })
    await expect(idb.get('newer')).resolves.toEqual({ present: false })
    await expect(idb.get(DEFAULT_LIBRARY_ID)).resolves.toEqual({
      present: true,
      value: { kind: 'directory', name: 'Newer' },
    })
    await expect(idb.get(LABEL_KEY)).resolves.toEqual({
      present: true,
      value: 'Newer',
    })
  })

  it('migrateLegacyRecents drops empty __recents without touching other keys', async () => {
    const idb = createSessionIdb()
    await idb.runReadwrite([
      {
        op: 'set',
        key: LEGACY_LIBRARY_ID,
        value: { kind: 'directory', name: 'Keep' },
      },
      { op: 'set', key: RECENTS_KEY, value: [] },
      { op: 'set', key: LABEL_KEY, value: 'Keep' },
    ])
    const run = vi.spyOn(idb, 'runReadwrite')

    await migrateLegacyRecents(idb)

    expect(run).toHaveBeenCalledWith([{ op: 'del', key: RECENTS_KEY }])
    await expect(idb.get(RECENTS_KEY)).resolves.toEqual({ present: false })
    await expect(idb.get(LEGACY_LIBRARY_ID)).resolves.toEqual({
      present: true,
      value: { kind: 'directory', name: 'Keep' },
    })
    await expect(idb.get(LABEL_KEY)).resolves.toEqual({
      present: true,
      value: 'Keep',
    })
  })

  it('migrateLegacyRecents is a pure no-op when __recents key is absent', async () => {
    const idb = createSessionIdb()
    await idb.set(LEGACY_LIBRARY_ID, { kind: 'directory', name: 'Only' })
    const run = vi.spyOn(idb, 'runReadwrite')

    await migrateLegacyRecents(idb)

    expect(run).not.toHaveBeenCalled()
  })

  it('migrateLegacyRecents writes label from recents when stored label is blank', async () => {
    const idb = createSessionIdb()
    await idb.runReadwrite([
      {
        op: 'set',
        key: 'trip',
        value: { kind: 'directory', name: 'TripDir' },
      },
      {
        op: 'set',
        key: RECENTS_KEY,
        value: [{ id: 'trip', label: 'Trip Label' }],
      },
      { op: 'set', key: LABEL_KEY, value: '   ' },
      {
        op: 'set',
        key: ACTIVE_KEY,
        value: { libraryId: null, bookId: 'b1' },
      },
    ])

    await migrateLegacyRecents(idb)

    await expect(idb.get(LABEL_KEY)).resolves.toEqual({
      present: true,
      value: 'Trip Label',
    })
    await expect(idb.get(ACTIVE_KEY)).resolves.toEqual({
      present: true,
      value: { libraryId: null, bookId: 'b1' },
    })
  })

  it('migrateLegacyRecents keeps DEFAULT handle and preserves a valid label', async () => {
    const idb = createSessionIdb()
    await idb.runReadwrite([
      {
        op: 'set',
        key: DEFAULT_LIBRARY_ID,
        value: { kind: 'directory', name: 'Default' },
      },
      { op: 'set', key: 'other', value: { kind: 'directory', name: 'Other' } },
      {
        op: 'set',
        key: RECENTS_KEY,
        value: [{ id: DEFAULT_LIBRARY_ID, label: 'FromRecents' }],
      },
      { op: 'set', key: LABEL_KEY, value: 'Existing Label' },
      {
        op: 'set',
        key: ACTIVE_KEY,
        value: { libraryId: 'other', bookId: 'b1' },
      },
    ])

    await migrateLegacyRecents(idb)

    await expect(idb.get(RECENTS_KEY)).resolves.toEqual({ present: false })
    await expect(idb.get('other')).resolves.toEqual({ present: false })
    await expect(idb.get(DEFAULT_LIBRARY_ID)).resolves.toEqual({
      present: true,
      value: { kind: 'directory', name: 'Default' },
    })
    await expect(idb.get(LABEL_KEY)).resolves.toEqual({
      present: true,
      value: 'Existing Label',
    })
    await expect(idb.get(ACTIVE_KEY)).resolves.toEqual({
      present: true,
      value: { libraryId: DEFAULT_LIBRARY_ID, bookId: 'b1' },
    })
  })

  it('migrateLegacyRecents drops sibling handles when preferred handle is missing', async () => {
    const idb = createSessionIdb()
    await idb.runReadwrite([
      { op: 'set', key: 'stale', value: { kind: 'directory', name: 'Stale' } },
      {
        op: 'set',
        key: RECENTS_KEY,
        value: [{ id: 'missing', label: 'Gone' }],
      },
      { op: 'set', key: LABEL_KEY, value: 'Old' },
    ])

    await migrateLegacyRecents(idb)

    await expect(idb.get(RECENTS_KEY)).resolves.toEqual({ present: false })
    await expect(idb.get('stale')).resolves.toEqual({ present: false })
    await expect(idb.get(DEFAULT_LIBRARY_ID)).resolves.toEqual({
      present: false,
    })
    await expect(idb.get(LABEL_KEY)).resolves.toEqual({
      present: true,
      value: 'Old',
    })
  })

  it('stores active ids through the adapter', async () => {
    const idb = createSessionIdb()
    await idb.set(ACTIVE_KEY, { libraryId: 'lib', bookId: 'book' })
    await expect(idb.get(ACTIVE_KEY)).resolves.toEqual({
      present: true,
      value: { libraryId: 'lib', bookId: 'book' },
    })
  })

  it('deletes remove the key (not an undefined value)', async () => {
    const idb = createSessionIdb()
    await idb.set('gone', 'x')
    await idb.del('gone')

    await expect(idb.get('gone')).resolves.toEqual({ present: false })

    const db = await openRaw(3)
    const key = await new Promise<IDBValidKey | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).getKey('gone')
        req.onsuccess = () => {
          resolve(req.result)
        }
        req.onerror = () => {
          reject(req.error ?? new Error('getKey failed'))
        }
      },
    )
    db.close()
    expect(key).toBeUndefined()
  })

  it('rejects when indexedDB.open fails', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        const request = {
          error: null as DOMException | null,
          onerror: null as ((ev: Event) => void) | null,
          onsuccess: null as ((ev: Event) => void) | null,
          onupgradeneeded: null as ((ev: Event) => void) | null,
          result: undefined as IDBDatabase | undefined,
        }
        queueMicrotask(() => {
          request.error = new DOMException('open failed', 'UnknownError')
          request.onerror?.(new Event('error'))
        })
        return request as unknown as IDBOpenDBRequest
      },
    })

    const idb = createSessionIdb()
    await expect(idb.get('x')).rejects.toThrow(/open failed/)
  })

  it('rejects when open fails with a null error (fallback message)', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        const request = {
          error: null as DOMException | null,
          onerror: null as ((ev: Event) => void) | null,
          onsuccess: null as ((ev: Event) => void) | null,
          onupgradeneeded: null as ((ev: Event) => void) | null,
          result: undefined as IDBDatabase | undefined,
        }
        queueMicrotask(() => {
          request.error = null
          request.onerror?.(new Event('error'))
        })
        return request as unknown as IDBOpenDBRequest
      },
    })

    const idb = createSessionIdb()
    await expect(idb.get('x')).rejects.toThrow('indexedDB open failed')
  })

  it('rejects get when the store request errors', async () => {
    const idb = createSessionIdb()
    await idb.set('k', 1)

    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(() => {
      const request = {
        result: undefined as unknown,
        error: null as DOMException | null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      }
      queueMicrotask(() => {
        request.error = new DOMException('get failed', 'UnknownError')
        request.onerror?.(new Event('error'))
      })
      return request as unknown as IDBRequest
    })

    await expect(idb.get('k')).rejects.toThrow(/get failed/)
  })

  it('rejects get when the store request errors with null error', async () => {
    const idb = createSessionIdb()
    await idb.set('k', 1)

    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(() => {
      const request = {
        result: undefined as unknown,
        error: null as DOMException | null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
      }
      queueMicrotask(() => {
        request.error = null
        request.onerror?.(new Event('error'))
      })
      return request as unknown as IDBRequest
    })

    await expect(idb.get('k')).rejects.toThrow('indexedDB request failed')
  })

  it('rejects runReadwrite when the transaction errors', async () => {
    const idb = createSessionIdb()
    await idb.set('seed', 1)

    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
      const store = {
        put() {
          return undefined
        },
        delete() {
          return undefined
        },
      }
      const tx = {
        error: null as DOMException | null,
        objectStore: () => store,
        oncomplete: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        onabort: null as ((ev: Event) => void) | null,
      }
      queueMicrotask(() => {
        tx.error = new DOMException('tx failed', 'UnknownError')
        tx.onerror?.(new Event('error'))
      })
      return tx as unknown as IDBTransaction
    })

    await expect(idb.set('k', 2)).rejects.toThrow(/tx failed/)
  })

  it('rejects runReadwrite when the transaction errors with null error', async () => {
    const idb = createSessionIdb()
    await idb.set('seed', 1)

    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
      const store = {
        put() {
          return undefined
        },
        delete() {
          return undefined
        },
      }
      const tx = {
        error: null as DOMException | null,
        objectStore: () => store,
        oncomplete: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        onabort: null as ((ev: Event) => void) | null,
      }
      queueMicrotask(() => {
        tx.error = null
        tx.onerror?.(new Event('error'))
      })
      return tx as unknown as IDBTransaction
    })

    await expect(idb.set('k', 2)).rejects.toThrow(
      'indexedDB transaction failed',
    )
  })

  it('rejects runReadwrite when the transaction aborts', async () => {
    const idb = createSessionIdb()
    await idb.set('seed', 1)
    const abortError = new DOMException('aborted', 'AbortError')

    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
      const store = {
        put() {
          return undefined
        },
        delete() {
          return undefined
        },
      }
      const tx = {
        error: null as DOMException | null,
        objectStore: () => store,
        oncomplete: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        onabort: null as ((ev: Event) => void) | null,
      }
      queueMicrotask(() => {
        tx.error = abortError
        tx.onabort?.(new Event('abort'))
      })
      return tx as unknown as IDBTransaction
    })

    // Prefer the platform error object (kills ?? → && fallback wrapping).
    await expect(idb.set('k', 2)).rejects.toBe(abortError)
  })

  it('rejects runReadwrite when the transaction aborts with null error', async () => {
    const idb = createSessionIdb()
    await idb.set('seed', 1)

    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
      const store = {
        put() {
          return undefined
        },
        delete() {
          return undefined
        },
      }
      const tx = {
        error: null as DOMException | null,
        objectStore: () => store,
        oncomplete: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        onabort: null as ((ev: Event) => void) | null,
      }
      queueMicrotask(() => {
        tx.error = null
        tx.onabort?.(new Event('abort'))
      })
      return tx as unknown as IDBTransaction
    })

    await expect(idb.set('k', 2)).rejects.toEqual(
      new Error('indexedDB transaction aborted'),
    )
  })
})
