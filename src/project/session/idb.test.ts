import { IDBDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeBrowserDirectory } from '../fsa/browserDirectory.test-helpers'
import { createBrowserSessionState } from './browserSessionState'
import {
  ACTIVE_KEY,
  BOOK_PHOTO_ROOTS_STORE,
  createBookPhotoRootIdb,
  createSessionIdb,
  createSourceRootIdb,
  LIBRARY_HANDLES_STORE,
  RECENTS_KEY,
  SOURCE_ROOT_HANDLES_STORE,
  type SessionIdb,
} from './idb'
import {
  createMemoryLockManager,
  installMemoryLockManager,
} from './locks.test-helpers'
import { runSessionStateContract } from './sessionState.contract.test-helpers'

const DB_NAME = 'photobooks-session'
const STORE_NAME = LIBRARY_HANDLES_STORE
const DB_VERSION = 3
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

    const db = await openRaw(DB_VERSION)
    expect([...db.objectStoreNames]).toContain(STORE_NAME)
    db.close()
  })

  it('creates source-root and book-photo-root stores on v3 upgrade', async () => {
    const v2 = await openRaw(2, (db) => {
      db.createObjectStore(STORE_NAME)
    })
    v2.close()

    const library = createSessionIdb()
    await library.set('lib', { kind: 'directory', name: 'Lib' })

    const sourceRoots = createSourceRootIdb()
    await sourceRoots.set('root-1', { kind: 'directory', name: 'Photos' })
    await expect(sourceRoots.get('root-1')).resolves.toEqual({
      present: true,
      value: { kind: 'directory', name: 'Photos' },
    })

    const bookRoots = createBookPhotoRootIdb()
    await bookRoots.set('book-1', { sourceRootId: 'root-1', label: 'Trip' })
    await expect(bookRoots.get('book-1')).resolves.toEqual({
      present: true,
      value: { sourceRootId: 'root-1', label: 'Trip' },
    })

    const db = await openRaw(DB_VERSION)
    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining([
        LIBRARY_HANDLES_STORE,
        SOURCE_ROOT_HANDLES_STORE,
        BOOK_PHOTO_ROOTS_STORE,
      ]),
    )
    expect(db.objectStoreNames.length).toBe(3)
    db.close()

    await expect(library.get('lib')).resolves.toEqual({
      present: true,
      value: { kind: 'directory', name: 'Lib' },
    })
  })

  it('fresh open at v3 creates all three stores', async () => {
    const idb = createSessionIdb()
    await idb.get('probe')

    const db = await openRaw(DB_VERSION)
    expect([...db.objectStoreNames].sort()).toEqual(
      [
        BOOK_PHOTO_ROOTS_STORE,
        LIBRARY_HANDLES_STORE,
        SOURCE_ROOT_HANDLES_STORE,
      ].sort(),
    )
    db.close()
  })

  it('closes the database after get and runReadwrite', async () => {
    const closeSpy = vi.spyOn(IDBDatabase.prototype, 'close')
    const idb = createSessionIdb()

    await idb.get('any')
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

  it('migrates v1 legacy library key into __recents when missing', async () => {
    const v1 = await openRaw(1, (db) => {
      db.createObjectStore(STORE_NAME)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = v1.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(
        { kind: 'directory', name: 'LegacyDir' },
        LEGACY_LIBRARY_ID,
      )
      tx.oncomplete = () => {
        resolve()
      }
      tx.onerror = () => {
        reject(tx.error ?? new Error('transaction failed'))
      }
    })
    v1.close()

    const idb = createSessionIdb()
    await expect(idb.get(RECENTS_KEY)).resolves.toEqual({
      present: true,
      value: [{ id: LEGACY_LIBRARY_ID, label: 'Library' }],
    })
    await expect(idb.get(LEGACY_LIBRARY_ID)).resolves.toEqual({
      present: true,
      value: { kind: 'directory', name: 'LegacyDir' },
    })
  })

  it('does not overwrite existing __recents during v1→v2 upgrade', async () => {
    const v1 = await openRaw(1, (db) => {
      db.createObjectStore(STORE_NAME)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = v1.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ kind: 'directory', name: 'LegacyDir' }, LEGACY_LIBRARY_ID)
      store.put([{ id: 'kept', label: 'Kept' }], RECENTS_KEY)
      tx.oncomplete = () => {
        resolve()
      }
      tx.onerror = () => {
        reject(tx.error ?? new Error('transaction failed'))
      }
    })
    v1.close()

    const idb = createSessionIdb()
    await expect(idb.get(RECENTS_KEY)).resolves.toEqual({
      present: true,
      value: [{ id: 'kept', label: 'Kept' }],
    })
  })

  it('skips migration when the legacy library key is absent', async () => {
    const v1 = await openRaw(1, (db) => {
      db.createObjectStore(STORE_NAME)
    })
    v1.close()

    const idb = createSessionIdb()
    await expect(idb.get(RECENTS_KEY)).resolves.toEqual({ present: false })
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

    const db = await openRaw(DB_VERSION)
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

  it('throws when upgrade runs without a transaction', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        const request: {
          result?: IDBDatabase
          transaction: IDBTransaction | null
          error: DOMException | null
          onerror: ((ev: Event) => void) | null
          onsuccess: ((ev: Event) => void) | null
          onupgradeneeded: ((ev: Event) => void) | null
        } = {
          transaction: null,
          error: null,
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
        }
        queueMicrotask(() => {
          const factory = new IDBFactory()
          const probe = factory.open('tx-null-probe', 1)
          probe.onupgradeneeded = () => {
            request.result = probe.result
            request.transaction = null
            try {
              request.onupgradeneeded?.(new Event('upgradeneeded'))
            } catch (err) {
              request.error = new DOMException(
                err instanceof Error ? err.message : String(err),
                'UnknownError',
              )
              request.onerror?.(new Event('error'))
            }
          }
          probe.onerror = () => {
            request.error = probe.error
            request.onerror?.(new Event('error'))
          }
        })
        return request as unknown as IDBOpenDBRequest
      },
    })

    const idb = createSessionIdb()
    await expect(idb.get('x')).rejects.toThrow(
      'indexedDB upgrade missing transaction',
    )
  })
})
