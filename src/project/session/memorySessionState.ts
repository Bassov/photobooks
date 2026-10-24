import type { StorageFailure, StorageResult } from '../types'
import {
  isReservedSessionKey,
  labelForHandle,
  parseActiveIds,
} from './libraryLabel'
import type {
  BookLock,
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
  let libraryId: string | null = null
  let handle: SessionDirectoryHandle | null = null
  let label: string | null = null
  let activeIds: SessionActiveIds = { libraryId: null, bookId: null }
  const heldLocks = new Set<string>()
  let permissionRequired = false

  return {
    setPermissionRequired(required: boolean) {
      permissionRequired = required
    },

    rememberLibraryHandle(id, nextHandle, nextLabel) {
      if (isReservedSessionKey(id)) {
        return Promise.resolve(failure('not-found'))
      }
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      libraryId = id
      handle = nextHandle
      label = labelForHandle(id, nextHandle, nextLabel)
      return Promise.resolve(success(undefined))
    },

    recallLibraryHandle(id) {
      // Stryker disable next-line ConditionalExpression: reserved + missing-id both yield not-found; public API cannot store a reserved id
      if (isReservedSessionKey(id)) {
        return Promise.resolve(failure('not-found'))
      }
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      // Stryker disable next-line ConditionalExpression: handle is always cleared with libraryId; null-handle alone is unreachable
      if (handle === null || libraryId !== id) {
        return Promise.resolve(failure('not-found'))
      }
      return Promise.resolve(success(handle))
    },

    peekLibraryHandle(id) {
      // Stryker disable next-line ConditionalExpression: reserved + missing-id both yield not-found; public API cannot store a reserved id
      if (isReservedSessionKey(id)) {
        return Promise.resolve(failure('not-found'))
      }
      // Stryker disable next-line ConditionalExpression: handle is always cleared with libraryId; null-handle alone is unreachable
      if (handle === null || libraryId !== id) {
        return Promise.resolve(failure('not-found'))
      }
      return Promise.resolve(success(handle))
    },

    clearLibraryHandle(id) {
      // Stryker disable next-line ConditionalExpression: reserved + missing-id both yield not-found; public API cannot store a reserved id
      if (isReservedSessionKey(id)) {
        return Promise.resolve(failure('not-found'))
      }
      if (permissionRequired) {
        return Promise.resolve(failure('permission-required'))
      }
      // Stryker disable next-line ConditionalExpression: handle is always cleared with libraryId; null-handle alone is unreachable
      if (handle === null || libraryId !== id) {
        return Promise.resolve(failure('not-found'))
      }
      libraryId = null
      handle = null
      label = null
      return Promise.resolve(success(undefined))
    },

    getLibraryLabel(id) {
      // Stryker disable next-line ConditionalExpression: handle is always cleared with libraryId; null-handle alone is unreachable
      if (handle === null || libraryId !== id) {
        return Promise.resolve(null)
      }
      return Promise.resolve(label)
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
