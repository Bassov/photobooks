import type { Book } from '../core'

/** Placeholder until site settings land on the library document. */
export type LibraryMeta = Record<string, never>

export interface BookSummary {
  id: string
}

export type StorageFailureCode =
  | 'permission-required'
  | 'locked-elsewhere'
  | 'not-found'
  | 'corrupted'
  | 'newer-schema'
  | 'already-exists'

export interface StorageFailure {
  ok: false
  code: StorageFailureCode
}

export interface StorageSuccess<T> {
  ok: true
  value: T
}

export type StorageResult<T> = StorageSuccess<T> | StorageFailure

export interface LibraryStorage {
  getLibrary: () => Promise<StorageResult<LibraryMeta>>
  updateLibrary: (meta: LibraryMeta) => Promise<StorageResult<LibraryMeta>>
  listBooks: () => Promise<StorageResult<BookSummary[]>>
  createBook: (book: Book) => Promise<StorageResult<Book>>
  loadBook: (id: string) => Promise<StorageResult<Book>>
  saveBook: (book: Book) => Promise<StorageResult<Book>>
  deleteBook: (id: string) => Promise<StorageResult<void>>
}
