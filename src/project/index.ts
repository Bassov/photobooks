export type {
  BookSummary,
  LibraryMeta,
  LibraryStorage,
  StorageFailure,
  StorageFailureCode,
  StorageResult,
  StorageSuccess,
} from './types'
export {
  bookTitleFromUnknown,
  displayBookTitle,
  normalizeBookTitleInput,
} from './bookTitle'
export { createMemoryLibraryStorage, type MemoryLibraryStorage } from './memory'
export {
  createFsaLibraryStorage,
  type CreateFsaLibraryStorageOptions,
  type FsaLibraryStorage,
} from './fsa/fsaLibraryStorage'
export { createMemoryDirectory } from './fsa/memoryDirectory'
export {
  fromFileSystemDirectoryHandle,
  type LibraryDirectoryHandle,
  type LibraryFileHandle,
} from './fsa/handles'
export type {
  BookLock,
  SessionActiveIds,
  SessionDirectoryHandle,
  SessionState,
} from './session/types'
export { DEFAULT_LIBRARY_ID } from './session/types'
export {
  createMemorySessionState,
  type MemorySessionState,
} from './session/memorySessionState'
export {
  createBrowserSessionState,
  type CreateBrowserSessionStateOptions,
} from './session/browserSessionState'
export {
  clearBookPhotoRoot,
  clearSourceRootHandle,
  getBookPhotoRoot,
  peekSourceRootHandle,
  recallSourceRootHandle,
  rememberSourceRootHandle,
  setBookPhotoRoot,
  type BookPhotoRoot,
  type BrowserSourceRootHandlesOptions,
} from './session/browserSourceRootHandles'
