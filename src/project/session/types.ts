import type { StorageResult } from '../types'

/** Opaque directory handle; browser adapter uses FileSystemDirectoryHandle. */
export type SessionDirectoryHandle = object

export interface BookLock {
  release: () => Promise<void>
}

export interface RecentLibrary {
  id: string
  label: string
}

export interface SessionActiveIds {
  libraryId: string | null
  bookId: string | null
}

export interface SessionState {
  rememberLibraryHandle: (
    libraryId: string,
    handle: SessionDirectoryHandle,
    label?: string,
  ) => Promise<StorageResult<void>>
  recallLibraryHandle: (
    libraryId: string,
  ) => Promise<StorageResult<SessionDirectoryHandle>>
  clearLibraryHandle: (libraryId: string) => Promise<StorageResult<void>>
  listRecentLibraries: () => Promise<readonly RecentLibrary[]>
  setActiveIds: (ids: SessionActiveIds) => Promise<StorageResult<void>>
  getActiveIds: () => Promise<SessionActiveIds>
  acquireBookLock: (bookId: string) => Promise<StorageResult<BookLock>>
}
