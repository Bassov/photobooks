import { describe, expect, it } from 'vitest'

import { createFakeBrowserDirectory } from './browserDirectory.test-helpers'
import { fromFileSystemDirectoryHandle } from './handles'

describe('fromFileSystemDirectoryHandle', () => {
  it('reads and writes text through browser file handles', async () => {
    const root = fromFileSystemDirectoryHandle(createFakeBrowserDirectory())

    const file = await root.getFile('library.json', { create: true })
    await file.writeText('{"ok":true}')
    expect(await file.getText()).toBe('{"ok":true}')
  })

  it('lists directory and file children via values()', async () => {
    const browserRoot = createFakeBrowserDirectory()
    const file = await browserRoot.getFileHandle('library.json', {
      create: true,
    })
    const writable = await file.createWritable()
    await writable.write('{}')
    await writable.close()
    await browserRoot.getDirectoryHandle('books', { create: true })

    const root = fromFileSystemDirectoryHandle(browserRoot)
    const entries = await root.list()
    expect(entries).toEqual(
      expect.arrayContaining([
        { name: 'library.json', kind: 'file' },
        { name: 'books', kind: 'directory' },
      ]),
    )
  })

  it('creates nested directories and removes entries', async () => {
    const root = fromFileSystemDirectoryHandle(createFakeBrowserDirectory())

    const books = await root.getDirectory('books', { create: true })
    const bookDir = await books.getDirectory('b1', { create: true })
    const book = await bookDir.getFile('book.json', { create: true })
    await book.writeText('{"id":"b1"}')

    await books.removeEntry('b1', { recursive: true })
    await expect(books.getDirectory('b1')).rejects.toMatchObject({
      name: 'NotFoundError',
    })
  })
})
