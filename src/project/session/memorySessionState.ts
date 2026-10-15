import type { StorageFailure, StorageResult } from '../types'
import type { BookLock, SessionDirectoryHandle, SessionState } from './types'

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
  const heldLocks = new Set<string>()
  let permissionRequired = false

  return {
    setPermissionRequired(required: boolean) {
      permissionRequired = required
    },

    rememberLibraryHandle(libraryId, handle) {
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      handles.set(libraryId, handle)
      return Promise.resolve(success(undefined))
    },

    recallLibraryHandle(libraryId) {
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      const handle = handles.get(libraryId)
      if (handle === undefined) {
        return Promise.resolve(failure('not-found'))
      }
      return Promise.resolve(success(handle))
    },

    clearLibraryHandle(libraryId) {
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      if (!handles.has(libraryId)) {
        return Promise.resolve(failure('not-found'))
      }
      handles.delete(libraryId)
      return Promise.resolve(success(undefined))
    },

    acquireBookLock(bookId) {
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      if (heldLocks.has(bookId)) {
        return Promise.resolve(failure('locked-elsewhere'))
      }
      heldLocks.add(bookId)
      const lock: BookLock = {
        release() {
          heldLocks.delete(bookId)
          return Promise.resolve()
        },
      }
      return Promise.resolve(success(lock))
    },
  }
}
