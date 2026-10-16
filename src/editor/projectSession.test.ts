import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import {
  createMemoryLibraryStorage,
  createMemorySessionState,
} from '../project'
import {
  getBookStoreSnapshot,
  getAssetContentHash,
  patchAssetRecord,
  resetBookStore,
} from './bookStore'
import { getEditorStatus } from './editorStatus'
import { ensureThumb, getThumbUrl, resetThumbCache } from './thumbCache'
import {
  adoptCurrentBookInLibrary,
  attachLibraryForTests,
  attachMemoryLibraryForTests,
  configureProjectSession,
  createBookInLibrary,
  createLibrary,
  exposeProjectSessionTestApi,
  getProjectSessionSnapshot,
  isLibraryBacked,
  openLibrary,
  resetProjectSessionForTests,
  saveBookNow,
  tryRestore,
} from './projectSession'

describe('projectSession', () => {
  beforeEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
  })

  afterEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetThumbCache()
    setDerivedCacheForTests(undefined)
  })

  it('creates a book, saves, and restores the document', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    const attached = await attachLibraryForTests({ storage, session })
    expect(attached).toEqual({ ok: true, value: undefined })
    expect(getProjectSessionSnapshot().libraryOpen).toBe(true)
    expect(getProjectSessionSnapshot().bookId).not.toBeNull()
    expect(getProjectSessionSnapshot().status).toMatchObject({
      kind: 'open',
      libraryId: 'library',
    })
    expect(isLibraryBacked()).toBe(true)
    expect(getEditorStatus()).toBe('Book created in library')

    const created = await createBookInLibrary()
    expect(created.ok).toBe(true)
    expect(created).toMatchObject({ ok: true })
    if (!created.ok) {
      throw new Error('expected createBookInLibrary success')
    }
    expect(getEditorStatus()).toBe('Book created')
    expect(isLibraryBacked()).toBe(true)
    expect(getProjectSessionSnapshot()).toMatchObject({
      libraryOpen: true,
      bookId: created.value.id,
      status: {
        kind: 'open',
        libraryId: 'library',
        bookId: created.value.id,
      },
    })

    resetBookStore({
      book: {
        ...created.value,
        gallery: ['asset-1'],
        assets: {
          'asset-1': {
            sourceRootId: 'root-a',
            relativePath: 'a.jpg',
            byteSize: 10,
            mtimeMs: 1,
          },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    patchAssetRecord('asset-1', {
      contentHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    expect(getBookStoreSnapshot().book.assets['asset-1']?.contentHash).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )

    saveBookNow()
    await vi.waitFor(() => {
      expect(getEditorStatus()).toBe('Book saved')
    })
    expect(getProjectSessionSnapshot().saving).toBe(false)
    expect(getProjectSessionSnapshot().status.kind).toBe('open')

    resetBookStore()
    expect(getBookStoreSnapshot().book.gallery).toEqual([])

    const restored = await tryRestore()
    expect(restored.ok).toBe(true)
    expect(restored).toMatchObject({ ok: true })
    if (!restored.ok) {
      throw new Error('expected tryRestore success')
    }
    expect(restored.value).not.toBeNull()
    expect(restored.value?.id).toBe(created.value.id)
    expect(restored.value?.gallery).toEqual(['asset-1'])
    expect(restored.value?.assets['asset-1']?.sourceRootId).toBe('root-a')
    expect(getProjectSessionSnapshot().bookId).toBe(created.value.id)
    expect(getProjectSessionSnapshot().status).toEqual({
      kind: 'open',
      libraryId: 'library',
      bookId: created.value.id,
    })
    expect(getEditorStatus()).toBe('Book restored')
  })

  it('restores the auto-adopted book after library attach', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({ storage, session })
    const adoptedId = getProjectSessionSnapshot().bookId
    expect(adoptedId).not.toBeNull()

    const restored = await tryRestore()
    expect(restored.ok).toBe(true)
    if (!restored.ok) {
      throw new Error('expected tryRestore success')
    }
    expect(restored.value?.id).toBe(adoptedId)
    expect(getProjectSessionSnapshot().libraryOpen).toBe(true)
    expect(getProjectSessionSnapshot().bookId).toBe(adoptedId)
    expect(getProjectSessionSnapshot().status.kind).toBe('open')
  })

  it('surfaces typed save failures as status', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    await attachLibraryForTests({ storage, session })

    const created = await createBookInLibrary()
    expect(created.ok).toBe(true)
    storage.setPermissionRequired(true)

    saveBookNow()
    await vi.waitFor(() => {
      expect(getEditorStatus()).toContain('permission-required')
    })
    expect(getProjectSessionSnapshot().status).toEqual({
      kind: 'error',
      code: 'permission-required',
      action: 'save',
    })
    expect(getProjectSessionSnapshot().saving).toBe(false)
  })

  it('reports not-found when creating a book without a library', async () => {
    const result = await createBookInLibrary()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(getEditorStatus()).toContain('not-found')
    expect(getProjectSessionSnapshot().status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'create book',
    })
    expect(isLibraryBacked()).toBe(false)
  })

  it('reports not-found when adopting or saving without a library', async () => {
    const adopted = await adoptCurrentBookInLibrary()
    expect(adopted).toEqual({ ok: false, code: 'not-found' })
    expect(getProjectSessionSnapshot().status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'adopt book',
    })

    saveBookNow()
    expect(getProjectSessionSnapshot().status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'save',
    })
  })

  it('createLibrary and openLibrary bind via the directory picker', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    const handle = { id: 'picked-dir' }
    configureProjectSession({
      session,
      createStorage: () => storage,
      pickDirectory: () =>
        Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
    })

    const created = await createLibrary()
    expect(created).toEqual({ ok: true, value: undefined })
    expect(getProjectSessionSnapshot().libraryOpen).toBe(true)

    resetProjectSessionForTests()
    configureProjectSession({
      session,
      createStorage: () => storage,
      pickDirectory: () =>
        Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
    })
    const opened = await openLibrary()
    expect(opened).toEqual({ ok: true, value: undefined })
    expect(getProjectSessionSnapshot().libraryOpen).toBe(true)
  })

  it('createLibrary returns not-found when the picker is cancelled', async () => {
    configureProjectSession({
      pickDirectory: () => Promise.resolve(null),
    })
    await expect(createLibrary()).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('saveBookNow awaits pending hashes before writing', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    await attachLibraryForTests({ storage, session })

    let resolveHash!: (value: string) => void
    const hashPromise = new Promise<string>((resolve) => {
      resolveHash = resolve
    })
    const { trackHashJob } = await import('./pendingHashes')
    void trackHashJob(hashPromise)

    saveBookNow()
    expect(getProjectSessionSnapshot().saving).toBe(true)
    await new Promise((resolve) => {
      setTimeout(resolve, 30)
    })
    expect(getEditorStatus()).not.toBe('Book saved')
    expect(getProjectSessionSnapshot().saving).toBe(true)

    resolveHash('x'.repeat(64))
    await vi.waitFor(() => {
      expect(getEditorStatus()).toBe('Book saved')
    })
    expect(getProjectSessionSnapshot().saving).toBe(false)
  })

  it('adoptCurrentBookInLibrary persists the in-memory book', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    const before = getBookStoreSnapshot().book
    const adopted = await adoptCurrentBookInLibrary()
    expect(adopted.ok).toBe(true)
    if (!adopted.ok) {
      throw new Error('expected adopt success')
    }
    expect(adopted.value.id).toBe(before.id)
    expect(isLibraryBacked()).toBe(true)

    const again = await adoptCurrentBookInLibrary()
    expect(again.ok).toBe(true)
    if (!again.ok) {
      throw new Error('expected second adopt success')
    }
    expect(again.value.id).toBe(before.id)
  })

  it('tryRestore surfaces permission-required without loading a book', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
      storageKey: (() => {
        const map = new Map<string, string>([
          ['photobooks.libraryId', 'library'],
          ['photobooks.activeBookId', 'book-x'],
        ])
        return {
          get length() {
            return map.size
          },
          clear() {
            map.clear()
          },
          getItem(key: string) {
            return map.get(key) ?? null
          },
          key() {
            return null
          },
          removeItem(key: string) {
            map.delete(key)
          },
          setItem(key: string, value: string) {
            map.set(key, value)
          },
        }
      })(),
    })
    await attachLibraryForTests({ storage, session })
    const denied = createMemorySessionState()
    configureProjectSession({
      session: {
        rememberLibraryHandle: denied.rememberLibraryHandle.bind(denied),
        clearLibraryHandle: denied.clearLibraryHandle.bind(denied),
        acquireBookLock: denied.acquireBookLock.bind(denied),
        recallLibraryHandle: () =>
          Promise.resolve({ ok: false, code: 'permission-required' }),
      },
      createStorage: () => storage,
    })
    const restored = await tryRestore()
    expect(restored).toEqual({ ok: true, value: null })
    expect(getEditorStatus()).toContain('permission-required')
  })

  it('exposes the project test API on window', () => {
    exposeProjectSessionTestApi()
    expect(window.__photobooksProject?.saveBookNow).toBeTypeOf('function')
    expect(window.__photobooksProject?.attachMemoryLibraryForTests).toBeTypeOf(
      'function',
    )
  })

  it('restored hashed assets hydrate thumbs from DerivedCache', async () => {
    const hash =
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({ storage, session })
    const created = await createBookInLibrary()
    expect(created.ok).toBe(true)
    if (!created.ok) {
      throw new Error('expected create')
    }
    resetBookStore({
      book: {
        ...created.value,
        gallery: ['asset-restore'],
        assets: {
          'asset-restore': {
            sourceRootId: 'root-b',
            relativePath: 'b.jpg',
            contentHash: hash,
          },
        },
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    saveBookNow()
    await vi.waitFor(() => {
      expect(getEditorStatus()).toBe('Book saved')
    })

    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    await cache.put(hash, 'thumb', {
      bytes: new Uint8Array([9, 8, 7]).buffer,
      mimeType: 'image/png',
    })

    resetBookStore()
    resetThumbCache()
    const restored = await tryRestore()
    expect(restored.ok).toBe(true)
    expect(getAssetContentHash('asset-restore')).toBe(hash)

    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:restored-thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    ensureThumb('asset-restore', getAssetContentHash('asset-restore'))
    for (let step = 0; step < 5; step += 1) {
      await Promise.resolve()
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }
    expect(getThumbUrl('asset-restore')).toBe('blob:restored-thumb')
  })
})
