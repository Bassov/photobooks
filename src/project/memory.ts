import { parseBook, type Book } from '../core'
import type {
  BookSummary,
  LibraryMeta,
  LibraryStorage,
  StorageFailure,
  StorageResult,
} from './types'

export type MemoryLibraryStorage = LibraryStorage & {
  setPermissionRequired: (required: boolean) => void
  setLockedElsewhere: (locked: boolean) => void
  /** Adapter-local seam for contract suite corrupt / newer-schema seeds. */
  seedRawBook: (id: string, raw: unknown) => void
}

function failure(code: StorageFailure['code']): StorageFailure {
  return { ok: false, code }
}

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function mapParseFailure(
  result: Extract<ReturnType<typeof parseBook>, { ok: false }>,
): StorageFailure {
  if (result.code === 'newer-schema') {
    return failure('newer-schema')
  }
  return failure('corrupted')
}

export function createMemoryLibraryStorage(): MemoryLibraryStorage {
  let libraryMeta: LibraryMeta = {}
  const books = new Map<string, unknown>()
  let permissionRequired = false
  let lockedElsewhere = false

  const gateRead = <T>(run: () => StorageResult<T>): StorageResult<T> => {
    if (permissionRequired) {
      return failure('permission-required')
    }
    return run()
  }

  const gateWrite = <T>(run: () => StorageResult<T>): StorageResult<T> => {
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
    seedRawBook(id: string, raw: unknown) {
      books.set(id, structuredClone(raw))
    },
    getLibrary() {
      return Promise.resolve(gateRead(() => success(libraryMeta)))
    },
    updateLibrary(meta: LibraryMeta) {
      return Promise.resolve(
        gateWrite(() => {
          libraryMeta = structuredClone(meta)
          return success(libraryMeta)
        }),
      )
    },
    listBooks() {
      return Promise.resolve(
        gateRead(() => {
          const summaries: BookSummary[] = [...books.keys()].map((id) => ({
            id,
          }))
          return success(summaries)
        }),
      )
    },
    createBook(book: Book) {
      return Promise.resolve(
        gateWrite(() => {
          if (books.has(book.id)) {
            return failure('already-exists')
          }
          books.set(book.id, structuredClone(book))
          return success(structuredClone(book))
        }),
      )
    },
    loadBook(id: string) {
      return Promise.resolve(
        gateRead(() => {
          if (!books.has(id)) {
            return failure('not-found')
          }
          const raw = books.get(id)
          const parsed = parseBook(raw)
          if (!parsed.ok) {
            return mapParseFailure(parsed)
          }
          return success(parsed.book)
        }),
      )
    },
    saveBook(book: Book) {
      return Promise.resolve(
        gateWrite(() => {
          if (!books.has(book.id)) {
            return failure('not-found')
          }
          books.set(book.id, structuredClone(book))
          return success(structuredClone(book))
        }),
      )
    },
    deleteBook(id: string) {
      return Promise.resolve(
        gateWrite(() => {
          if (!books.has(id)) {
            return failure('not-found')
          }
          books.delete(id)
          return success(undefined)
        }),
      )
    },
  }
}
