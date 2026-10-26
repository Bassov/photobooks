import assert from 'node:assert/strict'

import { describe, expect, it } from 'vitest'

import { makeBook } from '../core/testing/fixtures'
import { createMemoryLibraryStorage } from './memory'

describe('memory listBooks enrichment', () => {
  it('omits trim fields for corrupt books while keeping id and title', async () => {
    const storage = createMemoryLibraryStorage()
    await storage.createBook(makeBook({ id: 'ok', title: 'Ok' }))
    storage.seedRawBook('bad', { not: 'a-book', title: 'Broken' })
    const listed = await storage.listBooks()
    assert(listed.ok)
    expect(listed.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ok',
          title: 'Ok',
          spreadCount: expect.any(Number) as unknown as number,
        }),
        expect.objectContaining({
          id: 'bad',
          title: 'Broken',
        }),
      ]),
    )
    for (const row of listed.value) {
      expect(typeof row.editedAtMs).toBe('number')
    }
  })

  it('sets editedAtMs on create and bumps it on save', async () => {
    const storage = createMemoryLibraryStorage()
    const book = makeBook({ id: 't1', title: 'Trip' })
    await storage.createBook(book)
    const listed = await storage.listBooks()
    assert(listed.ok)
    const first = listed.value.find((b) => b.id === 't1')
    expect(typeof first?.editedAtMs).toBe('number')
    const prior = first?.editedAtMs ?? 0
    await new Promise((r) => {
      setTimeout(r, 5)
    })
    await storage.saveBook({ ...book, title: 'Trip 2' })
    const again = await storage.listBooks()
    assert(again.ok)
    const next = again.value.find((b) => b.id === 't1')?.editedAtMs ?? 0
    expect(next).toBeGreaterThan(prior)
  })
})
