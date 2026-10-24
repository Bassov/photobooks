import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeBrowserDirectory } from '../project/fsa/browserDirectory.test-helpers'
import type { SessionIdb, SessionIdbGetResult } from '../project/session/idb'
import * as sourceRootHandles from '../project/session/browserSourceRootHandles'
import { getAssetSource, resetAssetSources } from '../photo/assetSources'
import {
  clearRegisteredAssetSources,
  getRegisteredAssetSource,
} from './assetSourceRegistry'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  allowAccessPhotoFolderLabel,
  bindPhotoFolder,
  getPhotoRootSessionSnapshot,
  persistBoundPhotoFolder,
  photoFolderActionLabel,
  registerBoundPhotoFolderSource,
  regrantPhotoFolder,
  resetPhotoRootSessionForTests,
  restorePhotoFolderForActiveBook,
} from './photoRootSession'

function createMemoryIdb(): SessionIdb {
  const map = new Map<string, unknown>()
  return {
    get(key): Promise<SessionIdbGetResult> {
      if (!map.has(key)) {
        return Promise.resolve({ present: false })
      }
      return Promise.resolve({ present: true, value: map.get(key) })
    },
    set(key, value) {
      map.set(key, value)
      return Promise.resolve()
    },
    del(key) {
      map.delete(key)
      return Promise.resolve()
    },
    runReadwrite(mutations) {
      for (const mutation of mutations) {
        if (mutation.op === 'set') {
          map.set(mutation.key, mutation.value)
        } else {
          map.delete(mutation.key)
        }
      }
      return Promise.resolve()
    },
  }
}

describe('photoRootSession labels', () => {
  it('Choose vs Change and Allow access copy', () => {
    expect(photoFolderActionLabel(false)).toBe('Choose photo folder…')
    expect(photoFolderActionLabel(true)).toBe('Change photo folder…')
    expect(allowAccessPhotoFolderLabel('Vacation')).toBe(
      'Allow access to Vacation',
    )
    expect(allowAccessPhotoFolderLabel(null)).toBe('Allow access to folder')
  })
})

describe('photoRootSession bind/restore', () => {
  const sourceRootIdb = createMemoryIdb()
  const bookPhotoRootIdb = createMemoryIdb()
  const options = { sourceRootIdb, bookPhotoRootIdb }

  beforeEach(() => {
    const remember = sourceRootHandles.rememberSourceRootHandle
    const recall = sourceRootHandles.recallSourceRootHandle
    const peek = sourceRootHandles.peekSourceRootHandle
    const clearHandle = sourceRootHandles.clearSourceRootHandle
    const setBinding = sourceRootHandles.setBookPhotoRoot
    const getBinding = sourceRootHandles.getBookPhotoRoot
    const clearBinding = sourceRootHandles.clearBookPhotoRoot
    vi.spyOn(sourceRootHandles, 'rememberSourceRootHandle').mockImplementation(
      (id, handle) => remember(id, handle, options),
    )
    vi.spyOn(sourceRootHandles, 'recallSourceRootHandle').mockImplementation(
      (id) => recall(id, options),
    )
    vi.spyOn(sourceRootHandles, 'peekSourceRootHandle').mockImplementation(
      (id) => peek(id, options),
    )
    vi.spyOn(sourceRootHandles, 'clearSourceRootHandle').mockImplementation(
      (id) => clearHandle(id, options),
    )
    vi.spyOn(sourceRootHandles, 'setBookPhotoRoot').mockImplementation(
      (bookId, binding) => setBinding(bookId, binding, options),
    )
    vi.spyOn(sourceRootHandles, 'getBookPhotoRoot').mockImplementation(
      (bookId) => getBinding(bookId, options),
    )
    vi.spyOn(sourceRootHandles, 'clearBookPhotoRoot').mockImplementation(
      (bookId) => clearBinding(bookId, options),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetPhotoRootSessionForTests()
    clearRegisteredAssetSources()
    resetAssetSources()
  })

  it('bindPhotoFolder registers an FSA root for the book', async () => {
    const directory = createFakeBrowserDirectory({ name: 'Vacation' })
    directory.writeFile('a.jpg', new Uint8Array([1, 2, 3]))
    const { sourceRootId } = await bindPhotoFolder({ directory })
    expect(getRegisteredAssetSource(sourceRootId)).toBeDefined()
    expect(getPhotoRootSessionSnapshot()).toMatchObject({
      hasPhotoFolder: true,
      photoFolderLabel: 'Vacation',
      photoAccessPhase: 'idle',
    })
  })

  it('bindPhotoFolder persist:false defers IDB and UI until persistBoundPhotoFolder', async () => {
    const directory = createFakeBrowserDirectory({ name: 'Later' })
    const { sourceRootId } = await bindPhotoFolder({
      directory,
      persist: false,
      registerSource: false,
    })
    expect(getRegisteredAssetSource(sourceRootId)).toBeUndefined()
    // hasPhotoFolder stays false until persist emits (import scroll window).
    expect(getPhotoRootSessionSnapshot().hasPhotoFolder).toBe(false)
    await persistBoundPhotoFolder(sourceRootId, directory)
    registerBoundPhotoFolderSource(sourceRootId, directory)
    expect(getRegisteredAssetSource(sourceRootId)).toBeDefined()
    expect(getPhotoRootSessionSnapshot()).toMatchObject({
      hasPhotoFolder: true,
      photoFolderLabel: 'Later',
    })
  })

  it('restore with prompt then regrant rehydrates session files', async () => {
    const directory = createFakeBrowserDirectory({
      name: 'Trip',
      initialPermission: 'prompt',
    })
    directory.writeFile('shot.jpg', new Uint8Array([9, 9, 9]))
    const { sourceRootId } = await bindPhotoFolder({ directory })
    directory.setPermission('prompt')

    const book = getBookStoreSnapshot().book
    resetBookStore({
      book: {
        ...book,
        gallery: ['asset-1'],
        assets: {
          'asset-1': {
            sourceRootId,
            relativePath: 'shot.jpg',
            byteSize: 3,
            mtimeMs: 1,
          },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    clearRegisteredAssetSources()
    resetPhotoRootSessionForTests()

    await restorePhotoFolderForActiveBook()
    expect(getPhotoRootSessionSnapshot().photoAccessPhase).toBe(
      'permission-required',
    )

    directory.enqueueRequestResults('granted')
    const result = await regrantPhotoFolder(async (handle) => {
      const request = handle.requestPermission?.bind(handle)
      if (typeof request !== 'function') {
        return 'unavailable'
      }
      const state = await request({ mode: 'read' })
      return state === 'granted' ? 'granted' : 'denied'
    })
    expect(result).toBe('granted')
    expect(getPhotoRootSessionSnapshot().photoAccessPhase).toBe('idle')
    expect(getAssetSource('asset-1')?.name).toBe('shot.jpg')
  })
})
