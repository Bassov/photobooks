import { describe, expect, it } from 'vitest'

import { CURRENT_SCHEMA_VERSION, type Book } from '../core'
import { makeBook } from '../core/testing/fixtures'
import type { LibraryStorage } from './types'

export interface LibraryStorageContractHarness {
  storage: LibraryStorage
  setPermissionRequired: (required: boolean) => void
  setLockedElsewhere: (locked: boolean) => void
  seedRawBook: (id: string, raw: unknown) => void | Promise<void>
}

export function runLibraryStorageContract(
  createHarness: () => LibraryStorageContractHarness,
): void {
  describe('LibraryStorage contract', () => {
    it('lists no books and returns library meta for a new storage', async () => {
      const { storage } = createHarness()

      const listed = await storage.listBooks()
      const library = await storage.getLibrary()

      expect(listed).toEqual({ ok: true, value: [] })
      expect(library).toEqual({ ok: true, value: {} })
    })

    it('creates a book then includes it in the list', async () => {
      const { storage } = createHarness()
      const book = makeBook({ id: 'contract-book-1' })

      const created = await storage.createBook(book)
      const listed = await storage.listBooks()

      expect(created).toEqual({ ok: true, value: book })
      expect(listed).toEqual({ ok: true, value: [{ id: book.id }] })
    })

    it('round-trips save then load for an existing book', async () => {
      const { storage } = createHarness()
      const book = makeBook({ id: 'contract-book-2' })
      await storage.createBook(book)

      const updated: Book = {
        ...book,
        settings: { ...book.settings, bleedMm: 7 },
      }
      const saved = await storage.saveBook(updated)
      const loaded = await storage.loadBook(book.id)

      expect(saved).toEqual({ ok: true, value: updated })
      expect(loaded).toEqual({ ok: true, value: updated })
    })

    it('deletes a book and then returns not-found on load', async () => {
      const { storage } = createHarness()
      const book = makeBook({ id: 'contract-book-3' })
      await storage.createBook(book)

      const deleted = await storage.deleteBook(book.id)
      const listed = await storage.listBooks()
      const loaded = await storage.loadBook(book.id)

      expect(deleted).toEqual({ ok: true, value: undefined })
      expect(listed).toEqual({ ok: true, value: [] })
      expect(loaded).toEqual({ ok: false, code: 'not-found' })
    })

    it('replaces library metadata on update', async () => {
      const { storage } = createHarness()

      const updated = await storage.updateLibrary({})
      const got = await storage.getLibrary()

      expect(updated).toEqual({ ok: true, value: {} })
      expect(got).toEqual({ ok: true, value: {} })
    })

    it('returns not-found for load, save, and delete of a missing id', async () => {
      const { storage } = createHarness()
      const missing = makeBook({ id: 'missing-book' })

      expect(await storage.loadBook(missing.id)).toEqual({
        ok: false,
        code: 'not-found',
      })
      expect(await storage.saveBook(missing)).toEqual({
        ok: false,
        code: 'not-found',
      })
      expect(await storage.deleteBook(missing.id)).toEqual({
        ok: false,
        code: 'not-found',
      })
    })

    it('returns already-exists when creating a duplicate id', async () => {
      const { storage } = createHarness()
      const book = makeBook({ id: 'dup-book' })
      await storage.createBook(book)

      expect(await storage.createBook(book)).toEqual({
        ok: false,
        code: 'already-exists',
      })
    })

    it('returns corrupted when stored data is not a valid book', async () => {
      const harness = createHarness()
      await harness.seedRawBook('bad-book', { not: 'a-book' })

      expect(await harness.storage.loadBook('bad-book')).toEqual({
        ok: false,
        code: 'corrupted',
      })
    })

    it('returns newer-schema when stored schemaVersion is unsupported', async () => {
      const harness = createHarness()
      const book = makeBook({ id: 'future-book' })
      await harness.seedRawBook('future-book', {
        ...book,
        schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      })

      expect(await harness.storage.loadBook('future-book')).toEqual({
        ok: false,
        code: 'newer-schema',
      })
    })

    it('returns permission-required for every operation when permission is required', async () => {
      const harness = createHarness()
      const book = makeBook({ id: 'perm-book' })
      harness.setPermissionRequired(true)

      expect(await harness.storage.getLibrary()).toEqual({
        ok: false,
        code: 'permission-required',
      })
      expect(await harness.storage.updateLibrary({})).toEqual({
        ok: false,
        code: 'permission-required',
      })
      expect(await harness.storage.listBooks()).toEqual({
        ok: false,
        code: 'permission-required',
      })
      expect(await harness.storage.createBook(book)).toEqual({
        ok: false,
        code: 'permission-required',
      })
      expect(await harness.storage.loadBook(book.id)).toEqual({
        ok: false,
        code: 'permission-required',
      })
      expect(await harness.storage.saveBook(book)).toEqual({
        ok: false,
        code: 'permission-required',
      })
      expect(await harness.storage.deleteBook(book.id)).toEqual({
        ok: false,
        code: 'permission-required',
      })
    })

    it('returns locked-elsewhere for mutations only', async () => {
      const harness = createHarness()
      const book = makeBook({ id: 'lock-book' })
      await harness.storage.createBook(book)
      harness.setLockedElsewhere(true)

      expect(await harness.storage.listBooks()).toEqual({
        ok: true,
        value: [{ id: book.id }],
      })
      expect(await harness.storage.loadBook(book.id)).toEqual({
        ok: true,
        value: book,
      })
      expect(await harness.storage.getLibrary()).toEqual({
        ok: true,
        value: {},
      })
      expect(
        await harness.storage.createBook(makeBook({ id: 'other' })),
      ).toEqual({ ok: false, code: 'locked-elsewhere' })
      expect(await harness.storage.saveBook(book)).toEqual({
        ok: false,
        code: 'locked-elsewhere',
      })
      expect(await harness.storage.deleteBook(book.id)).toEqual({
        ok: false,
        code: 'locked-elsewhere',
      })
      expect(await harness.storage.updateLibrary({})).toEqual({
        ok: false,
        code: 'locked-elsewhere',
      })
    })
  })
}
