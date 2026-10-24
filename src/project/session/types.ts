import type { StorageResult } from '../types'

/** Opaque directory handle; browser adapter uses FileSystemDirectoryHandle. */
export type SessionDirectoryHandle = object

export interface BookLock {
  release: () => Promise<void>
}

/** Stable product library id (exactly one remembered handle). */
export const DEFAULT_LIBRARY_ID = 'library'

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
  /** Opaque stored handle without requiring readwrite permission. */
  peekLibraryHandle: (
    libraryId: string,
  ) => Promise<StorageResult<SessionDirectoryHandle>>
  clearLibraryHandle: (libraryId: string) => Promise<StorageResult<void>>
  /** Folder-name label for the remembered library, or null when none. */
  getLibraryLabel: (libraryId: string) => Promise<string | null>
  setActiveIds: (ids: SessionActiveIds) => Promise<StorageResult<void>>
  getActiveIds: () => Promise<SessionActiveIds>
  acquireBookLock: (bookId: string) => Promise<StorageResult<BookLock>>
}
