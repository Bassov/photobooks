const DB_NAME = 'photobooks-session'
const STORE_NAME = 'library-handles'
const DB_VERSION = 1

export type SessionIdbGetResult =
  { present: true; value: unknown } | { present: false }

export interface SessionIdb {
  get: (key: string) => Promise<SessionIdbGetResult>
  set: (key: string, value: unknown) => Promise<void>
  del: (key: string) => Promise<void>
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => {
      reject(request.error ?? new Error('indexedDB open failed'))
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
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
      const db = await openDb()
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        await requestToPromise(store.put(value, key))
      } finally {
        db.close()
      }
    },
    async del(key) {
      const db = await openDb()
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        await requestToPromise(store.delete(key))
      } finally {
        db.close()
      }
    },
  }
}
