const DB_NAME = 'photobooks-session'
const STORE_NAME = 'library-handles'
const DB_VERSION = 2

export const RECENTS_KEY = '__recents'
export const ACTIVE_KEY = '__active'
const LEGACY_LIBRARY_ID = 'library'

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => {
      reject(request.error ?? new Error('indexedDB open failed'))
    }
    request.onupgradeneeded = () => {
      const db = request.result
      const tx = request.transaction
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!tx) {
        return
      }
      const store = tx.objectStore(STORE_NAME)
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

export function createSessionIdb(): SessionIdb {
  return {
    async get(key) {
      const db = await openDb()
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
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
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
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
