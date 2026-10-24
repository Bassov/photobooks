const DB_NAME = 'photobooks-session'
export const LIBRARY_HANDLES_STORE = 'library-handles'
export const SOURCE_ROOT_HANDLES_STORE = 'source-root-handles'
export const BOOK_PHOTO_ROOTS_STORE = 'book-photo-roots'
const DB_VERSION = 3

export const RECENTS_KEY = '__recents'
export const ACTIVE_KEY = '__active'
const LEGACY_LIBRARY_ID = 'library'

const ALL_STORES = [
  LIBRARY_HANDLES_STORE,
  SOURCE_ROOT_HANDLES_STORE,
  BOOK_PHOTO_ROOTS_STORE,
] as const

export type SessionIdbGetResult =
  { present: true; value: unknown } | { present: false }

type SessionIdbMutation =
  { op: 'set'; key: string; value: unknown } | { op: 'del'; key: string }

export interface SessionIdb {
  get: (key: string) => Promise<SessionIdbGetResult>
  set: (key: string, value: unknown) => Promise<void>
  del: (key: string) => Promise<void>
  runReadwrite: (mutations: readonly SessionIdbMutation[]) => Promise<void>
}

function ensureStores(db: IDBDatabase): void {
  for (const storeName of ALL_STORES) {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName)
    }
  }
}

function migrateLegacyLibraryRecents(tx: IDBTransaction): void {
  // `ensureStores` always creates LIBRARY_HANDLES_STORE before this runs.
  const store = tx.objectStore(LIBRARY_HANDLES_STORE)
  const legacy = store.get(LEGACY_LIBRARY_ID)
  legacy.onsuccess = () => {
    if (legacy.result === undefined) {
      return
    }
    const recentsGet = store.get(RECENTS_KEY)
    recentsGet.onsuccess = () => {
      if (recentsGet.result !== undefined) {
        return
      }
      store.put([{ id: LEGACY_LIBRARY_ID, label: 'Library' }], RECENTS_KEY)
    }
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => {
      reject(request.error ?? new Error('indexedDB open failed'))
    }
    request.onupgradeneeded = () => {
      const db = request.result
      const tx = request.transaction
      ensureStores(db)
      if (!tx) {
        throw new Error('indexedDB upgrade missing transaction')
      }
      migrateLegacyLibraryRecents(tx)
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      reject(request.error ?? new Error('indexedDB request failed'))
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve()
    }
    tx.onerror = () => {
      reject(tx.error ?? new Error('indexedDB transaction failed'))
    }
    tx.onabort = () => {
      reject(tx.error ?? new Error('indexedDB transaction aborted'))
    }
  })
}

function createStoreIdb(storeName: string): SessionIdb {
  return {
    async get(key) {
      const db = await openDb()
      try {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const raw: unknown = await requestToPromise(
          store.get(key) as IDBRequest<unknown>,
        )
        if (raw === undefined) {
          return { present: false }
        }
        return { present: true, value: raw }
      } finally {
        db.close()
      }
    },
    async set(key, value) {
      await this.runReadwrite([{ op: 'set', key, value }])
    },
    async del(key) {
      await this.runReadwrite([{ op: 'del', key }])
    },
    async runReadwrite(mutations) {
      const db = await openDb()
      try {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        for (const mutation of mutations) {
          if (mutation.op === 'set') {
            store.put(mutation.value, mutation.key)
          } else {
            store.delete(mutation.key)
          }
        }
        await waitForTransaction(tx)
      } finally {
        db.close()
      }
    },
  }
}

/** Library directory handles only (`library-handles`). */
export function createSessionIdb(): SessionIdb {
  return createStoreIdb(LIBRARY_HANDLES_STORE)
}

/** Photo source-root directory handles (`source-root-handles`). */
export function createSourceRootIdb(): SessionIdb {
  return createStoreIdb(SOURCE_ROOT_HANDLES_STORE)
}

/** Book → photo source-root binding (`book-photo-roots`). */
export function createBookPhotoRootIdb(): SessionIdb {
  return createStoreIdb(BOOK_PHOTO_ROOTS_STORE)
}
