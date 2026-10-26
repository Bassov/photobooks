import type { Book } from '../../core'
import { bookSummaryFromBook } from '../bookSummary'
import type {
  BookSummary,
  LibraryMeta,
  LibraryStorage,
  StorageFailure,
  StorageResult,
} from '../types'
import type { BookLoadResponse } from './bookLoad'
import { loadBookTextViaWorker } from './bookLoadWorkerClient'
import type { LibraryDirectoryHandle } from './handles'
import { fromFileSystemDirectoryHandle } from './handles'
import {
  bookDirectoryExists,
  listBookIds,
  readBookJsonListing,
  readBookJsonText,
  readLibraryMeta,
  removeBookDirectory,
  writeBookJson,
  writeLibraryMeta,
  writeRawBookJson,
} from './layout'

export type FsaLibraryStorage = LibraryStorage & {
  setPermissionRequired: (required: boolean) => void
  setLockedElsewhere: (locked: boolean) => void
  /** Adapter-local seam for contract suite corrupt / newer-schema seeds. */
  seedRawBook: (id: string, raw: unknown) => Promise<void>
}

export interface CreateFsaLibraryStorageOptions {
  root: LibraryDirectoryHandle | FileSystemDirectoryHandle
  /**
   * Injected load path (defaults to Web Worker). Tests may pass a sync
   * `processBookLoadRequest` wrapper so Vitest need not spawn workers.
   */
  loadBookText?: (text: string) => Promise<BookLoadResponse>
  /** Used when `loadBookText` is omitted; defaults to the Vite worker URL. */
  workerFactory?: () => Worker
}

function failure(code: StorageFailure['code']): StorageFailure {
  return { ok: false, code }
}

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function mapLoadFailure(
  result: Extract<BookLoadResponse, { ok: false }>,
): StorageFailure {
  return failure(result.code)
}

function isLibraryDirectoryHandle(
  root: LibraryDirectoryHandle | FileSystemDirectoryHandle,
): root is LibraryDirectoryHandle {
  return (
    typeof (root as LibraryDirectoryHandle).list === 'function' &&
    typeof (root as LibraryDirectoryHandle).getFile === 'function'
  )
}

export function createFsaLibraryStorage(
  options: CreateFsaLibraryStorageOptions,
): FsaLibraryStorage {
  const root = isLibraryDirectoryHandle(options.root)
    ? options.root
    : fromFileSystemDirectoryHandle(options.root)
  const workerFactory = options.workerFactory
  const loadBookText =
    options.loadBookText ??
    ((text: string) =>
      workerFactory === undefined
        ? loadBookTextViaWorker(text)
        : loadBookTextViaWorker(text, workerFactory))
  let permissionRequired = false
  let lockedElsewhere = false

  const gateRead = async <T>(
    run: () => Promise<StorageResult<T>>,
  ): Promise<StorageResult<T>> => {
    if (permissionRequired) {
      return failure('permission-required')
    }
    return run()
  }

  const gateWrite = async <T>(
    run: () => Promise<StorageResult<T>>,
  ): Promise<StorageResult<T>> => {
    if (permissionRequired) {
      return failure('permission-required')
    }
    if (lockedElsewhere) {
      return failure('locked-elsewhere')
    }
    return run()
  }

  return {
    setPermissionRequired(required: boolean) {
      permissionRequired = required
    },
    setLockedElsewhere(locked: boolean) {
      lockedElsewhere = locked
    },
    async seedRawBook(id: string, raw: unknown) {
      await writeRawBookJson(root, id, raw)
    },
    getLibrary() {
      return gateRead(async () => success(await readLibraryMeta(root)))
    },
    updateLibrary(meta: LibraryMeta) {
      return gateWrite(async () => {
        await writeLibraryMeta(root, meta)
        return success(await readLibraryMeta(root))
      })
    },
    listBooks() {
      return gateRead(async () => {
        const ids = await listBookIds(root)
        const summaries: BookSummary[] = []
        for (const id of ids) {
          const listed = await readBookJsonListing(root, id)
          if (listed === undefined) {
            summaries.push({ id, title: '' })
            continue
          }
          const loaded = await loadBookText(listed.text)
          if (loaded.ok) {
            summaries.push(
              bookSummaryFromBook(loaded.book, {
                editedAtMs: listed.editedAtMs,
              }),
            )
          } else {
            summaries.push({ id, title: '', editedAtMs: listed.editedAtMs })
          }
        }
        return success(summaries)
      })
    },
    createBook(book: Book) {
      return gateWrite(async () => {
        if (await bookDirectoryExists(root, book.id)) {
          return failure('already-exists')
        }
        await writeBookJson(root, book, { rotateBak: false })
        return success(structuredClone(book))
      })
    },
    loadBook(id: string) {
      return gateRead(async () => {
        const text = await readBookJsonText(root, id)
        if (text === undefined) {
          return failure('not-found')
        }
        const loaded = await loadBookText(text)
        if (!loaded.ok) {
          return mapLoadFailure(loaded)
        }
        return success(loaded.book)
      })
    },
    saveBook(book: Book) {
      return gateWrite(async () => {
        if (!(await bookDirectoryExists(root, book.id))) {
          return failure('not-found')
        }
        await writeBookJson(root, book, { rotateBak: true })
        return success(structuredClone(book))
      })
    },
    deleteBook(id: string) {
      return gateWrite(async () => {
        const removed = await removeBookDirectory(root, id)
        if (!removed) {
          return failure('not-found')
        }
        return success(undefined)
      })
    },
  }
}
