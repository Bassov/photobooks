import { describe, expect, it } from 'vitest'

import { makeBook } from '../core/testing/fixtures'
import { loadBookTextSync } from './fsa/bookLoadWorkerClient'
import { createFsaLibraryStorage } from './fsa/fsaLibraryStorage'
import { BOOKS_DIR, PUBLISHED_JSON } from './fsa/layout'
import { createMemoryDirectory } from './fsa/memoryDirectory'
import { createMemoryLibraryStorage } from './memory'
import { publishBook } from './publish'
import type { LibraryStorage } from './types'

const adapters: [string, () => LibraryStorage][] = [
  ['memory', () => createMemoryLibraryStorage()],
  [
    'fsa',
    () =>
      createFsaLibraryStorage({
        root: createMemoryDirectory(),
        loadBookText: loadBookTextSync,
      }),
  ],
]

describe.each(adapters)('published revisions (%s)', (_name, create) => {
  it('round-trips a revision that later edits leave unchanged', async () => {
    const storage = create()
    const book = makeBook({ id: 'b1', title: 'Lake' })
    await storage.createBook(book)
    const { revision } = publishBook({}, book, 1_000)

    const saved = await storage.savePublished(revision)
    await storage.saveBook({ ...book, title: 'Edited' })
    const loaded = await storage.loadPublished('b1')

    expect(saved).toEqual({ ok: true, value: revision })
    expect(loaded).toEqual({ ok: true, value: revision })
  })

  it('reports not-found without a revision or a book', async () => {
    const storage = create()
    await storage.createBook(makeBook({ id: 'b1' }))

    expect(await storage.loadPublished('b1')).toEqual({
      ok: false,
      code: 'not-found',
    })
    const orphan = publishBook({}, makeBook({ id: 'gone' }), 1).revision
    expect(await storage.savePublished(orphan)).toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('deletes the revision with the book', async () => {
    const storage = create()
    const book = makeBook({ id: 'b1' })
    await storage.createBook(book)
    await storage.savePublished(publishBook({}, book, 1).revision)

    await storage.deleteBook('b1')

    expect(await storage.loadPublished('b1')).toEqual({
      ok: false,
      code: 'not-found',
    })
  })
})

describe('published.json on disk', () => {
  it('fails as corrupted on invalid JSON and as newer-schema on a newer file', async () => {
    const root = createMemoryDirectory()
    const storage = createFsaLibraryStorage({
      root,
      loadBookText: loadBookTextSync,
    })
    await storage.createBook(makeBook({ id: 'b1' }))
    const books = await root.getDirectory(BOOKS_DIR)
    const file = await (
      await books.getDirectory('b1')
    ).getFile(PUBLISHED_JSON, { create: true })

    await file.writeText('{')
    expect(await storage.loadPublished('b1')).toEqual({
      ok: false,
      code: 'corrupted',
    })

    await file.writeText(JSON.stringify({ schemaVersion: 99 }))
    expect(await storage.loadPublished('b1')).toEqual({
      ok: false,
      code: 'newer-schema',
    })
  })
})
