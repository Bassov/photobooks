import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  enqueueManifestGalleryList,
  enqueueScannedGalleryList,
} from './enqueueScannedGalleryList'

beforeEach(() => {
  resetBookStore()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    cb(0)
    return 1
  })
})

describe('enqueueScannedGalleryList', () => {
  it('enqueues accepted paths as placeholders before any File exists', () => {
    const result = enqueueScannedGalleryList('root-1', [
      { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 },
      { relativePath: 'notes.txt', byteSize: 2, mtimeMs: 1 },
      { relativePath: 'b.png', byteSize: 20, mtimeMs: 2 },
    ])

    expect(result.enqueued.map((e) => e.relativePath)).toEqual([
      'a.jpg',
      'b.png',
    ])
    expect(result.skipped).toHaveLength(1)
    const { book } = getBookStoreSnapshot()
    expect(book.gallery).toHaveLength(2)
    expect(book.gallery.map((id) => book.assets[id]?.relativePath)).toEqual([
      'a.jpg',
      'b.png',
    ])
    expect(book.assets[book.gallery[0] ?? '']?.byteSize).toBe(10)
  })

  it('skips paths already in the gallery', () => {
    enqueueScannedGalleryList('root-1', [
      { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 },
    ])
    const again = enqueueScannedGalleryList('root-1', [
      { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 },
      { relativePath: 'b.jpg', byteSize: 11, mtimeMs: 2 },
    ])
    expect(again.alreadyPresent.map((e) => e.relativePath)).toEqual(['a.jpg'])
    expect(again.enqueued.map((e) => e.relativePath)).toEqual(['b.jpg'])
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(2)
  })

  it('can enqueue without flipping importRunning', () => {
    enqueueScannedGalleryList(
      'root-1',
      [{ relativePath: 'a.jpg', byteSize: 1, mtimeMs: 1 }],
      { markImportRunning: false },
    )
    expect(getBookStoreSnapshot().importRunning).toBe(false)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(1)
  })

  it('treats nested heic/tiff as skipped list entries', () => {
    const result = enqueueScannedGalleryList('root-1', [
      { relativePath: 'nest/a.heic', byteSize: 1, mtimeMs: 1 },
      { relativePath: 'nest/b.tiff', byteSize: 2, mtimeMs: 2 },
      { relativePath: 'nest/c.webp', byteSize: 3, mtimeMs: 3 },
    ])
    expect(result.enqueued.map((e) => e.relativePath)).toEqual(['nest/c.webp'])
    expect(result.skipped).toHaveLength(2)
    const { book, sessionMeta } = getBookStoreSnapshot()
    const id = book.gallery[0]
    expect(id).toBeDefined()
    expect(sessionMeta.get(id ?? '')?.name).toBe('c.webp')
  })

  it('does nothing for an empty scan', () => {
    const result = enqueueScannedGalleryList('root-1', [])
    expect(result).toEqual({
      enqueued: [],
      alreadyPresent: [],
      skipped: [],
    })
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(0)
    expect(getBookStoreSnapshot().importRunning).toBe(false)
  })

  it('seeds aspect slots from manifest dimensions', () => {
    enqueueManifestGalleryList('root-1', {
      'wide.jpg': {
        byteSize: 10,
        mtimeMs: 1,
        width: 300,
        height: 100,
        orientation: 1,
      },
      'tall.jpg': {
        byteSize: 11,
        mtimeMs: 2,
        width: 100,
        height: 200,
        orientation: 1,
      },
    })
    const { book, sessionMeta } = getBookStoreSnapshot()
    expect(book.gallery).toHaveLength(2)
    const aspects = book.gallery.map((id) => sessionMeta.get(id)?.aspect)
    expect(aspects).toEqual([3, 0.5])
  })

  it('restores aspect on already-present gallery ids from dimsByPath', () => {
    enqueueScannedGalleryList('root-1', [
      { relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 },
    ])
    const id = getBookStoreSnapshot().book.gallery[0]
    expect(id).toBeDefined()
    expect(getBookStoreSnapshot().sessionMeta.get(id ?? '')?.aspect).toBe(1)

    enqueueScannedGalleryList(
      'root-1',
      [{ relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 }],
      {
        markImportRunning: false,
        dimsByPath: new Map([
          [
            'a.jpg',
            {
              byteSize: 10,
              mtimeMs: 1,
              width: 400,
              height: 100,
              orientation: 1,
            },
          ],
        ]),
      },
    )
    expect(getBookStoreSnapshot().sessionMeta.get(id ?? '')?.aspect).toBe(4)
  })

  it('does not overwrite a known non-default aspect from dimsByPath', () => {
    enqueueManifestGalleryList('root-1', {
      'a.jpg': {
        byteSize: 10,
        mtimeMs: 1,
        width: 300,
        height: 100,
        orientation: 1,
      },
    })
    const id = getBookStoreSnapshot().book.gallery[0]
    expect(getBookStoreSnapshot().sessionMeta.get(id ?? '')?.aspect).toBe(3)

    enqueueScannedGalleryList(
      'root-1',
      [{ relativePath: 'a.jpg', byteSize: 10, mtimeMs: 1 }],
      {
        markImportRunning: false,
        dimsByPath: new Map([
          [
            'a.jpg',
            {
              byteSize: 10,
              mtimeMs: 1,
              width: 100,
              height: 100,
              orientation: 1,
            },
          ],
        ]),
      },
    )
    expect(getBookStoreSnapshot().sessionMeta.get(id ?? '')?.aspect).toBe(3)
  })

  it('uses default aspect when manifest dims omit width or height', () => {
    enqueueManifestGalleryList('root-1', {
      'a.jpg': { byteSize: 10, mtimeMs: 1, width: 200 },
    })
    const id = getBookStoreSnapshot().book.gallery[0]
    expect(getBookStoreSnapshot().sessionMeta.get(id ?? '')?.aspect).toBe(1)
  })
})
