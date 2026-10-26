import { serializeBook, type Book } from '../../core'
import type { LibraryMeta } from '../types'
import type { LibraryDirectoryHandle } from './handles'

export const LIBRARY_JSON = 'library.json'
export const BOOKS_DIR = 'books'
export const BOOK_JSON = 'book.json'
export const BOOK_JSON_BAK = 'book.json.bak'

export async function readLibraryMeta(
  root: LibraryDirectoryHandle,
): Promise<LibraryMeta> {
  try {
    const file = await root.getFile(LIBRARY_JSON)
    const text = await file.getText()
    if (text.trim() === '') {
      return {}
    }
    const parsed: unknown = JSON.parse(text)
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return {}
    }
    return parsed as LibraryMeta
  } catch (error) {
    if (isNotFoundError(error)) {
      return {}
    }
    throw error
  }
}

export async function writeLibraryMeta(
  root: LibraryDirectoryHandle,
  meta: LibraryMeta,
): Promise<void> {
  const file = await root.getFile(LIBRARY_JSON, { create: true })
  await file.writeText(JSON.stringify(meta))
}

export async function listBookIds(
  root: LibraryDirectoryHandle,
): Promise<string[]> {
  let books: LibraryDirectoryHandle
  try {
    books = await root.getDirectory(BOOKS_DIR)
  } catch (error) {
    if (isNotFoundError(error)) {
      return []
    }
    throw error
  }

  const entries = await books.list()
  return entries
    .filter((entry) => entry.kind === 'directory')
    .map((entry) => entry.name)
}

export async function bookDirectoryExists(
  root: LibraryDirectoryHandle,
  bookId: string,
): Promise<boolean> {
  try {
    const books = await root.getDirectory(BOOKS_DIR)
    await books.getDirectory(bookId)
    return true
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }
    throw error
  }
}

export async function readBookJsonText(
  root: LibraryDirectoryHandle,
  bookId: string,
): Promise<string | undefined> {
  const listed = await readBookJsonListing(root, bookId)
  return listed?.text
}

/** book.json text + last-modified ms when the file exists. */
export async function readBookJsonListing(
  root: LibraryDirectoryHandle,
  bookId: string,
): Promise<{ text: string; editedAtMs: number } | undefined> {
  try {
    const bookDir = await getBookDirectory(root, bookId, false)
    const file = await bookDir.getFile(BOOK_JSON)
    const text = await file.getText()
    const editedAtMs = await file.getLastModifiedMs()
    return { text, editedAtMs }
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined
    }
    throw error
  }
}

export async function writeBookJson(
  root: LibraryDirectoryHandle,
  book: Book,
  options: { rotateBak: boolean },
): Promise<void> {
  const bookDir = await getBookDirectory(root, book.id, true)
  const payload = JSON.stringify(serializeBook(book))

  if (options.rotateBak) {
    try {
      const existing = await bookDir.getFile(BOOK_JSON)
      const previous = await existing.getText()
      const bak = await bookDir.getFile(BOOK_JSON_BAK, { create: true })
      await bak.writeText(previous)
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  const file = await bookDir.getFile(BOOK_JSON, { create: true })
  await file.writeText(payload)
}

export async function writeRawBookJson(
  root: LibraryDirectoryHandle,
  bookId: string,
  raw: unknown,
): Promise<void> {
  const bookDir = await getBookDirectory(root, bookId, true)
  const file = await bookDir.getFile(BOOK_JSON, { create: true })
  await file.writeText(JSON.stringify(raw))
}

export async function removeBookDirectory(
  root: LibraryDirectoryHandle,
  bookId: string,
): Promise<boolean> {
  try {
    const books = await root.getDirectory(BOOKS_DIR)
    await books.removeEntry(bookId, { recursive: true })
    return true
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }
    throw error
  }
}

async function getBookDirectory(
  root: LibraryDirectoryHandle,
  bookId: string,
  create: boolean,
): Promise<LibraryDirectoryHandle> {
  const books = await root.getDirectory(BOOKS_DIR, { create })
  return books.getDirectory(bookId, { create })
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}
