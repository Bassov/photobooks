import { describe, expect, it } from 'vitest'

import { makeBook } from '../core/testing/fixtures'
import { loadBookTextSync } from './fsa/bookLoadWorkerClient'
import {
  createFakeBrowserDirectory,
  createFakeDirectoryPicker,
  type FakeBrowserDirectoryHandle,
} from './fsa/browserDirectory.test-helpers'
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

  it('deletes the book directory and lists from books/ not library.json', async () => {
    const { root, storage } = createFsaHarness()
    const book = makeBook({ id: 'fsa-delete' })
    await storage.createBook(book)

    await writeLibraryMeta(root, {})
    const libraryText = await readMemoryFileText(root, [LIBRARY_JSON])
    expect(libraryText).toBe('{}')

    const listed = await storage.listBooks()
    expect(listed).toEqual({ ok: true, value: [{ id: book.id }] })

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
    expect(await storage.listBooks()).toEqual({
      ok: true,
      value: [{ id: book.id }],
    })
  })
})

describe('FSA library storage permission paths via shared fake', () => {
  async function bridgeFromQuery(
    handle: FakeBrowserDirectoryHandle,
    setPermissionRequired: (required: boolean) => void,
  ): Promise<PermissionState> {
    const state = await handle.queryPermission({ mode: 'readwrite' })
    setPermissionRequired(state !== 'granted')
    return state
  }

  async function bridgeFromRequest(
    handle: FakeBrowserDirectoryHandle,
    setPermissionRequired: (required: boolean) => void,
  ): Promise<PermissionState> {
    const state = await handle.requestPermission({ mode: 'readwrite' })
    setPermissionRequired(state !== 'granted')
    return state
  }

  it('deny: query denied gates list/create as permission-required', async () => {
    const handle = createFakeBrowserDirectory()
    handle.enqueueQueryResults('denied')
    const storage = createFsaLibraryStorage({
      root: handle,
      loadBookText: loadBookTextSync,
    })
    const book = makeBook({ id: 'deny-book' })

    await bridgeFromQuery(handle, storage.setPermissionRequired)

    await expect(storage.listBooks()).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })
    await expect(storage.createBook(book)).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })
  })

  it('prompt-then-deny: request denied gates as permission-required', async () => {
    const handle = createFakeBrowserDirectory()
    handle.enqueueQueryResults('prompt')
    handle.enqueueRequestResults('denied')
    const storage = createFsaLibraryStorage({
      root: handle,
      loadBookText: loadBookTextSync,
    })

    const queried = await bridgeFromQuery(handle, storage.setPermissionRequired)
    expect(queried).toBe('prompt')
    const requested = await bridgeFromRequest(
      handle,
      storage.setPermissionRequired,
    )
    expect(requested).toBe('denied')

    await expect(storage.listBooks()).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })
  })

  it('cancel: picker AbortError before storage bind', async () => {
    const pick = createFakeDirectoryPicker({
      outcomes: ['abort', createFakeBrowserDirectory()],
    })
    let bound = false

    await expect(pick()).rejects.toMatchObject({ name: 'AbortError' })
    expect(bound).toBe(false)

    const handle = await pick()
    createFsaLibraryStorage({
      root: handle,
      loadBookText: loadBookTextSync,
    })
    bound = true
    expect(bound).toBe(true)
  })

  it('re-grant: request granted clears gate and list/create succeed', async () => {
    const handle = createFakeBrowserDirectory({ initialPermission: 'denied' })
    const storage = createFsaLibraryStorage({
      root: handle,
      loadBookText: loadBookTextSync,
    })
    const book = makeBook({ id: 'regrant-book' })

    await bridgeFromQuery(handle, storage.setPermissionRequired)
    await expect(storage.listBooks()).resolves.toEqual({
      ok: false,
      code: 'permission-required',
    })

    handle.enqueueRequestResults('granted')
    const granted = await bridgeFromRequest(
      handle,
      storage.setPermissionRequired,
    )
    expect(granted).toBe('granted')
    await expect(handle.queryPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )

    await expect(storage.createBook(book)).resolves.toEqual({
      ok: true,
      value: book,
    })
    await expect(storage.listBooks()).resolves.toEqual({
      ok: true,
      value: [{ id: book.id }],
    })
  })
})
