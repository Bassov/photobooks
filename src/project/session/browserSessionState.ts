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

async function readStoredHandle(
  idb: SessionIdb,
  libraryId: string,
): Promise<StorageResult<SessionDirectoryHandle>> {
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
  return success(stored.value)
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
      try {
        const recents = await readRecents(idb)
        const nextRecents = upsertRecentFront(recents, {
          id: libraryId,
          label: labelForHandle(libraryId, handle, label),
        })
        await idb.runReadwrite([
          { op: 'set', key: libraryId, value: handle },
          { op: 'set', key: RECENTS_KEY, value: nextRecents },
        ])
        return success(undefined)
      } catch {
        return failure('not-found')
      }
    },

    async recallLibraryHandle(libraryId) {
      const peeked = await readStoredHandle(idb, libraryId)
      if (!peeked.ok) {
        return peeked
      }
      if (
        !(await hasReadwritePermission(
          peeked.value as FileSystemDirectoryHandle,
        ))
      ) {
        return failure('permission-required')
      }
      return peeked
    },

    async peekLibraryHandle(libraryId) {
      return readStoredHandle(idb, libraryId)
    },

    async clearLibraryHandle(libraryId) {
      if (isReservedSessionKey(libraryId)) {
        return failure('not-found')
      }
      try {
        const stored = await idb.get(libraryId)
        if (!stored.present) {
          return failure('not-found')
        }
        const recents = await readRecents(idb)
        await idb.runReadwrite([
          { op: 'del', key: libraryId },
          {
            op: 'set',
            key: RECENTS_KEY,
            value: removeRecent(recents, libraryId),
          },
        ])
        return success(undefined)
      } catch {
        return failure('not-found')
      }
    },

    async removeRecentLibrary(libraryId) {
      return this.clearLibraryHandle(libraryId)
    },

    async listRecentLibraries() {
      try {
        return success(await readRecents(idb))
      } catch {
        return failure('not-found')
      }
    },

    async setActiveIds(ids) {
      try {
        await idb.set(ACTIVE_KEY, {
          libraryId: ids.libraryId,
          bookId: ids.bookId,
        })
        return success(undefined)
      } catch {
        return failure('not-found')
      }
    },

    async getActiveIds() {
      try {
        const stored = await idb.get(ACTIVE_KEY)
        if (!stored.present) {
          return { libraryId: null, bookId: null }
        }
        return parseActiveIds(stored.value)
      } catch {
        return { libraryId: null, bookId: null }
      }
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
