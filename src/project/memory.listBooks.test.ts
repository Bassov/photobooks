import { describe, expect, it } from 'vitest'

import { makeBook } from '../core/testing/fixtures'
import { createMemoryLibraryStorage } from './memory'

describe('memory listBooks enrichment', () => {
  it('omits trim fields for corrupt books while keeping id and title', async () => {
    const storage = createMemoryLibraryStorage()
    await storage.createBook(makeBook({ id: 'ok', title: 'Ok' }))
    storage.seedRawBook('bad', { not: 'a-book', title: 'Broken' })
    await expect(storage.listBooks()).resolves.toEqual({
      ok: true,
      value: expect.arrayContaining([
        expect.objectContaining({
          id: 'ok',
          title: 'Ok',
          spreadCount: expect.any(Number),
        }),
        { id: 'bad', title: 'Broken' },
      ]),
    })
  })
})
