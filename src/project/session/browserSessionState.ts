import type { StorageFailure, StorageResult } from '../types'
import type { SessionIdb } from './idb'
import { ACTIVE_KEY, createSessionIdb, RECENTS_KEY } from './idb'
import type { SessionLocks } from './locks'
import { bookLockName, createNavigatorSessionLocks } from './locks'
import {
  isReservedSessionKey,
  labelForHandle,
  parseActiveIds,
  parseRecents,
  removeRecent,
  upsertRecentFront,
} from './recents'
import type {
  BookLock,
  RecentLibrary,
  SessionDirectoryHandle,
  SessionState,
} from './types'

export interface CreateBrowserSessionStateOptions {
  idb?: SessionIdb
  locks?: SessionLocks
}

function failure(code: StorageFailure['code']): StorageFailure {
  return { ok: false, code }
}

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function isFileSystemHandle(
  value: unknown,
): value is FileSystemDirectoryHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value as FileSystemHandle).kind === 'directory'
  )
}

async function hasReadwritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (typeof handle.queryPermission !== 'function') {
    return true
  }
  const state = await handle.queryPermission({ mode: 'readwrite' })
  return state === 'granted'
}

async function readRecents(idb: SessionIdb): Promise<RecentLibrary[]> {
  const stored = await idb.get(RECENTS_KEY)
  if (!stored.present) {
    return []
  }
  return parseRecents(stored.value)
}

export function createBrowserSessionState(
  options: CreateBrowserSessionStateOptions = {},
): SessionState {
  const idb = options.idb ?? createSessionIdb()
  const locks = options.locks ?? createNavigatorSessionLocks()

  return {
    async rememberLibraryHandle(libraryId, handle, label) {
      if (isReservedSessionKey(libraryId)) {
        return failure('not-found')
      }
      await idb.set(libraryId, handle)
      const recents = await readRecents(idb)
      await idb.set(
        RECENTS_KEY,
        upsertRecentFront(recents, {
          id: libraryId,
          label: labelForHandle(libraryId, handle, label),
        }),
      )
      return success(undefined)
    },

    async recallLibraryHandle(libraryId) {
      if (isReservedSessionKey(libraryId)) {
        return failure('not-found')
      }
      const stored = await idb.get(libraryId)
      if (!stored.present) {
        return failure('not-found')
      }
      if (!isFileSystemHandle(stored.value)) {
        return failure('not-found')
      }
      if (!(await hasReadwritePermission(stored.value))) {
        return failure('permission-required')
      }
      const handle: SessionDirectoryHandle = stored.value
      return success(handle)
    },

    async clearLibraryHandle(libraryId) {
      if (isReservedSessionKey(libraryId)) {
        return failure('not-found')
      }
      const stored = await idb.get(libraryId)
      if (!stored.present) {
        return failure('not-found')
      }
      await idb.del(libraryId)
      const recents = await readRecents(idb)
      await idb.set(RECENTS_KEY, removeRecent(recents, libraryId))
      return success(undefined)
    },

    async listRecentLibraries() {
      return readRecents(idb)
    },

    async setActiveIds(ids) {
      await idb.set(ACTIVE_KEY, {
        libraryId: ids.libraryId,
        bookId: ids.bookId,
      })
      return success(undefined)
    },

    async getActiveIds() {
      const stored = await idb.get(ACTIVE_KEY)
      if (!stored.present) {
        return { libraryId: null, bookId: null }
      }
      return parseActiveIds(stored.value)
    },

    async acquireBookLock(bookId) {
      let releaseHold!: () => void
      const held = new Promise<void>((resolve) => {
        releaseHold = resolve
      })

      let settleAcquire!: (acquired: boolean) => void
      const acquiredPromise = new Promise<boolean>((resolve) => {
        settleAcquire = resolve
      })

      const requestDone = locks.request(
        bookLockName(bookId),
        { ifAvailable: true },
        async (lock) => {
          if (lock === null) {
            settleAcquire(false)
            return
          }
          settleAcquire(true)
          await held
        },
      )

      const acquired = await acquiredPromise
      if (!acquired) {
        await requestDone
        return failure('locked-elsewhere')
      }

      const bookLock: BookLock = {
        async release() {
          releaseHold()
          await requestDone
        },
      }
      return success(bookLock)
    },
  }
}
