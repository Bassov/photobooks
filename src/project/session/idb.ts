import {
  ACTIVE_KEY,
  isReservedSessionKey,
  LABEL_KEY,
  parseActiveIds,
  parseLibraryLabel,
  parseRecents,
  RECENTS_KEY,
} from './libraryLabel'
import { DEFAULT_LIBRARY_ID } from './types'

const DB_NAME = 'photobooks-session'
const STORE_NAME = 'library-handles'
/** v3: single library + label; migrate legacy `__recents` on open. */
const DB_VERSION = 3

export { ACTIVE_KEY, LABEL_KEY, RECENTS_KEY }

export type SessionIdbGetResult =
  { present: true; value: unknown } | { present: false }

type SessionIdbMutation =
  { op: 'set'; key: string; value: unknown } | { op: 'del'; key: string }

export interface SessionIdb {
  get: (key: string) => Promise<SessionIdbGetResult>
  set: (key: string, value: unknown) => Promise<void>
  del: (key: string) => Promise<void>
  keys: () => Promise<string[]>
  runReadwrite: (mutations: readonly SessionIdbMutation[]) => Promise<void>
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
      // Recents → single-library migration runs after open (needs async gets).
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

/**
 * Adopt the most recent legacy `__recents` entry as the single library handle,
 * drop other handle keys and `__recents`, and store the label.
 */
export async function migrateLegacyRecents(idb: SessionIdb): Promise<void> {
  const recentsStored = await idb.get(RECENTS_KEY)
  if (!recentsStored.present) {
    return
  }
  const recents = parseRecents(recentsStored.value)
  const mutations: SessionIdbMutation[] = [{ op: 'del', key: RECENTS_KEY }]

  if (recents.length === 0) {
    await idb.runReadwrite(mutations)
    return
  }

  const mostRecent = recents[0]
  // Stryker disable next-line ConditionalExpression,BlockStatement: length===0 already returned; indexed access is for TS
  if (mostRecent === undefined) {
    await idb.runReadwrite(mutations)
    return
  }
  const preferredId = mostRecent.id
  const handleStored = await idb.get(preferredId)
  const allKeys = await idb.keys()

  for (const key of allKeys) {
    if (isReservedSessionKey(key)) {
      continue
    }
    if (key === preferredId && handleStored.present) {
      continue
    }
    mutations.push({ op: 'del', key })
  }

  if (handleStored.present) {
    if (preferredId !== DEFAULT_LIBRARY_ID) {
      mutations.push({ op: 'del', key: preferredId })
      mutations.push({
        op: 'set',
        key: DEFAULT_LIBRARY_ID,
        value: handleStored.value,
      })
    }
    const existingLabel = await idb.get(LABEL_KEY)
    if (
      !existingLabel.present ||
      parseLibraryLabel(existingLabel.value) === null
    ) {
      mutations.push({
        op: 'set',
        key: LABEL_KEY,
        value: mostRecent.label,
      })
    }
    const activeStored = await idb.get(ACTIVE_KEY)
    if (activeStored.present) {
      const active = parseActiveIds(activeStored.value)
      if (
        active.libraryId !== null &&
        active.libraryId !== DEFAULT_LIBRARY_ID
      ) {
        mutations.push({
          op: 'set',
          key: ACTIVE_KEY,
          value: {
            libraryId: DEFAULT_LIBRARY_ID,
            bookId: active.bookId,
          },
        })
      }
    }
  }

  await idb.runReadwrite(mutations)
}

export function createSessionIdb(): SessionIdb {
  const idb: SessionIdb = {
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
    async keys() {
      const db = await openDb()
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const raw = await requestToPromise(store.getAllKeys())
        return raw.map(String)
      } finally {
        db.close()
      }
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
  return idb
}
