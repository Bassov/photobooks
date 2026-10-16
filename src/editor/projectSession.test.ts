import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import {
  createMemoryLibraryStorage,
  createMemorySessionState,
} from '../project'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getAssetContentHash,
  patchAssetRecord,
  resetBookStore,
} from './bookStore'
import { isEditorGestureActive, setEditorGestureActive } from './editorGesture'
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
  holdExternalBookLockForTests,
  isLibraryBacked,
  openLibrary,
  regrantLibrary,
  regrantLibraryWithHandleForTests,
  resetProjectSessionForTests,
  saveBookNow,
  setAccessPhaseForTests,
  tryActivateLibraryBookForTests,
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

  it('openLibrary loads a saved book into an empty editor without adopt wipe', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    const handle = { id: 'picked-dir' }
    configureProjectSession({
      session,
      createStorage: () => storage,
      pickDirectory: () =>
        Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
    })
    await createLibrary()
    const adoptedId = getProjectSessionSnapshot().bookId
    expect(adoptedId).toBe('session-book')

    resetBookStore({
      book: {
        ...getBookStoreSnapshot().book,
        gallery: ['asset-open'],
        assets: {
          'asset-open': {
            sourceRootId: 'root-a',
            relativePath: 'open.jpg',
            byteSize: 4,
            mtimeMs: 1,
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

    resetBookStore()
    resetProjectSessionForTests()
    configureProjectSession({
      session,
      createStorage: () => storage,
      pickDirectory: () =>
        Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
    })
    expect(getBookStoreSnapshot().book.gallery).toEqual([])

    const opened = await openLibrary()
    expect(opened).toEqual({ ok: true, value: undefined })
    expect(getBookStoreSnapshot().book.gallery).toEqual(['asset-open'])
    expect(getProjectSessionSnapshot().bookId).toBe('session-book')
    expect(getEditorStatus()).toBe('Book restored')
  })

  it('openLibrary prefers a filled book over an empty session-book', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    const handle = { id: 'picked-dir' }
    configureProjectSession({
      session,
      createStorage: () => storage,
      pickDirectory: () =>
        Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
    })
    await createLibrary()
    const created = await createBookInLibrary()
    expect(created.ok).toBe(true)
    if (!created.ok) {
      throw new Error('expected createBookInLibrary success')
    }

    resetBookStore({
      book: {
        ...created.value,
        gallery: ['asset-filled'],
        assets: {
          'asset-filled': {
            sourceRootId: 'root-b',
            relativePath: 'filled.jpg',
            byteSize: 8,
            mtimeMs: 2,
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

    resetBookStore()
    resetProjectSessionForTests()
    configureProjectSession({
      session,
      createStorage: () => storage,
      pickDirectory: () =>
        Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
    })

    const opened = await openLibrary()
    expect(opened).toEqual({ ok: true, value: undefined })
    expect(getProjectSessionSnapshot().bookId).toBe(created.value.id)
    expect(getBookStoreSnapshot().book.gallery).toEqual(['asset-filled'])
    expect(getEditorStatus()).toBe('Book restored')
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
    expect(getProjectSessionSnapshot().accessPhase).toBe('permission-required')
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

  describe('autosave', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      configureProjectSession({ autosaveDebounceMs: 1000 })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function attachLibraryBackedBook(): Promise<void> {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 1000,
      })
      await attachLibraryForTests({ storage, session })
      expect(getProjectSessionSnapshot().bookId).not.toBeNull()
      expect(getProjectSessionSnapshot()).toMatchObject({
        dirty: false,
        savePhase: 'idle',
      })
    }

    it('does not dirty on library attach or restore', async () => {
      await attachLibraryBackedBook()
      expect(getProjectSessionSnapshot().dirty).toBe(false)
      expect(getProjectSessionSnapshot().savePhase).toBe('idle')
    })

    it('debounces idle edits into a successful autosave', async () => {
      await attachLibraryBackedBook()
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      expect(spreadId).toBeTypeOf('string')
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }

      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      expect(getProjectSessionSnapshot()).toMatchObject({
        dirty: true,
        savePhase: 'pending',
      })

      await vi.advanceTimersByTimeAsync(1000)
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot()).toMatchObject({
          dirty: false,
          savePhase: 'idle',
        })
      })
      expect(getEditorStatus()).toBe('Book saved')
    })

    it('blocks autosave while a gesture is active then re-arms after end', async () => {
      await attachLibraryBackedBook()
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }

      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '4-grid' })
      setEditorGestureActive(true)
      expect(isEditorGestureActive()).toBe(true)

      await vi.advanceTimersByTimeAsync(1000)
      expect(getProjectSessionSnapshot().savePhase).toBe('pending')
      expect(getProjectSessionSnapshot().dirty).toBe(true)
      expect(getEditorStatus()).not.toBe('Book saved')

      setEditorGestureActive(false)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot()).toMatchObject({
          dirty: false,
          savePhase: 'idle',
        })
      })
      expect(getEditorStatus()).toBe('Book saved')
    })

    it('keeps dirty and re-arms when an edit arrives mid-save', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      const releaseHold = { current: null as (() => void) | null }
      let blockNextSave = true
      const originalSave = storage.saveBook.bind(storage)
      storage.saveBook = async (book) => {
        if (blockNextSave) {
          blockNextSave = false
          await new Promise<void>((resolve) => {
            releaseHold.current = resolve
          })
        }
        return originalSave(book)
      }
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 1000,
      })
      await attachLibraryForTests({ storage, session })
      const spreads = getBookStoreSnapshot().book.spreads
      const first = spreads[0]?.id
      const second = spreads[1]?.id
      if (first === undefined || second === undefined) {
        throw new Error('expected two spreads')
      }

      dispatchBookOp({
        type: 'applyTemplate',
        spreadId: first,
        templateId: '2-up',
      })
      await vi.advanceTimersByTimeAsync(1000)
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().saving).toBe(true)
      })

      dispatchBookOp({
        type: 'applyTemplate',
        spreadId: second,
        templateId: '4-grid',
      })
      expect(getProjectSessionSnapshot().dirty).toBe(true)

      expect(releaseHold.current).toBeTypeOf('function')
      releaseHold.current?.()
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().savePhase).toBe('pending')
      })
      await vi.advanceTimersByTimeAsync(1000)
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot()).toMatchObject({
          dirty: false,
          savePhase: 'idle',
        })
      })
    })

    it('does not silent-retry after a save error until the next edit', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 1000,
      })
      await attachLibraryForTests({ storage, session })
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }

      storage.setPermissionRequired(true)
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      await vi.advanceTimersByTimeAsync(1000)
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().savePhase).toBe('error')
      })
      expect(getProjectSessionSnapshot().dirty).toBe(true)

      setEditorGestureActive(true)
      setEditorGestureActive(false)
      await vi.advanceTimersByTimeAsync(1000)
      expect(getProjectSessionSnapshot().savePhase).toBe('error')

      storage.setPermissionRequired(false)
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '4-grid' })
      expect(getProjectSessionSnapshot().savePhase).toBe('pending')
      await vi.advanceTimersByTimeAsync(1000)
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot()).toMatchObject({
          dirty: false,
          savePhase: 'idle',
        })
      })
    })

    it('manual save clears dirty', async () => {
      await attachLibraryBackedBook()
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      expect(getProjectSessionSnapshot().dirty).toBe(true)
      saveBookNow()
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot()).toMatchObject({
          dirty: false,
          savePhase: 'idle',
        })
      })
    })

    it('does not mark dirty without an open library', () => {
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      expect(getProjectSessionSnapshot()).toMatchObject({
        dirty: false,
        savePhase: 'idle',
        libraryOpen: false,
      })
    })

    it('resets the debounce when edits keep arriving', async () => {
      await attachLibraryBackedBook()
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      await vi.advanceTimersByTimeAsync(800)
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '4-grid' })
      await vi.advanceTimersByTimeAsync(800)
      expect(getProjectSessionSnapshot().savePhase).toBe('pending')
      expect(getEditorStatus()).not.toBe('Book saved')
      await vi.advanceTimersByTimeAsync(200)
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot()).toMatchObject({
          dirty: false,
          savePhase: 'idle',
        })
      })
    })

    it('ignores a second save while one is in flight', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      const releaseHold = { current: null as (() => void) | null }
      let saveCount = 0
      const originalSave = storage.saveBook.bind(storage)
      storage.saveBook = async (book) => {
        saveCount += 1
        await new Promise<void>((resolve) => {
          releaseHold.current = resolve
        })
        return originalSave(book)
      }
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 1000,
      })
      await attachLibraryForTests({ storage, session })
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      saveBookNow()
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().saving).toBe(true)
      })
      saveBookNow()
      await vi.waitFor(() => {
        expect(saveCount).toBe(1)
      })
      releaseHold.current?.()
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().saving).toBe(false)
      })
      expect(saveCount).toBe(1)
    })

    it('uses a configured debounce interval', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 250,
      })
      await attachLibraryForTests({ storage, session })
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      await vi.advanceTimersByTimeAsync(249)
      expect(getProjectSessionSnapshot().savePhase).toBe('pending')
      await vi.advanceTimersByTimeAsync(1)
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().savePhase).toBe('idle')
      })
    })
  })

  describe('permissions and locks', () => {
    it('setAccessPhaseForTests drives permission-required chrome phase', () => {
      setAccessPhaseForTests('permission-required')
      expect(getProjectSessionSnapshot().accessPhase).toBe(
        'permission-required',
      )
      setAccessPhaseForTests('idle')
      expect(getProjectSessionSnapshot().accessPhase).toBe('idle')
    })

    it('restore-time regrant loads the persisted book', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      const handle = { id: 'lib-handle' }
      configureProjectSession({
        session,
        createStorage: () => storage,
        pickDirectory: () =>
          Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
      })
      await attachLibraryForTests({ storage, session, handle })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      if (!created.ok) {
        throw new Error('expected create')
      }
      const bookId = created.value.id
      saveBookNow()
      await vi.waitFor(() => {
        expect(getEditorStatus()).toBe('Book saved')
      })

      configureProjectSession({
        session: {
          rememberLibraryHandle: session.rememberLibraryHandle.bind(session),
          clearLibraryHandle: session.clearLibraryHandle.bind(session),
          acquireBookLock: session.acquireBookLock.bind(session),
          recallLibraryHandle: () =>
            Promise.resolve({ ok: false, code: 'permission-required' }),
        },
        createStorage: () => storage,
        pickDirectory: () =>
          Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
      })
      const denied = await tryRestore()
      expect(denied).toEqual({ ok: true, value: null })
      expect(getProjectSessionSnapshot().accessPhase).toBe(
        'permission-required',
      )

      configureProjectSession({
        session,
        createStorage: () => storage,
        pickDirectory: () =>
          Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
      })
      const granted = await regrantLibrary()
      expect(granted.ok).toBe(true)
      expect(getProjectSessionSnapshot().accessPhase).toBe('idle')
      expect(getProjectSessionSnapshot().bookId).toBe(bookId)
      expect(getEditorStatus()).toBe('Book restored')
    })

    it('mid-session regrant keeps dirty edits and retries save', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      const handle = { id: 'lib-handle-mid' }
      configureProjectSession({
        session,
        createStorage: () => storage,
        pickDirectory: () =>
          Promise.resolve(handle as unknown as FileSystemDirectoryHandle),
      })
      await attachLibraryForTests({ storage, session, handle })
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      if (spreadId === undefined) {
        throw new Error('expected a spread')
      }
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      expect(getProjectSessionSnapshot().dirty).toBe(true)

      storage.setPermissionRequired(true)
      saveBookNow()
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().savePhase).toBe('error')
      })
      expect(getProjectSessionSnapshot().accessPhase).toBe(
        'permission-required',
      )
      expect(getProjectSessionSnapshot().dirty).toBe(true)
      const before = getBookStoreSnapshot().book

      storage.setPermissionRequired(false)
      const granted = await regrantLibrary()
      expect(granted.ok).toBe(true)
      expect(getProjectSessionSnapshot().accessPhase).toBe('idle')
      expect(getBookStoreSnapshot().book).toBe(before)
      await vi.waitFor(() => {
        expect(getEditorStatus()).toBe('Book saved')
      })
      expect(getProjectSessionSnapshot().dirty).toBe(false)
    })

    it('locked-elsewhere blocks activate and clears on a new book', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        nowId: () => 'book-locked-1',
      })
      await attachLibraryForTests({ storage, session })
      const first = await createBookInLibrary()
      expect(first.ok).toBe(true)
      if (!first.ok) {
        throw new Error('expected create')
      }
      const held = await holdExternalBookLockForTests(first.value.id)
      expect(held.ok).toBe(true)

      const blocked = await tryActivateLibraryBookForTests(first.value.id)
      expect(blocked).toEqual({ ok: false, code: 'locked-elsewhere' })
      expect(getProjectSessionSnapshot().accessPhase).toBe('locked-elsewhere')
      expect(getEditorStatus()).toBe('This book is open in another tab')
      expect(getProjectSessionSnapshot().bookId).toBeNull()
      expect(getBookStoreSnapshot().book.id).toBe('locked-placeholder')
      expect(getBookStoreSnapshot().book.gallery).toEqual([])

      saveBookNow()
      expect(getEditorStatus()).toBe('This book is open in another tab')

      configureProjectSession({ nowId: () => 'book-locked-2' })
      const second = await createBookInLibrary()
      expect(second.ok).toBe(true)
      expect(getProjectSessionSnapshot().accessPhase).toBe('idle')
      expect(getProjectSessionSnapshot().bookId).toBe('book-locked-2')
    })

    it('keeps locked-elsewhere when retrying the same contended book', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        nowId: () => 'book-retry-lock',
      })
      await attachLibraryForTests({ storage, session })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      if (!created.ok) {
        throw new Error('expected create')
      }
      await holdExternalBookLockForTests(created.value.id)
      await tryActivateLibraryBookForTests(created.value.id)
      expect(getProjectSessionSnapshot().accessPhase).toBe('locked-elsewhere')
      await tryActivateLibraryBookForTests(created.value.id)
      expect(getProjectSessionSnapshot().accessPhase).toBe('locked-elsewhere')
      expect(getEditorStatus()).toBe('This book is open in another tab')
    })

    it('releases the book lock so another holder can acquire it', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        nowId: () => 'book-release-1',
      })
      await attachLibraryForTests({ storage, session })
      const first = await createBookInLibrary()
      expect(first.ok).toBe(true)
      if (!first.ok) {
        throw new Error('expected create')
      }
      configureProjectSession({ nowId: () => 'book-release-2' })
      const second = await createBookInLibrary()
      expect(second.ok).toBe(true)
      const again = await session.acquireBookLock('book-release-1')
      expect(again.ok).toBe(true)
      if (again.ok) {
        await again.value.release()
      }
    })

    it('regrantLibraryWithHandleForTests restores after permission-required', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
      })
      await attachLibraryForTests({
        storage,
        session,
        handle: { id: 'handle-a' },
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      if (!created.ok) {
        throw new Error('expected create')
      }
      saveBookNow()
      await vi.waitFor(() => {
        expect(getEditorStatus()).toBe('Book saved')
      })
      configureProjectSession({
        session: {
          rememberLibraryHandle: session.rememberLibraryHandle.bind(session),
          clearLibraryHandle: session.clearLibraryHandle.bind(session),
          acquireBookLock: session.acquireBookLock.bind(session),
          recallLibraryHandle: () =>
            Promise.resolve({ ok: false, code: 'permission-required' }),
        },
        createStorage: () => storage,
      })
      await tryRestore()
      expect(getProjectSessionSnapshot().accessPhase).toBe(
        'permission-required',
      )
      configureProjectSession({
        session,
        createStorage: () => storage,
      })
      const granted = await regrantLibraryWithHandleForTests({
        id: 'handle-a',
      })
      expect(granted.ok).toBe(true)
      expect(getProjectSessionSnapshot().bookId).toBe(created.value.id)
    })
  })
})
