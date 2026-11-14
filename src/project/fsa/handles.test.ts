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

  it('reads the new text when a write commits between snapshot and read', async () => {
    const browserRoot = createFakeBrowserDirectory()
    browserRoot.writeFile('library.json', '{"v":1}')
    const file =
      await fromFileSystemDirectoryHandle(browserRoot).getFile('library.json')
    browserRoot.onSnapshot('library.json', () => {
      browserRoot.onSnapshot('library.json', undefined)
      browserRoot.writeFile('library.json', '{"v":2}')
    })

    expect(await file.getText()).toBe('{"v":2}')
  })

  it('rejects NotReadableError after 4 snapshots when every read is overlapped', async () => {
    const browserRoot = createFakeBrowserDirectory()
    browserRoot.writeFile('library.json', '{"v":0}')
    const file =
      await fromFileSystemDirectoryHandle(browserRoot).getFile('library.json')
    let snapshots = 0
    browserRoot.onSnapshot('library.json', () => {
      snapshots += 1
      browserRoot.writeFile('library.json', `{"v":${String(snapshots)}}`)
    })

    await expect(file.getText()).rejects.toMatchObject({
      name: 'NotReadableError',
    })
    expect(snapshots).toBe(4)
  })

  it('does not retry other read errors', async () => {
    const browserRoot = createFakeBrowserDirectory()
    browserRoot.writeFile('library.json', '{}')
    const file =
      await fromFileSystemDirectoryHandle(browserRoot).getFile('library.json')
    let snapshots = 0
    browserRoot.onSnapshot('library.json', () => {
      snapshots += 1
      throw new DOMException('gone', 'NotFoundError')
    })

    await expect(file.getText()).rejects.toMatchObject({
      name: 'NotFoundError',
    })
    expect(snapshots).toBe(1)
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
