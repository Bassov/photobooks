import { describe, expect, it } from 'vitest'

import { makeBook } from '../../core/testing/fixtures'
import {
  BOOK_JSON,
  BOOK_JSON_BAK,
  BOOKS_DIR,
  LIBRARY_JSON,
  listBookIds,
  readLibraryMeta,
  writeBookJson,
  writeLibraryMeta,
} from './layout'
import { createMemoryDirectory, readMemoryFileText } from './memoryDirectory'

describe('fsa layout helpers', () => {
  it('creates books/ on demand and rotates bak on overwrite', async () => {
    const root = createMemoryDirectory()
    const book = makeBook({ id: 'layout-book' })

    await writeBookJson(root, book, { rotateBak: false })
    expect(await listBookIds(root)).toEqual(['layout-book'])
    expect(
      await readMemoryFileText(root, [BOOKS_DIR, book.id, BOOK_JSON]),
    ).toContain(book.id)

    const updated = {
      ...book,
      settings: { ...book.settings, bleedMm: 9 },
    }
    await writeBookJson(root, updated, { rotateBak: true })

    const bak = await readMemoryFileText(root, [
      BOOKS_DIR,
      book.id,
      BOOK_JSON_BAK,
    ])
    const current = await readMemoryFileText(root, [
      BOOKS_DIR,
      book.id,
      BOOK_JSON,
    ])
    expect(bak).toContain('"bleedMm":3')
    expect(current).toContain('"bleedMm":9')
  })

  it('treats missing, empty, and non-object library.json as empty meta', async () => {
    const root = createMemoryDirectory()
    expect(await readLibraryMeta(root)).toEqual({})

    const empty = await root.getFile(LIBRARY_JSON, { create: true })
    await empty.writeText('   ')
    expect(await readLibraryMeta(root)).toEqual({})

    await empty.writeText('null')
    expect(await readLibraryMeta(root)).toEqual({})

    await empty.writeText('[]')
    expect(await readLibraryMeta(root)).toEqual({})

    await writeLibraryMeta(root, {})
    expect(await readLibraryMeta(root)).toEqual({})
    expect(await readMemoryFileText(root, [LIBRARY_JSON])).toBe('{}')
  })
})
