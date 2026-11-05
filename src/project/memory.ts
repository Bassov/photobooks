import { parseBook, type Book } from '../core'
import { bookSummaryFromBook } from './bookSummary'
import { bookTitleFromUnknown } from './bookTitle'
import {
  parseDefaultPrintProfileId,
  parsePrintProfiles,
  parseSavedTemplates,
} from './libraryDocument'
import {
  parsePublished,
  serializePublished,
  type PublishedRevision,
} from './publish'
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
  let libraryMeta: LibraryMeta = {
    books: {},
    templates: [],
    printProfiles: [],
    defaultPrintProfileId: parseDefaultPrintProfileId(undefined),
  }
  const books = new Map<string, unknown>()
  const published = new Map<string, unknown>()
  const editedAtMsById = new Map<string, number>()
  let permissionRequired = false
  let lockedElsewhere = false
  const touchEdited = (id: string): number => {
    const at = Date.now()
    editedAtMsById.set(id, at)
    return at
  }

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
      touchEdited(id)
    },
    getLibrary() {
      return Promise.resolve(gateRead(() => success(libraryMeta)))
    },
    updateLibrary(meta: LibraryMeta) {
      return Promise.resolve(
        gateWrite(() => {
          // Same shape the FSA adapter reads back from library.json.
          libraryMeta = {
            books: structuredClone(meta.books ?? {}),
            templates: parseSavedTemplates(meta.templates),
            printProfiles: parsePrintProfiles(meta.printProfiles),
            defaultPrintProfileId: parseDefaultPrintProfileId(
              meta.defaultPrintProfileId,
            ),
          }
          return success(libraryMeta)
        }),
      )
    },
    listBooks() {
      return Promise.resolve(
        gateRead(() => {
          const summaries: BookSummary[] = [...books.entries()].map(
            ([id, raw]) => {
              const editedAtMs = editedAtMsById.get(id)
              const parsed = parseBook(raw)
              if (!parsed.ok) {
                const summary: BookSummary = {
                  id,
                  title: bookTitleFromUnknown(raw),
                }
                if (editedAtMs !== undefined) {
                  summary.editedAtMs = editedAtMs
                }
                return summary
              }
              return bookSummaryFromBook(
                parsed.book,
                editedAtMs === undefined ? undefined : { editedAtMs },
              )
            },
          )
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
          touchEdited(book.id)
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
          touchEdited(book.id)
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
          editedAtMsById.delete(id)
          published.delete(id)
          return success(undefined)
        }),
      )
    },
    loadPublished(bookId: string) {
      return Promise.resolve(
        gateRead(() => {
          if (!published.has(bookId)) {
            return failure('not-found')
          }
          const parsed = parsePublished(published.get(bookId))
          return parsed.ok ? success(parsed.revision) : failure(parsed.code)
        }),
      )
    },
    savePublished(revision: PublishedRevision) {
      return Promise.resolve(
        gateWrite(() => {
          if (!books.has(revision.bookId)) {
            return failure('not-found')
          }
          // Same JSON round trip as the FSA adapter's `published.json`.
          published.set(
            revision.bookId,
            JSON.parse(JSON.stringify(serializePublished(revision))),
          )
          return success(structuredClone(revision))
        }),
      )
    },
  }
}
