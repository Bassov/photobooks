import type { StorageFailure, StorageResult } from '../types'
import {
  isReservedSessionKey,
  labelForHandle,
  parseActiveIds,
  removeRecent,
  upsertRecentFront,
} from './recents'
import type {
  BookLock,
  RecentLibrary,
  SessionActiveIds,
  SessionDirectoryHandle,
  SessionState,
} from './types'

export type MemorySessionState = SessionState & {
  setPermissionRequired: (required: boolean) => void
}

function failure(code: StorageFailure['code']): StorageFailure {
  return { ok: false, code }
}

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

export function createMemorySessionState(): MemorySessionState {
  const handles = new Map<string, SessionDirectoryHandle>()
  let recents: RecentLibrary[] = []
  let activeIds: SessionActiveIds = { libraryId: null, bookId: null }
  const heldLocks = new Set<string>()
  let permissionRequired = false

  return {
    setPermissionRequired(required: boolean) {
      permissionRequired = required
    },

    rememberLibraryHandle(libraryId, handle, label) {
      if (isReservedSessionKey(libraryId)) {
        return Promise.resolve(failure('not-found'))
      }
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      handles.set(libraryId, handle)
      recents = upsertRecentFront(recents, {
        id: libraryId,
        label: labelForHandle(libraryId, handle, label),
      })
      return Promise.resolve(success(undefined))
    },

    recallLibraryHandle(libraryId) {
      if (isReservedSessionKey(libraryId)) {
        return Promise.resolve(failure('not-found'))
      }
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      const handle = handles.get(libraryId)
      if (handle === undefined) {
        return Promise.resolve(failure('not-found'))
      }
      return Promise.resolve(success(handle))
    },

    peekLibraryHandle(libraryId) {
      if (isReservedSessionKey(libraryId)) {
        return Promise.resolve(failure('not-found'))
      }
      const handle = handles.get(libraryId)
      if (handle === undefined) {
        return Promise.resolve(failure('not-found'))
      }
      return Promise.resolve(success(handle))
    },

    clearLibraryHandle(libraryId) {
      if (isReservedSessionKey(libraryId)) {
        return Promise.resolve(failure('not-found'))
      }
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      if (!handles.has(libraryId)) {
        return Promise.resolve(failure('not-found'))
      }
      handles.delete(libraryId)
      recents = removeRecent(recents, libraryId)
      return Promise.resolve(success(undefined))
    },

    removeRecentLibrary(libraryId) {
      return this.clearLibraryHandle(libraryId)
    },

    listRecentLibraries() {
      return Promise.resolve(success(recents.map((entry) => ({ ...entry }))))
    },

    setActiveIds(ids) {
      activeIds = {
        libraryId: ids.libraryId,
        bookId: ids.bookId,
      }
      return Promise.resolve(success(undefined))
    },

    getActiveIds() {
      return Promise.resolve(parseActiveIds(activeIds))
    },

    acquireBookLock(bookId) {
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      if (heldLocks.has(bookId)) {
        return Promise.resolve(failure('locked-elsewhere'))
      }
      heldLocks.add(bookId)
      const bookLock: BookLock = {
        release() {
          heldLocks.delete(bookId)
          return Promise.resolve()
        },
      }
      return Promise.resolve(success(bookLock))
    },
  }
}
