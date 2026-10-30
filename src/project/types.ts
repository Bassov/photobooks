import type { Book } from '../core'

/** Placeholder until site settings land on the library document. */
export type LibraryMeta = Record<string, never>

export interface BookSummary {
  id: string
  title: string
  /** Present when the book document parsed successfully. */
  spreadCount?: number
  pageWidthMm?: number
  pageHeightMm?: number
  /** Document modification time (UTC ms) when the adapter can observe it. */
  editedAtMs?: number
  /** DerivedCache key of the cover-front photo, when it has a durable identity. */
  coverCacheKey?: string
  /** Cover-front crop center (0..1), for the shelf card's object-position. */
  coverCenter?: { x: number; y: number }
}

export type StorageFailureCode =
  | 'permission-required'
  | 'locked-elsewhere'
  | 'not-found'
  | 'corrupted'
  | 'newer-schema'
  | 'already-exists'
  | 'storage-unavailable'

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
