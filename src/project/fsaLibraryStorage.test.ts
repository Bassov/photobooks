import { describe, expect, it } from 'vitest'

import { makeBook } from '../core/testing/fixtures'
import { loadBookTextSync } from './fsa/bookLoadWorkerClient'
import { createFakeBrowserDirectory } from './fsa/browserDirectory.test-helpers'
import { createFsaLibraryStorage } from './fsa/fsaLibraryStorage'
import {
  BOOK_JSON,
  BOOK_JSON_BAK,
  BOOKS_DIR,
  LIBRARY_JSON,
  writeLibraryMeta,
} from './fsa/layout'
import {
  createMemoryDirectory,
  memoryDirectoryExists,
  readMemoryFileText,
} from './fsa/memoryDirectory'
import { runLibraryStorageContract } from './libraryStorage.contract.test-helpers'

function createFsaHarness() {
  const root = createMemoryDirectory()
  const storage = createFsaLibraryStorage({
    root,
    loadBookText: loadBookTextSync,
  })
  return {
    root,
    storage,
    setPermissionRequired: storage.setPermissionRequired,
    setLockedElsewhere: storage.setLockedElsewhere,
    seedRawBook: (id: string, raw: unknown) => storage.seedRawBook(id, raw),
  }
}

runLibraryStorageContract(() => {
  const harness = createFsaHarness()
  return {
    storage: harness.storage,
    setPermissionRequired: harness.setPermissionRequired,
    setLockedElsewhere: harness.setLockedElsewhere,
    seedRawBook: harness.seedRawBook,
  }
})

describe('FSA library storage layout', () => {
  it('writes book.json under books/<id> and round-trips save/load', async () => {
    const { root, storage } = createFsaHarness()
    const book = makeBook({ id: 'fsa-roundtrip' })

    await storage.createBook(book)
    expect(
      await readMemoryFileText(root, [BOOKS_DIR, book.id, BOOK_JSON]),
    ).toContain(book.id)

    const updated = {
      ...book,
      settings: { ...book.settings, bleedMm: 8 },
    }
    await storage.saveBook(updated)
    const bak = await readMemoryFileText(root, [
      BOOKS_DIR,
      book.id,
      BOOK_JSON_BAK,
    ])
    expect(bak).toContain('"bleedMm":3')

    const loaded = await storage.loadBook(book.id)
    expect(loaded).toEqual({ ok: true, value: updated })
  })

  it('fails library reads and writes on a newer library.json without overwriting it', async () => {
    const { root, storage } = createFsaHarness()
    const newer = '{"schemaVersion":7}'
    const file = await root.getFile(LIBRARY_JSON, { create: true })
    await file.writeText(newer)

    expect(await storage.getLibrary()).toEqual({
      ok: false,
      code: 'newer-schema',
    })
    expect(await storage.updateLibrary({})).toEqual({
      ok: false,
      code: 'newer-schema',
    })
    expect(await readMemoryFileText(root, [LIBRARY_JSON])).toBe(newer)
  })

  it('deletes the book directory and lists from books/ not library.json', async () => {
    const { root, storage } = createFsaHarness()
    const book = makeBook({ id: 'fsa-delete' })
    await storage.createBook(book)

    await writeLibraryMeta(root, {})
    const libraryText = await readMemoryFileText(root, [LIBRARY_JSON])
    expect(libraryText).toBe('{"schemaVersion":1}')

    const listed = await storage.listBooks()
    expect(listed).toMatchObject({
      ok: true,
      value: [
        {
          id: book.id,
          title: book.title ?? '',
          spreadCount: book.spreads.length,
          pageWidthMm: book.settings.trim.widthMm,
          pageHeightMm: book.settings.trim.heightMm,
        },
      ],
    })
    expect(listed.ok && typeof listed.value[0]?.editedAtMs === 'number').toBe(
      true,
    )

    await storage.deleteBook(book.id)
    expect(await memoryDirectoryExists(root, [BOOKS_DIR, book.id])).toBe(false)
    expect(await storage.listBooks()).toEqual({ ok: true, value: [] })
  })

  it('create does not write book.json.bak', async () => {
    const { root, storage } = createFsaHarness()
    const book = makeBook({ id: 'fsa-no-bak' })
    await storage.createBook(book)
    expect(
      await readMemoryFileText(root, [BOOKS_DIR, book.id, BOOK_JSON_BAK]),
    ).toBeUndefined()
  })

  it('lists corrupt books with empty title while keeping the id', async () => {
    const { storage, seedRawBook } = createFsaHarness()
    await seedRawBook('corrupt-book', { not: 'a-book' })
    const listed = await storage.listBooks()
    expect(listed).toMatchObject({
      ok: true,
      value: [{ id: 'corrupt-book', title: '' }],
    })
    expect(listed.ok && typeof listed.value[0]?.editedAtMs === 'number').toBe(
      true,
    )
  })

  it('lists book dirs without book.json with empty title', async () => {
    const { root, storage } = createFsaHarness()
    const books = await root.getDirectory(BOOKS_DIR, { create: true })
    await books.getDirectory('no-json', { create: true })
    expect(await storage.listBooks()).toEqual({
      ok: true,
      value: [{ id: 'no-json', title: '' }],
    })
  })

  it('lists titled books from stored documents', async () => {
    const { storage } = createFsaHarness()
    const book = makeBook({ id: 'named', title: 'Summer' })
    await storage.createBook(book)
    const listed = await storage.listBooks()
    expect(listed).toMatchObject({
      ok: true,
      value: [
        {
          id: 'named',
          title: 'Summer',
          spreadCount: book.spreads.length,
          pageWidthMm: book.settings.trim.widthMm,
          pageHeightMm: book.settings.trim.heightMm,
        },
      ],
    })
    expect(listed.ok && typeof listed.value[0]?.editedAtMs === 'number').toBe(
      true,
    )
  })

  it('accepts a browser FileSystemDirectoryHandle via the adapter wrapper', async () => {
    const browserRoot = createFakeBrowserDirectory()
    expect(typeof (browserRoot as { list?: unknown }).list).toBe('undefined')

    const storage = createFsaLibraryStorage({
      root: browserRoot,
      loadBookText: loadBookTextSync,
    })
    const book = makeBook({ id: 'browser-root-book' })
    expect(await storage.createBook(book)).toEqual({ ok: true, value: book })
    expect(await storage.loadBook(book.id)).toEqual({ ok: true, value: book })
    const listed = await storage.listBooks()
    expect(listed).toMatchObject({
      ok: true,
      value: [
        {
          id: book.id,
          title: book.title ?? '',
          spreadCount: book.spreads.length,
          pageWidthMm: book.settings.trim.widthMm,
          pageHeightMm: book.settings.trim.heightMm,
        },
      ],
    })
    expect(listed.ok && typeof listed.value[0]?.editedAtMs === 'number').toBe(
      true,
    )
  })
})
