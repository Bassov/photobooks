import type { StorageResult } from '../types'

/** Opaque directory handle; browser adapter uses FileSystemDirectoryHandle. */
export type SessionDirectoryHandle = object

export interface BookLock {
  release: () => Promise<void>
}

export interface SessionState {
  rememberLibraryHandle: (
    libraryId: string,
    handle: SessionDirectoryHandle,
  ) => Promise<StorageResult<void>>
  recallLibraryHandle: (
    libraryId: string,
  ) => Promise<StorageResult<SessionDirectoryHandle>>
  clearLibraryHandle: (libraryId: string) => Promise<StorageResult<void>>
  acquireBookLock: (bookId: string) => Promise<StorageResult<BookLock>>
}
