import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import { makeBook } from '../core/testing/fixtures'
import assert from 'node:assert/strict'
import {
  createMemoryLibraryStorage,
  createMemorySessionState,
  type SessionDirectoryHandle,
  type StorageResult,
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
  leaveEditorForLibrary,
  listLibraryBooks,
  openBookFromHome,
  openLibrary,
  regrantLibrary,
  regrantLibraryWithHandleForTests,
  renameBookInLibrary,
  resetProjectSessionForTests,
  saveBookNow,
  selectRecentLibrary,
  setAccessPhaseForTests,
  startSessionEditor,
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
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
  })

  it('getProjectSessionSnapshot is referentially stable when unchanged', () => {
    const first = getProjectSessionSnapshot()
    const second = getProjectSessionSnapshot()
    expect(Object.is(first, second)).toBe(true)
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
    assert(created.ok, 'expected createBookInLibrary success')
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
    assert(restored.ok, 'expected tryRestore success')
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
    assert(restored.ok, 'expected tryRestore success')
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
      expect(getEditorStatus()).toMatch(/folder access|grant access/i)
      expect(getEditorStatus()).not.toContain('permission-required')
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
    expect(getEditorStatus()).toMatch(/Could not create book/i)
    expect(getEditorStatus()).not.toContain('not-found')
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

  it('openLibrary binds browse mode then openBookFromHome loads a saved book', async () => {
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
    expect(getProjectSessionSnapshot().bookId).toBeNull()
    expect(getProjectSessionSnapshot().surface).toBe('library')
    const created = await createBookInLibrary('Saved')
    expect(created.ok).toBe(true)
    assert(created.ok, 'expected create')
    await leaveEditorForLibrary()
    const opened = await openBookFromHome('library', created.value.id)
    expect(opened.ok).toBe(true)
    expect(getProjectSessionSnapshot().bookId).toBe(created.value.id)
    expect(getProjectSessionSnapshot().surface).toBe('editor')
  })

  it('openLibrary browse mode leaves books closed until openBookFromHome', async () => {
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
    const filled = await createBookInLibrary('Filled')
    expect(filled.ok).toBe(true)
    assert(filled.ok, 'expected filled')
    await leaveEditorForLibrary()
    await openLibrary()
    expect(getProjectSessionSnapshot().surface).toBe('library')
    expect(getProjectSessionSnapshot().bookId).toBeNull()
    const opened = await openBookFromHome('library', filled.value.id)
    expect(opened.ok).toBe(true)
    expect(getProjectSessionSnapshot().bookId).toBe(filled.value.id)
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
    assert(adopted.ok, 'expected adopt success')
    expect(adopted.value.id).toBe(before.id)
    expect(isLibraryBacked()).toBe(true)

    const again = await adoptCurrentBookInLibrary()
    expect(again.ok).toBe(true)
    assert(again.ok, 'expected second adopt success')
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
        ...denied,
        recallLibraryHandle: () =>
          Promise.resolve({ ok: false, code: 'permission-required' }),
      },
      createStorage: () => storage,
    })
    const restored = await tryRestore()
    expect(restored).toEqual({ ok: true, value: null })
    expect(getEditorStatus()).toMatch(/folder access|grant access/i)
    expect(getEditorStatus()).not.toContain('permission-required')
    expect(getProjectSessionSnapshot().accessPhase).toBe('permission-required')
  })

  it('createBookInLibrary stores title and rename updates it', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    const attached = await attachLibraryForTests({ storage, session })
    expect(attached.ok).toBe(true)

    const created = await createBookInLibrary('  Summer  ')
    assert(created.ok, 'expected create with title')
    expect(created.value.title).toBe('Summer')
    expect(getBookStoreSnapshot().book.title).toBe('Summer')

    const renamed = await renameBookInLibrary(created.value.id, 'Trip')
    expect(renamed).toEqual({ ok: true, value: undefined })
    expect(getBookStoreSnapshot().book.title).toBe('Trip')
    expect(getProjectSessionSnapshot().dirty).toBe(true)

    saveBookNow()
    await new Promise<void>((resolve) => {
      const started = Date.now()
      const tick = (): void => {
        const snap = getProjectSessionSnapshot()
        if (snap.savePhase === 'idle' && !snap.dirty) {
          resolve()
          return
        }
        if (Date.now() - started > 5_000) {
          resolve()
          return
        }
        setTimeout(tick, 10)
      }
      tick()
    })

    const loaded = await storage.loadBook(created.value.id)
    assert(loaded.ok, 'expected load after rename')
    expect(loaded.value.title).toBe('Trip')
  })

  it('home rename persists without swapping the active editor book', async () => {
    const handle = { name: 'TitleLib' }
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-titles',
      handle,
    })
    const first = await createBookInLibrary('Active')
    assert(first.ok, 'expected first book')
    const second = await createBookInLibrary('Other')
    assert(second.ok, 'expected second book')
    expect(getProjectSessionSnapshot().bookId).toBe(second.value.id)

    await leaveEditorForLibrary()
    expect(getProjectSessionSnapshot().libraryOpen).toBe(true)

    const renamed = await renameBookInLibrary(
      first.value.id,
      'FromHome',
      'lib-titles',
    )
    expect(renamed).toEqual({ ok: true, value: undefined })

    const listed = await selectRecentLibrary('lib-titles')
    assert(listed.ok, 'expected list after home rename')
    expect(listed.value).toEqual(
      expect.arrayContaining([
        { id: first.value.id, title: 'FromHome' },
        { id: second.value.id, title: 'Other' },
      ]),
    )

    const loaded = await storage.loadBook(first.value.id)
    assert(loaded.ok, 'expected load of renamed book')
    expect(loaded.value.title).toBe('FromHome')
    const other = await storage.loadBook(second.value.id)
    assert(other.ok, 'expected other book unchanged')
    expect(other.value.title).toBe('Other')
  })

  it('home rename refuses when the book lock is held elsewhere', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-lock',
      handle: { name: 'RenameLock' },
    })
    const created = await createBookInLibrary('Locked')
    assert(created.ok, 'expected create')
    await leaveEditorForLibrary()

    const held = await holdExternalBookLockForTests(created.value.id)
    expect(held).toEqual({ ok: true, value: undefined })

    const renamed = await renameBookInLibrary(
      created.value.id,
      'ShouldFail',
      'lib-rename-lock',
    )
    expect(renamed).toEqual({ ok: false, code: 'locked-elsewhere' })
    expect(getProjectSessionSnapshot().homeError).toBe(
      'This book is open in another tab. Close it there and try again.',
    )

    const loaded = await storage.loadBook(created.value.id)
    assert(loaded.ok, 'expected load after refused rename')
    expect(loaded.value.title).toBe('Locked')
  })

  it('home rename no-ops when the stored title already matches', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-same',
      handle: { name: 'SameTitle' },
    })
    const created = await createBookInLibrary('Same')
    assert(created.ok, 'expected create')
    await leaveEditorForLibrary()

    const renamed = await renameBookInLibrary(
      created.value.id,
      '  Same  ',
      'lib-rename-same',
    )
    expect(renamed).toEqual({ ok: true, value: undefined })
    const loaded = await storage.loadBook(created.value.id)
    assert(loaded.ok, 'expected load')
    expect(loaded.value.title).toBe('Same')
  })

  it('home rename fails without a recent library when unbound', async () => {
    resetProjectSessionForTests()
    const renamed = await renameBookInLibrary('missing-book', 'X')
    expect(renamed).toEqual({ ok: false, code: 'not-found' })
    expect(getProjectSessionSnapshot().homeError).toBe('Could not rename book.')
  })

  it('library rename uses bound storage after leave (no recall needed)', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-bound',
      handle: { name: 'Bound' },
    })
    const created = await createBookInLibrary('X')
    assert(created.ok, 'expected create')
    await leaveEditorForLibrary()
    expect(getProjectSessionSnapshot().libraryOpen).toBe(true)

    const renamed = await renameBookInLibrary(
      created.value.id,
      'Renamed',
      'lib-rename-bound',
    )
    expect(renamed).toEqual({ ok: true, value: undefined })
    const loaded = await storage.loadBook(created.value.id)
    assert(loaded.ok, 'expected load')
    expect(loaded.value.title).toBe('Renamed')
  })

  it('home rename fails when unbound and no library id is provided', async () => {
    const renamed = await renameBookInLibrary('missing', 'Nope')
    expect(renamed).toEqual({ ok: false, code: 'not-found' })
    expect(getProjectSessionSnapshot().homeError).toBe('Could not rename book.')
  })

  it('home rename fails when loadBook fails after lock', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-load',
      handle: { name: 'LoadFail' },
    })
    const created = await createBookInLibrary('Load')
    assert(created.ok, 'expected create')
    await leaveEditorForLibrary()

    storage.setPermissionRequired(true)
    const renamed = await renameBookInLibrary(
      created.value.id,
      'Next',
      'lib-rename-load',
    )
    expect(renamed).toEqual({ ok: false, code: 'permission-required' })
    expect(getProjectSessionSnapshot().homeError).toMatch(/Folder access/i)
  })

  it('home rename fails when saveBook fails after lock', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    configureProjectSession({
      session,
      createStorage: () => storage,
    })
    await attachLibraryForTests({
      storage,
      session,
      libraryId: 'lib-rename-save',
      handle: { name: 'SaveFail' },
    })
    const created = await createBookInLibrary('Save')
    assert(created.ok, 'expected create')
    await leaveEditorForLibrary()

    storage.setLockedElsewhere(true)
    const renamed = await renameBookInLibrary(
      created.value.id,
      'Next',
      'lib-rename-save',
    )
    expect(renamed).toEqual({ ok: false, code: 'locked-elsewhere' })
    expect(getProjectSessionSnapshot().homeError).toBe(
      'This book is open in another tab. Close it there and try again.',
    )
  })

  it('exposes the project test API on window', () => {
    exposeProjectSessionTestApi()
    expect(window.__photobooksProject?.saveBookNow).toBeTypeOf('function')
    expect(window.__photobooksProject?.attachMemoryLibraryForTests).toBeTypeOf(
      'function',
    )
    expect(
      window.__photobooksThumbs?.clearThumbsAndDerivedCacheForTests,
    ).toBeTypeOf('function')
  })

  it('shouldExposeProjectSessionTestApi is true in DEV and VITE_E2E only', async () => {
    const { shouldExposeProjectSessionTestApi } =
      await import('./projectSession')
    expect(shouldExposeProjectSessionTestApi({ DEV: true })).toBe(true)
    expect(
      shouldExposeProjectSessionTestApi({ DEV: false, VITE_E2E: '1' }),
    ).toBe(true)
    expect(
      shouldExposeProjectSessionTestApi({ DEV: false, VITE_E2E: 'true' }),
    ).toBe(true)
    expect(shouldExposeProjectSessionTestApi({ DEV: false })).toBe(false)
  })

  it('does not attach thumbs or project test APIs when the gate is off', () => {
    const bare = {} as Window
    exposeProjectSessionTestApi({ DEV: false }, bare)
    expect(bare.__photobooksProject).toBeUndefined()
    expect(bare.__photobooksThumbs).toBeUndefined()
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
    assert(created.ok, 'expected create')
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
      configureProjectSession({
        autosaveDebounceMs: 1000,
        timers: {
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
      })
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
        timers: {
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
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
      assert(spreadId !== undefined, 'expected a spread')

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

    it('schedules autosave only through the injected timers seam', async () => {
      vi.useRealTimers()
      const armed: {
        id: number
        callback: () => void
        ms: number
      }[] = []
      const cleared: number[] = []
      let nextId = 1
      const timers = {
        setTimeout: ((callback: () => void, ms?: number) => {
          const id = nextId
          nextId += 1
          armed.push({ id, callback, ms: ms ?? 0 })
          return id as unknown as ReturnType<typeof globalThis.setTimeout>
        }) as typeof globalThis.setTimeout,
        clearTimeout: ((id: ReturnType<typeof globalThis.setTimeout>) => {
          cleared.push(id as unknown as number)
        }) as typeof globalThis.clearTimeout,
      }
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 1000,
        timers,
      })
      await attachLibraryForTests({ storage, session })
      const spreads = getBookStoreSnapshot().book.spreads
      const firstSpread = spreads[0]?.id
      const secondSpread = spreads[1]?.id
      assert(
        firstSpread !== undefined && secondSpread !== undefined,
        'expected two spreads',
      )

      dispatchBookOp({
        type: 'applyTemplate',
        spreadId: firstSpread,
        templateId: '2-up',
      })
      expect(armed).toHaveLength(1)
      expect(armed[0]?.ms).toBe(1000)
      expect(getProjectSessionSnapshot()).toMatchObject({
        dirty: true,
        savePhase: 'pending',
      })
      expect(getEditorStatus()).not.toBe('Book saved')

      dispatchBookOp({
        type: 'applyTemplate',
        spreadId: secondSpread,
        templateId: '4-grid',
      })
      expect(cleared).toEqual([armed[0]?.id])
      expect(armed).toHaveLength(2)
      expect(armed[1]?.ms).toBe(1000)
      expect(getEditorStatus()).not.toBe('Book saved')

      const pending = armed[1]
      assert(pending !== undefined, 'expected a second armed timer')
      pending.callback()
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
      assert(spreadId !== undefined, 'expected a spread')

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

    it('gesture end does not arm autosave when bookId was cleared while pending', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      const handle = { name: 'GuardLib' }
      const saveSpy = vi.spyOn(storage, 'saveBook')
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 1000,
        timers: {
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
      })
      await attachLibraryForTests({
        storage,
        session,
        libraryId: 'lib-guard',
        handle,
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      assert(spreadId !== undefined, 'expected a spread')

      setEditorGestureActive(true)
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      expect(getProjectSessionSnapshot()).toMatchObject({
        dirty: true,
        savePhase: 'pending',
        bookId: created.value.id,
      })

      const opened = await openBookFromHome('lib-guard', 'missing-book')
      expect(opened).toEqual({ ok: false, code: 'not-found' })
      expect(getProjectSessionSnapshot()).toMatchObject({
        dirty: true,
        savePhase: 'pending',
        bookId: null,
        // Bound library stays open; missing book does not drop the folder.
        libraryOpen: true,
        surface: 'library',
      })

      saveSpy.mockClear()
      setEditorGestureActive(false)
      await vi.advanceTimersByTimeAsync(1000)
      expect(saveSpy).not.toHaveBeenCalled()
      expect(getProjectSessionSnapshot().savePhase).toBe('pending')
      expect(getProjectSessionSnapshot().status).not.toMatchObject({
        kind: 'error',
        action: 'save',
      })
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
      assert(
        first !== undefined && second !== undefined,
        'expected two spreads',
      )

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
      assert(spreadId !== undefined, 'expected a spread')

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
      assert(spreadId !== undefined, 'expected a spread')
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
      assert(spreadId !== undefined, 'expected a spread')
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
      assert(spreadId !== undefined, 'expected a spread')
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
      assert(spreadId !== undefined, 'expected a spread')
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
      assert(spreadId !== undefined, 'expected a spread')
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
      assert(created.ok, 'expected create')
      const bookId = created.value.id
      saveBookNow()
      await vi.waitFor(() => {
        expect(getEditorStatus()).toBe('Book saved')
      })

      configureProjectSession({
        session: {
          ...session,
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
      assert(spreadId !== undefined, 'expected a spread')
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
      assert(first.ok, 'expected create')
      const held = await holdExternalBookLockForTests(first.value.id)
      expect(held.ok).toBe(true)

      const blocked = await tryActivateLibraryBookForTests(first.value.id)
      expect(blocked).toEqual({ ok: false, code: 'locked-elsewhere' })
      expect(getProjectSessionSnapshot().accessPhase).toBe('locked-elsewhere')
      expect(getEditorStatus()).toBe(
        'This book is open in another tab. Close it there and try again.',
      )
      expect(getProjectSessionSnapshot().bookId).toBeNull()
      expect(getBookStoreSnapshot().book.id).toBe('locked-placeholder')
      expect(getBookStoreSnapshot().book.gallery).toEqual([])

      saveBookNow()
      expect(getEditorStatus()).toBe(
        'This book is open in another tab. Close it there and try again.',
      )

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
      assert(created.ok, 'expected create')
      await holdExternalBookLockForTests(created.value.id)
      await tryActivateLibraryBookForTests(created.value.id)
      expect(getProjectSessionSnapshot().accessPhase).toBe('locked-elsewhere')
      await tryActivateLibraryBookForTests(created.value.id)
      expect(getProjectSessionSnapshot().accessPhase).toBe('locked-elsewhere')
      expect(getEditorStatus()).toBe(
        'This book is open in another tab. Close it there and try again.',
      )
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
      assert(first.ok, 'expected create')
      configureProjectSession({ nowId: () => 'book-release-2' })
      const second = await createBookInLibrary()
      expect(second.ok).toBe(true)
      const again = await session.acquireBookLock('book-release-1')
      expect(again.ok).toBe(true)
      assert.equal(again.ok, true)
      await again.value.release()
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
      assert(created.ok, 'expected create')
      saveBookNow()
      await vi.waitFor(() => {
        expect(getEditorStatus()).toBe('Book saved')
      })
      configureProjectSession({
        session: {
          ...session,
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

  describe('merge blockers', () => {
    function withPlacedPhotos(
      book: ReturnType<typeof getBookStoreSnapshot>['book'],
    ) {
      return {
        ...book,
        gallery: ['asset-placed'],
        assets: {
          'asset-placed': {
            sourceRootId: 'root-placed',
            relativePath: 'placed.jpg',
            byteSize: 12,
            mtimeMs: 2,
          },
        },
      }
    }

    async function openLibraryWithPhotos(options: {
      storage: ReturnType<typeof createMemoryLibraryStorage>
      session: ReturnType<typeof createMemorySessionState>
      libraryId: string
      handle: { name: string }
    }) {
      configureProjectSession({
        session: options.session,
        createStorage: () => options.storage,
      })
      await attachLibraryForTests({
        storage: options.storage,
        session: options.session,
        libraryId: options.libraryId,
        handle: options.handle,
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      resetBookStore({
        book: withPlacedPhotos(created.value),
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
      saveBookNow()
      await vi.waitFor(() => {
        expect(getEditorStatus()).toBe('Book saved')
      })
      return created.value.id
    }

    it('Home then Open other library does not copy the previous book', async () => {
      const libA = createMemoryLibraryStorage()
      const libB = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      const handleA = {
        name: 'LibA',
        isSameEntry: (other: { name?: string }) =>
          Promise.resolve(other.name === 'LibA'),
      }
      await libA.updateLibrary({})
      const bookACreated = await libA.createBook(makeBook({ id: 'book-a' }))
      expect(bookACreated.ok).toBe(true)
      await session.rememberLibraryHandle('lib-a', handleA, 'LibA')

      const bookB = await openLibraryWithPhotos({
        storage: libB,
        session,
        libraryId: 'lib-b',
        handle: { name: 'LibB' },
      })
      expect(getBookStoreSnapshot().book.gallery).toEqual(['asset-placed'])

      await leaveEditorForLibrary()
      expect(getBookStoreSnapshot().book.gallery).toEqual([])
      expect(getBookStoreSnapshot().sessionMeta.size).toBe(0)

      configureProjectSession({
        session,
        createStorage: () => libA,
        pickDirectory: () =>
          Promise.resolve(handleA as unknown as FileSystemDirectoryHandle),
      })
      const opened = await openLibrary()
      expect(opened.ok).toBe(true)
      expect(getProjectSessionSnapshot().surface).toBe('library')
      expect(getProjectSessionSnapshot().bookId).toBeNull()
      const listedA = await libA.listBooks()
      expect(listedA.ok).toBe(true)
      assert(listedA.ok, 'expected list A')
      expect(listedA.value.some((book) => book.id === bookB)).toBe(false)
      const libraryKey = getProjectSessionSnapshot().libraryId ?? 'library'
      const activated = await openBookFromHome(libraryKey, 'book-a')
      expect(activated.ok).toBe(true)
      expect(getProjectSessionSnapshot().bookId).toBe('book-a')
      expect(getBookStoreSnapshot().book.id).toBe('book-a')
    })

    it('Home then New library does not copy the previous book', async () => {
      const libB = createMemoryLibraryStorage()
      const libNew = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      const bookB = await openLibraryWithPhotos({
        storage: libB,
        session,
        libraryId: 'lib-b',
        handle: { name: 'LibB' },
      })
      await leaveEditorForLibrary()
      expect(getBookStoreSnapshot().book.gallery).toEqual([])

      configureProjectSession({
        session,
        createStorage: () => libNew,
        pickDirectory: () =>
          Promise.resolve({
            name: 'LibNew',
          } as unknown as FileSystemDirectoryHandle),
      })
      const created = await createLibrary()
      expect(created.ok).toBe(true)
      const listed = await libNew.listBooks()
      expect(listed.ok).toBe(true)
      assert(listed.ok, 'expected list')
      expect(listed.value.some((book) => book.id === bookB)).toBe(false)
      expect(getBookStoreSnapshot().book.gallery).toEqual([])
    })

    it('Start editing after Home does not keep a detached copy of the old book', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      await openLibraryWithPhotos({
        storage,
        session,
        libraryId: 'lib-a',
        handle: { name: 'LibA' },
      })
      await leaveEditorForLibrary()
      expect(getBookStoreSnapshot().book.gallery).toEqual([])
      startSessionEditor()
      expect(getProjectSessionSnapshot().surface).toBe('editor')
      expect(getBookStoreSnapshot().book.gallery).toEqual([])
      expect(getProjectSessionSnapshot().libraryOpen).toBe(true)
    })

    it('Home within autosave debounce flushes the edit', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 60_000,
      })
      await attachLibraryForTests({
        storage,
        session,
        libraryId: 'lib-flush',
        handle: { name: 'Flush' },
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      expect(spreadId).toBeTypeOf('string')
      assert(spreadId !== undefined, 'expected spread')
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      expect(getProjectSessionSnapshot().dirty).toBe(true)

      await leaveEditorForLibrary()
      const loaded = await storage.loadBook(created.value.id)
      expect(loaded.ok).toBe(true)
      assert(loaded.ok, 'expected load')
      expect(loaded.value.spreads[0]?.templateId).toBe('2-up')
    })

    it('New library within autosave debounce flushes the edit', async () => {
      const storage = createMemoryLibraryStorage()
      const nextStorage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 60_000,
      })
      await attachLibraryForTests({
        storage,
        session,
        libraryId: 'lib-flush-new',
        handle: { name: 'FlushNew' },
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      assert(spreadId !== undefined, 'expected spread')
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })

      configureProjectSession({
        session,
        createStorage: () => nextStorage,
        pickDirectory: () =>
          Promise.resolve({
            name: 'NextLib',
          } as unknown as FileSystemDirectoryHandle),
        autosaveDebounceMs: 60_000,
      })
      const createdLib = await createLibrary()
      expect(createdLib.ok).toBe(true)
      const loaded = await storage.loadBook(created.value.id)
      expect(loaded.ok).toBe(true)
      assert(loaded.ok, 'expected load')
      expect(loaded.value.spreads[0]?.templateId).toBe('2-up')
    })

    it('Home with gesture-deferred edit flushes the edit', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        autosaveDebounceMs: 60_000,
      })
      await attachLibraryForTests({
        storage,
        session,
        libraryId: 'lib-gesture',
        handle: { name: 'Gesture' },
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      const spreadId = getBookStoreSnapshot().book.spreads[0]?.id
      assert(spreadId !== undefined, 'expected spread')
      setEditorGestureActive(true)
      dispatchBookOp({ type: 'applyTemplate', spreadId, templateId: '2-up' })
      await leaveEditorForLibrary()
      setEditorGestureActive(false)
      const loaded = await storage.loadBook(created.value.id)
      expect(loaded.ok).toBe(true)
      assert(loaded.ok, 'expected load')
      expect(loaded.value.spreads[0]?.templateId).toBe('2-up')
    })

    it('Home with savePhase error stays in the editor', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
      })
      await attachLibraryForTests({
        storage,
        session,
        libraryId: 'lib-err',
        handle: { name: 'Err' },
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      storage.setPermissionRequired(true)
      saveBookNow()
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().savePhase).toBe('error')
      })
      await leaveEditorForLibrary()
      expect(getProjectSessionSnapshot().surface).toBe('editor')
      expect(getProjectSessionSnapshot().bookId).toBe(created.value.id)
      expect(getEditorStatus().length).toBeGreaterThan(0)
    })

    it('New library picker cancel keeps the open book and lock', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
        pickDirectory: () => Promise.resolve(null),
      })
      await attachLibraryForTests({
        storage,
        session,
        libraryId: 'lib-cancel',
        handle: { name: 'Cancel' },
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      const bookIdBefore = created.value.id
      const result = await createLibrary()
      expect(result.ok).toBe(false)
      expect(getProjectSessionSnapshot().bookId).toBe(bookIdBefore)
      expect(getProjectSessionSnapshot().libraryOpen).toBe(true)
      expect(getProjectSessionSnapshot().surface).toBe('editor')
      const second = await session.acquireBookLock(bookIdBefore)
      expect(second).toEqual({ ok: false, code: 'locked-elsewhere' })
    })

    it('remember failure after activate rolls back without leaking a lock', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      let failRemember = false
      configureProjectSession({
        session: {
          ...session,
          rememberLibraryHandle: (id, handle, label) => {
            if (failRemember) {
              return Promise.resolve({ ok: false, code: 'not-found' })
            }
            return session.rememberLibraryHandle(id, handle, label)
          },
          peekLibraryHandle: session.peekLibraryHandle.bind(session),
          recallLibraryHandle: session.recallLibraryHandle.bind(session),
          clearLibraryHandle: session.clearLibraryHandle.bind(session),
          setActiveIds: session.setActiveIds.bind(session),
          getActiveIds: session.getActiveIds.bind(session),
          acquireBookLock: session.acquireBookLock.bind(session),
        },
        createStorage: () => storage,
        pickDirectory: () =>
          Promise.resolve({
            name: 'RememberFail',
          } as unknown as FileSystemDirectoryHandle),
      })
      failRemember = true
      const opened = await openLibrary()
      expect(opened.ok).toBe(false)
      expect(getProjectSessionSnapshot().libraryOpen).toBe(false)
      expect(getProjectSessionSnapshot().homeError).toBeTruthy()
      const lock = await session.acquireBookLock('any-after-rollback')
      expect(lock.ok).toBe(true)
      assert.equal(lock.ok, true)
      await lock.value.release()
    })

    it('openBookFromHome after leave uses bound storage without re-remember', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      let rememberCalls = 0
      const wrappedSession = {
        ...session,
        rememberLibraryHandle: (
          id: string,
          handle: SessionDirectoryHandle,
          label?: string,
        ) => {
          rememberCalls += 1
          return session.rememberLibraryHandle(id, handle, label)
        },
        peekLibraryHandle: session.peekLibraryHandle.bind(session),
        recallLibraryHandle: session.recallLibraryHandle.bind(session),
        clearLibraryHandle: session.clearLibraryHandle.bind(session),
        setActiveIds: session.setActiveIds.bind(session),
        getActiveIds: session.getActiveIds.bind(session),
        acquireBookLock: session.acquireBookLock.bind(session),
      }
      configureProjectSession({
        session: wrappedSession,
        createStorage: () => storage,
      })
      await attachLibraryForTests({
        storage,
        session: wrappedSession,
        libraryId: 'lib-remember-home',
        handle: { name: 'RememberHome' },
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      await leaveEditorForLibrary()
      const remembersBeforeOpen = rememberCalls
      const opened = await openBookFromHome(
        'lib-remember-home',
        created.value.id,
      )
      expect(opened.ok).toBe(true)
      expect(rememberCalls).toBe(remembersBeforeOpen)
      expect(getProjectSessionSnapshot().surface).toBe('editor')
      expect(getProjectSessionSnapshot().libraryOpen).toBe(true)
      await leaveEditorForLibrary()
      const lock = await session.acquireBookLock(created.value.id)
      expect(lock.ok).toBe(true)
      assert.equal(lock.ok, true)
      await lock.value.release()
    })

    it('restorePending blocks createLibrary', async () => {
      const session = createMemorySessionState()
      const storage = createMemoryLibraryStorage()
      let releaseRecall!: (value: StorageResult<SessionDirectoryHandle>) => void
      const recallGate = new Promise<StorageResult<SessionDirectoryHandle>>(
        (resolve) => {
          releaseRecall = resolve
        },
      )
      configureProjectSession({
        session: {
          ...session,
          recallLibraryHandle: () => recallGate,
          peekLibraryHandle: session.peekLibraryHandle.bind(session),
          rememberLibraryHandle: session.rememberLibraryHandle.bind(session),
          clearLibraryHandle: session.clearLibraryHandle.bind(session),
          setActiveIds: session.setActiveIds.bind(session),
          getActiveIds: session.getActiveIds.bind(session),
          acquireBookLock: session.acquireBookLock.bind(session),
        },
        createStorage: () => storage,
        storageKey: (() => {
          const map = new Map<string, string>([
            ['photobooks.libraryId', 'lib-restore'],
            ['photobooks.activeBookId', 'book-restore'],
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
            key(index: number) {
              return [...map.keys()][index] ?? null
            },
            removeItem(key: string) {
              map.delete(key)
            },
            setItem(key: string, value: string) {
              map.set(key, value)
            },
          }
        })(),
        pickDirectory: () =>
          Promise.resolve({
            name: 'DuringRestore',
          } as unknown as FileSystemDirectoryHandle),
      })
      const restorePromise = tryRestore()
      await vi.waitFor(() => {
        expect(getProjectSessionSnapshot().restorePending).toBe(true)
      })
      const created = await createLibrary()
      expect(created.ok).toBe(false)
      releaseRecall({ ok: false, code: 'not-found' })
      await restorePromise
    })

    it('locked-elsewhere from home clears accessPhase on home', async () => {
      const storage = createMemoryLibraryStorage()
      const session = createMemorySessionState()
      configureProjectSession({
        session,
        createStorage: () => storage,
      })
      await attachLibraryForTests({
        storage,
        session,
        libraryId: 'lib-lock',
        handle: { name: 'Lock' },
      })
      const created = await createBookInLibrary()
      expect(created.ok).toBe(true)
      assert(created.ok, 'expected create')
      await leaveEditorForLibrary()
      await holdExternalBookLockForTests(created.value.id)
      const opened = await openBookFromHome('lib-lock', created.value.id)
      expect(opened).toEqual({ ok: false, code: 'locked-elsewhere' })
      expect(getProjectSessionSnapshot().surface).toBe('library')
      expect(getProjectSessionSnapshot().accessPhase).toBe('idle')
      startSessionEditor()
      expect(getEditorStatus()).not.toMatch(/another tab/i)
    })
  })

  it('leaveEditorForLibrary re-binds storage after permission restore path', async () => {
    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    const handle = { name: 'RebindLib' }
    const map = new Map<string, string>()
    const storageKey: Storage = {
      get length() {
        return map.size
      },
      clear: () => {
        map.clear()
      },
      getItem: (key) => map.get(key) ?? null,
      key: (index) => [...map.keys()][index] ?? null,
      removeItem: (key) => {
        map.delete(key)
      },
      setItem: (key, value) => {
        map.set(key, value)
      },
    }
    configureProjectSession({
      session,
      createStorage: () => storage,
      storageKey,
    })
    await attachLibraryForTests({
      storage,
      session,
      handle,
      mode: 'browse',
    })
    expect(getProjectSessionSnapshot().libraryId).toBe('library')
    session.setPermissionRequired(true)
    await tryRestore()
    expect(getProjectSessionSnapshot().accessPhase).toBe('permission-required')
    expect(getProjectSessionSnapshot().libraryOpen).toBe(false)
    session.setPermissionRequired(false)
    await leaveEditorForLibrary()
    expect(getProjectSessionSnapshot().libraryLabel).toBe('RebindLib')
    expect(getProjectSessionSnapshot().surface).toBe('library')
  })

  it('tryActivateLibraryBookForTests and listLibraryBooks edge paths', async () => {
    await expect(tryActivateLibraryBookForTests('x')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    exposeProjectSessionTestApi({ DEV: true }, undefined)

    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    await expect(tryActivateLibraryBookForTests('missing')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(listLibraryBooks()).resolves.toMatchObject({ ok: true })

    const storage = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    const boomStorage = {
      ...storage,
      listBooks: () => {
        throw new Error('list boom')
      },
    }
    configureProjectSession({
      session,
      createStorage: () => boomStorage,
    })
    await attachLibraryForTests({
      storage: boomStorage,
      session,
      handle: { name: 'Boom' },
      mode: 'browse',
    })
    await expect(listLibraryBooks()).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('setLibraryId(null) clears libraryLabel via open failure rollback', async () => {
    const other = createMemoryLibraryStorage()
    const session = createMemorySessionState()
    await session.rememberLibraryHandle('other', { name: 'Other' }, 'Other')
    configureProjectSession({
      session,
      createStorage: () => other,
    })
    const opened = await openBookFromHome('other', 'missing-book')
    expect(opened.ok).toBe(false)
    expect(getProjectSessionSnapshot().libraryId).toBeNull()
    expect(getProjectSessionSnapshot().libraryLabel).toBeNull()
  })
})
