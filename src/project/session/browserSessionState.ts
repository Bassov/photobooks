import type { StorageFailure, StorageResult } from '../types'
import type { SessionIdb } from './idb'
import {
  ACTIVE_KEY,
  createSessionIdb,
  LABEL_KEY,
  migrateLegacyRecents,
} from './idb'
import {
  isReservedSessionKey,
  labelForHandle,
  parseActiveIds,
  parseLibraryLabel,
} from './libraryLabel'
import type { SessionLocks } from './locks'
import { bookLockName, createNavigatorSessionLocks } from './locks'
import type { BookLock, SessionDirectoryHandle, SessionState } from './types'
import { DEFAULT_LIBRARY_ID } from './types'

export interface CreateBrowserSessionStateOptions {
  idb?: SessionIdb
  locks?: SessionLocks
  /** Skip automatic legacy-recents migration (tests). */
  skipLegacyMigration?: boolean
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

async function clearOtherHandleKeys(
  idb: SessionIdb,
  keepId: string,
): Promise<void> {
  const keys = await idb.keys()
  const deletions = keys
    .filter((key) => !isReservedSessionKey(key) && key !== keepId)
    .map((key) => ({ op: 'del' as const, key }))
  if (deletions.length > 0) {
    await idb.runReadwrite(deletions)
  }
}

export function createBrowserSessionState(
  options: CreateBrowserSessionStateOptions = {},
): SessionState {
  const idb = options.idb ?? createSessionIdb()
  const locks = options.locks ?? createNavigatorSessionLocks()

  let migration: Promise<void> | null = null
  function ensureMigrated(): Promise<void> {
    if (options.skipLegacyMigration) {
      return Promise.resolve()
    }
    migration ??= migrateLegacyRecents(idb).catch(() => {
      // Soft-fail migration; subsequent ops still use typed failures.
    })
    return migration
  }

  return {
    async rememberLibraryHandle(libraryId, handle, label) {
      await ensureMigrated()
      if (isReservedSessionKey(libraryId)) {
        return failure('not-found')
      }
      try {
        const nextLabel = labelForHandle(libraryId, handle, label)
        await clearOtherHandleKeys(idb, libraryId)
        await idb.runReadwrite([
          { op: 'set', key: libraryId, value: handle },
          { op: 'set', key: LABEL_KEY, value: nextLabel },
        ])
        return success(undefined)
      } catch {
        return failure('not-found')
      }
    },

    async recallLibraryHandle(libraryId) {
      await ensureMigrated()
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
      await ensureMigrated()
      return readStoredHandle(idb, libraryId)
    },

    async clearLibraryHandle(libraryId) {
      await ensureMigrated()
      if (isReservedSessionKey(libraryId)) {
        return failure('not-found')
      }
      try {
        const stored = await idb.get(libraryId)
        if (!stored.present) {
          return failure('not-found')
        }
        await idb.runReadwrite([
          { op: 'del', key: libraryId },
          { op: 'del', key: LABEL_KEY },
        ])
        return success(undefined)
      } catch {
        return failure('not-found')
      }
    },

    async getLibraryLabel(libraryId) {
      await ensureMigrated()
      if (isReservedSessionKey(libraryId)) {
        return null
      }
      const handle = await readStoredHandle(idb, libraryId)
      if (!handle.ok) {
        // Prefer DEFAULT_LIBRARY_ID label when callers ask with that id after migrate.
        if (libraryId === DEFAULT_LIBRARY_ID) {
          const stored = await idb.get(LABEL_KEY)
          return stored.present ? parseLibraryLabel(stored.value) : null
        }
        return null
      }
      const stored = await idb.get(LABEL_KEY)
      if (stored.present) {
        const parsed = parseLibraryLabel(stored.value)
        if (parsed !== null) {
          return parsed
        }
      }
      return labelForHandle(libraryId, handle.value)
    },

    async setActiveIds(ids) {
      await ensureMigrated()
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
      await ensureMigrated()
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
