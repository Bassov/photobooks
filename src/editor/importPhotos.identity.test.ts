import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryLibraryStorage,
  createMemorySessionState,
} from '../project'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { importPhotoFiles } from './importPhotos'
import {
  attachLibraryForTests,
  createBookInLibrary,
  getRegisteredAssetSource,
  resetProjectSessionForTests,
} from './projectSession'

function tinyJpeg(): File {
  // Minimal JPEG SOI/EOI — decode may fail; identity path still runs.
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  return new File([bytes], 'shot.jpg', { type: 'image/jpeg' })
}

describe('importPhotoFiles library identity', () => {
  beforeEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
  })

  afterEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
  })

  it('writes source root identity when library-backed', async () => {
    const storage = createMemoryLibraryStorage()
    await attachLibraryForTests({
      storage,
      session: createMemorySessionState(),
    })
    await createBookInLibrary()

    await importPhotoFiles([tinyJpeg()], {
      libraryBacked: true,
      sourceRootId: 'root-test',
    })

    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(1)
      const assetId = book.gallery[0]
      expect(assetId).toBeDefined()
      assert.ok(assetId)
      const asset = book.assets[assetId]
      expect(asset?.sourceRootId).toBe('root-test')
      expect(asset?.relativePath).toBe('shot.jpg')
      expect(asset?.byteSize).toBe(4)
    })
    const source = getRegisteredAssetSource('root-test')
    expect(source).toBeDefined()
    const scanned = await source?.scanRoot('root-test')
    expect(scanned?.ok).toBe(true)
    assert.ok(scanned?.ok)
    expect(
      scanned.value.some((entry) => entry.relativePath === 'shot.jpg'),
    ).toBe(true)
  })

  it('skips identity fields without a library', async () => {
    await importPhotoFiles([tinyJpeg()], { libraryBacked: false })

    await vi.waitFor(() => {
      const book = getBookStoreSnapshot().book
      expect(book.gallery.length).toBe(1)
      const assetId = book.gallery[0]
      expect(assetId).toBeDefined()
      assert.ok(assetId)
      expect(book.assets[assetId]?.sourceRootId).toBeUndefined()
    })
  })
})
