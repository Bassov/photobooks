import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../../core/testing/fixtures'
import assert from 'node:assert/strict'
import {
  createMemoryLibraryStorage,
  createMemorySessionState,
  type LibraryStorage,
  type SessionDirectoryHandle,
  type StorageFailureCode,
  type StorageResult,
} from '../../project'
import { createFakeBrowserDirectory } from '../../project/fsa/browserDirectory.test-helpers'
import {
  createLibraryActivation,
  type LibraryActivation,
  type LibraryActivationAccessPhase,
  type LibraryActivationHost,
  type LibraryActivationStatus,
  type LibraryActivationSurface,
} from './libraryActivation'

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function failure(code: StorageFailureCode): StorageResult<never> {
  return { ok: false, code }
}

function bookWithFrameAsset(id: string, assetId: string) {
  return makeBook({
    id,
    gallery: [],
    assets: { [assetId]: {} },
    spreads: [
      makeSpread({
        frames: [
          makeFrame({ id: 'empty-frame' }),
          makeFrame({
            id: 'filled-frame',
            assetId,
            crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
          }),
        ],
      }),
      makeSpread({
        id: 'spread-empty',
        frames: [makeFrame({ id: 'frame-empty-spread' })],
      }),
    ],
  })
}

describe('createLibraryActivation', () => {
  let storage: LibraryStorage | null
  let libraryId: string | null
  let bookId: string | null
  let book = makeBook({ id: 'session-book', gallery: [] })
  let dirty = false
  let accessPhase: LibraryActivationAccessPhase
  let surface: LibraryActivationSurface
  let status: LibraryActivationStatus
  let homeError: string | null
  let editorStatus: string | null
  let restorePending = false
  let preferredLibraryId: string | null
  let heldLocks = new Set<string>()
  let flushResult: StorageResult<void>
  let pickDirectory: () => Promise<FileSystemDirectoryHandle | null>
  let storagesByHandle = new Map<string, LibraryStorage>()
  let resolveIdByHandle = new Map<string, string>()
  let remembered = new Map<string, SessionDirectoryHandle>()
  let recallResults = new Map<string, StorageResult<SessionDirectoryHandle>>()
  let recallThrows = new Set<string>()
  let activeIds = {
    libraryId: null as string | null,
    bookId: null as string | null,
  }
  let persisted = {
    libraryId: null as string | null,
    bookId: null as string | null,
  }
  let assetClears = 0
  let pendingRegrant: { libraryId: string | null; bookId: string | null } | null
  let takeBookLockResult: StorageResult<void> | null
  let getActiveIdsImpl: () => Promise<{
    libraryId: string | null
    bookId: string | null
  }>
  let resetAutosave = vi.fn()
  let cancelAutosave = vi.fn()
  let emit = vi.fn()
  let clearAssetSources = vi.fn(() => {
    assetClears += 1
  })
  let setPendingRegrant = vi.fn(
    (nextLibraryId: string | null, nextBookId: string | null) => {
      pendingRegrant = { libraryId: nextLibraryId, bookId: nextBookId }
    },
  )
  let releaseHeldBookLock = vi.fn(() => {
    heldLocks.clear()
    return Promise.resolve()
  })
  let persistIds = vi.fn(() => {
    persisted = { libraryId, bookId }
    activeIds = { libraryId, bookId }
  })
  let setStatus = vi.fn((next: LibraryActivationStatus) => {
    status = next
  })
  let setAccessPhase = vi.fn((phase: LibraryActivationAccessPhase) => {
    accessPhase = phase
  })
  let setHomeError = vi.fn((message: string | null) => {
    homeError = message
  })
  let setDirty = vi.fn((next: boolean) => {
    dirty = next
  })
  let setSurface = vi.fn((next: LibraryActivationSurface) => {
    surface = next
  })
  let setBookId = vi.fn((id: string | null) => {
    bookId = id
  })
  let setLibraryId = vi.fn((id: string | null) => {
    libraryId = id
  })
  let setActiveIds = vi.fn(
    (ids: { libraryId: string | null; bookId: string | null }) => {
      activeIds = { ...ids }
    },
  )
  let clearBlockedAndPending = vi.fn(() => {
    pendingRegrant = null
  })
  let clearPersistedIdKeys = vi.fn(() => {
    persisted = { libraryId: null, bookId: null }
  })
  let setRestorePending = vi.fn((next: boolean) => {
    restorePending = next
  })
  let controller: LibraryActivation
  let host: LibraryActivationHost

  function handleName(handle: SessionDirectoryHandle): string {
    if ('name' in handle && typeof handle.name === 'string') {
      return handle.name
    }
    return 'unnamed'
  }

  function buildHost(): LibraryActivationHost {
    return {
      withActionBusy: async (task) => task(),
      pickDirectory: () => pickDirectory(),
      createStorageFromHandle: (handle) => {
        const name = handleName(handle)
        const next = storagesByHandle.get(name)
        assert(next, `missing storage for handle ${name}`)
        return next
      },
      resolveLibraryIdForHandle: (handle) =>
        Promise.resolve(
          resolveIdByHandle.get(handleName(handle)) ?? handleName(handle),
        ),
      flushPendingSaveBeforeRelease: () => Promise.resolve(flushResult),
      releaseHeldBookLock: () => releaseHeldBookLock(),
      takeBookLock: (id) => {
        if (takeBookLockResult) {
          return Promise.resolve(takeBookLockResult)
        }
        if (heldLocks.has(id)) {
          return Promise.resolve(failure('locked-elsewhere'))
        }
        heldLocks.add(id)
        return Promise.resolve(success(undefined))
      },
      setPendingRegrant: (nextLibraryId, nextBookId) => {
        setPendingRegrant(nextLibraryId, nextBookId)
      },
      clearBlockedAndPending: () => {
        clearBlockedAndPending()
      },
      resetAutosave: () => {
        resetAutosave()
      },
      cancelAutosave: () => {
        cancelAutosave()
      },
      persistIds: () => {
        persistIds()
      },
      clearPersistedIdKeys: () => {
        clearPersistedIdKeys()
      },
      setActiveIds: (ids) => {
        setActiveIds(ids)
      },
      getActiveIds: () => getActiveIdsImpl(),
      rememberLibraryHandle: (id, handle) => {
        remembered.set(id, handle)
        return Promise.resolve(success(undefined))
      },
      recallLibraryHandle: (id) => {
        if (recallThrows.has(id)) {
          return Promise.reject(new Error('recall boom'))
        }
        const forced = recallResults.get(id)
        if (forced) {
          return Promise.resolve(forced)
        }
        const handle = remembered.get(id)
        if (!handle) {
          return Promise.resolve(failure('not-found'))
        }
        return Promise.resolve(success(handle))
      },
      handleDisplayLabel: (handle) => handleName(handle),
      humanMessageForCode: (_code, fallback) => fallback,
      setHomeError: (message) => {
        setHomeError(message)
      },
      setStatus: (next) => {
        setStatus(next)
      },
      setEditorStatus: (message) => {
        editorStatus = message
      },
      setPermissionRequiredAccess: () => {
        accessPhase = 'permission-required'
      },
      getAccessPhase: () => accessPhase,
      setAccessPhase: (phase) => {
        setAccessPhase(phase)
      },
      setSurface: (next) => {
        setSurface(next)
      },
      emit: () => {
        emit()
      },
      getStorage: () => storage,
      setStorage: (next) => {
        storage = next
      },
      getLibraryId: () => libraryId,
      setLibraryId: (id) => {
        setLibraryId(id)
      },
      getBookId: () => bookId,
      setBookId: (id) => {
        setBookId(id)
      },
      setDirty: (next) => {
        setDirty(next)
      },
      getBook: () => book,
      resetBookStore: (next) => {
        book = next
      },
      withoutDirtyTracking: (fn) => {
        fn()
      },
      withoutDirtyTrackingAsync: async (fn) => fn(),
      clearAssetSources: () => {
        clearAssetSources()
      },
      createEmptyLibraryBook: (id) => makeBook({ id, gallery: [] }),
      nowId: () => 'empty-book-id',
      upgradeSessionAssets: () => Promise.resolve(),
      readPersistedIds: () => persisted,
      setRestorePending: (next) => {
        setRestorePending(next)
      },
      setPreferredLibraryId: (id) => {
        preferredLibraryId = id
      },
      defaultLibraryId: () => 'library',
    }
  }

  beforeEach(() => {
    storage = null
    libraryId = null
    bookId = null
    book = makeBook({ id: 'session-book', gallery: [] })
    dirty = false
    accessPhase = 'idle'
    surface = 'home'
    status = { kind: 'idle' }
    homeError = null
    editorStatus = null
    restorePending = false
    preferredLibraryId = null
    heldLocks = new Set()
    flushResult = success(undefined)
    pickDirectory = () => Promise.resolve(null)
    storagesByHandle = new Map()
    resolveIdByHandle = new Map()
    remembered = new Map()
    recallResults = new Map()
    recallThrows = new Set()
    activeIds = { libraryId: null, bookId: null }
    persisted = { libraryId: null, bookId: null }
    assetClears = 0
    pendingRegrant = null
    takeBookLockResult = null
    getActiveIdsImpl = () => Promise.resolve(activeIds)
    resetAutosave = vi.fn()
    cancelAutosave = vi.fn()
    emit = vi.fn()
    clearAssetSources = vi.fn(() => {
      assetClears += 1
    })
    setPendingRegrant = vi.fn(
      (nextLibraryId: string | null, nextBookId: string | null) => {
        pendingRegrant = { libraryId: nextLibraryId, bookId: nextBookId }
      },
    )
    releaseHeldBookLock = vi.fn(() => {
      heldLocks.clear()
      return Promise.resolve()
    })
    persistIds = vi.fn(() => {
      persisted = { libraryId, bookId }
      activeIds = { libraryId, bookId }
    })
    setStatus = vi.fn((next: LibraryActivationStatus) => {
      status = next
    })
    setAccessPhase = vi.fn((phase: LibraryActivationAccessPhase) => {
      accessPhase = phase
    })
    setHomeError = vi.fn((message: string | null) => {
      homeError = message
    })
    setDirty = vi.fn((next: boolean) => {
      dirty = next
    })
    setSurface = vi.fn((next: LibraryActivationSurface) => {
      surface = next
    })
    setBookId = vi.fn((id: string | null) => {
      bookId = id
    })
    setLibraryId = vi.fn((id: string | null) => {
      libraryId = id
    })
    setActiveIds = vi.fn(
      (ids: { libraryId: string | null; bookId: string | null }) => {
        activeIds = { ...ids }
      },
    )
    clearBlockedAndPending = vi.fn(() => {
      pendingRegrant = null
    })
    clearPersistedIdKeys = vi.fn(() => {
      persisted = { libraryId: null, bookId: null }
    })
    setRestorePending = vi.fn((next: boolean) => {
      restorePending = next
    })
    host = buildHost()
    controller = createLibraryActivation(host)
  })

  it('createLibrary picker cancel leaves state unchanged', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const created = await lib.createBook(makeBook({ id: 'open-book' }))
    expect(created.ok).toBe(true)
    storage = lib
    libraryId = 'lib-open'
    bookId = 'open-book'
    heldLocks.add('open-book')
    surface = 'editor'
    status = { kind: 'open', libraryId: 'lib-open', bookId: 'open-book' }
    pickDirectory = () => Promise.resolve(null)

    const result = await controller.createLibrary()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBe('Library folder was not selected.')
    expect(storage).toBe(lib)
    expect(libraryId).toBe('lib-open')
    expect(bookId).toBe('open-book')
    expect(heldLocks.has('open-book')).toBe(true)
    expect(surface).toBe('editor')
  })

  it('openLibrary picker cancel leaves state unchanged', async () => {
    pickDirectory = () => Promise.resolve(null)
    const result = await controller.openLibrary()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBe('Library folder was not selected.')
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
    expect(status).toEqual({ kind: 'idle' })
  })

  it('permission denied on selectRecentLibrary leaves library unbound', async () => {
    recallResults.set('recent-a', failure('permission-required'))
    const result = await controller.selectRecentLibrary('recent-a')
    expect(result).toEqual({ ok: false, code: 'permission-required' })
    expect(accessPhase).toBe('permission-required')
    expect(pendingRegrant).toEqual({ libraryId: 'recent-a', bookId: null })
    expect(setPendingRegrant).toHaveBeenCalledWith('recent-a', null)
    expect(status).toEqual({
      kind: 'error',
      code: 'permission-required',
      action: 'open recent library',
    })
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
  })

  it('permission denied on tryRestore leaves state unbound', async () => {
    persisted = { libraryId: 'lib-r', bookId: 'book-r' }
    recallResults.set('lib-r', failure('permission-required'))
    const result = await controller.tryRestore()
    expect(result).toEqual({ ok: true, value: null })
    expect(accessPhase).toBe('permission-required')
    expect(status).toEqual({
      kind: 'error',
      code: 'permission-required',
      action: 'restore library',
    })
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
    expect(surface).toBe('home')
    expect(restorePending).toBe(false)
    expect(resetAutosave).toHaveBeenCalled()
    expect(emit).toHaveBeenCalled()
  })

  it('switch open library never writes the previous book into the new library', async () => {
    const libA = createMemoryLibraryStorage()
    const libB = createMemoryLibraryStorage()
    await libA.updateLibrary({})
    await libB.updateLibrary({})
    const bookA = makeBook({
      id: 'book-a',
      gallery: ['asset-a'],
      assets: {
        'asset-a': {
          sourceRootId: 'root-a',
          relativePath: 'a.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    })
    const bookB = makeBook({
      id: 'book-b',
      gallery: ['asset-b'],
      assets: {
        'asset-b': {
          sourceRootId: 'root-b',
          relativePath: 'b.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    })
    expect((await libA.createBook(bookA)).ok).toBe(true)
    expect((await libB.createBook(bookB)).ok).toBe(true)

    const handleA = createFakeBrowserDirectory({ name: 'LibA' })
    storagesByHandle.set('LibA', libA)
    storagesByHandle.set('LibB', libB)
    resolveIdByHandle.set('LibA', 'lib-a')
    resolveIdByHandle.set('LibB', 'lib-b')

    storage = libB
    libraryId = 'lib-b'
    bookId = 'book-b'
    book = bookB
    heldLocks.add('book-b')
    surface = 'editor'

    pickDirectory = () => Promise.resolve(handleA)
    const opened = await controller.openLibrary()
    expect(opened.ok).toBe(true)
    expect(libraryId).toBe('lib-a')
    expect(bookId).toBe('book-a')
    expect(book.id).toBe('book-a')

    const listedA = await libA.listBooks()
    expect(listedA.ok).toBe(true)
    assert(listedA.ok, 'expected list A')
    expect(listedA.value.some((entry) => entry.id === 'book-b')).toBe(false)
    const listedB = await libB.listBooks()
    expect(listedB.ok).toBe(true)
    assert(listedB.ok, 'expected list B')
    expect(listedB.value.some((entry) => entry.id === 'book-b')).toBe(true)
  })

  it('new library starts from a clean empty book and does not copy the previous book', async () => {
    const libOld = createMemoryLibraryStorage()
    const libNew = createMemoryLibraryStorage()
    await libOld.updateLibrary({})
    const previous = makeBook({
      id: 'prev-book',
      gallery: ['asset-prev'],
      assets: {
        'asset-prev': {
          sourceRootId: 'root-prev',
          relativePath: 'p.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    })
    expect((await libOld.createBook(previous)).ok).toBe(true)

    storage = libOld
    libraryId = 'lib-old'
    bookId = 'prev-book'
    book = previous
    heldLocks.add('prev-book')
    surface = 'editor'
    dirty = true

    const handleNew = createFakeBrowserDirectory({ name: 'LibNew' })
    storagesByHandle.set('LibNew', libNew)
    resolveIdByHandle.set('LibNew', 'lib-new')
    pickDirectory = () => Promise.resolve(handleNew)

    const created = await controller.createLibrary()
    expect(created.ok).toBe(true)
    expect(libraryId).toBe('lib-new')
    expect(bookId).not.toBe('prev-book')
    expect(book.gallery).toEqual([])
    expect(dirty).toBe(false)
    expect(resetAutosave).toHaveBeenCalled()
    expect(emit).toHaveBeenCalled()

    const listed = await libNew.listBooks()
    expect(listed.ok).toBe(true)
    assert(listed.ok, 'expected list')
    expect(listed.value.some((entry) => entry.id === 'prev-book')).toBe(false)
  })

  it('open empty library never adopts foreign in-memory content', async () => {
    const emptyLib = createMemoryLibraryStorage()
    await emptyLib.updateLibrary({})
    book = makeBook({
      id: 'foreign',
      gallery: ['asset-x'],
      assets: {
        'asset-x': {
          sourceRootId: 'root-x',
          relativePath: 'x.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
    })
    const handle = createFakeBrowserDirectory({ name: 'EmptyLib' })
    storagesByHandle.set('EmptyLib', emptyLib)
    resolveIdByHandle.set('EmptyLib', 'lib-empty')
    pickDirectory = () => Promise.resolve(handle)

    const opened = await controller.openLibrary()
    expect(opened.ok).toBe(true)
    expect(book.gallery).toEqual([])
    expect(assetClears).toBeGreaterThan(0)
    expect(clearAssetSources).toHaveBeenCalled()
    const listed = await emptyLib.listBooks()
    expect(listed.ok).toBe(true)
    assert(listed.ok, 'expected list')
    expect(listed.value.some((entry) => entry.id === 'foreign')).toBe(false)
  })

  it('open empty library clears foreign frame-only content', async () => {
    const emptyLib = createMemoryLibraryStorage()
    await emptyLib.updateLibrary({})
    book = bookWithFrameAsset('foreign-frames', 'frame-asset')
    const handle = createFakeBrowserDirectory({ name: 'EmptyFrames' })
    storagesByHandle.set('EmptyFrames', emptyLib)
    resolveIdByHandle.set('EmptyFrames', 'lib-frames')
    pickDirectory = () => Promise.resolve(handle)

    const opened = await controller.openLibrary()
    expect(opened.ok).toBe(true)
    expect(book.gallery).toEqual([])
    expect(
      book.spreads.some((spread) =>
        spread.frames.some((frame) => frame.assetId !== undefined),
      ),
    ).toBe(false)
    expect(clearAssetSources).toHaveBeenCalled()
  })

  it('flush failure aborts createLibrary without releasing the open book', async () => {
    const lib = createMemoryLibraryStorage()
    storage = lib
    libraryId = 'lib-open'
    bookId = 'open-book'
    heldLocks.add('open-book')
    flushResult = failure('not-found')
    pickDirectory = () =>
      Promise.resolve(createFakeBrowserDirectory({ name: 'Ignored' }))

    const result = await controller.createLibrary()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(storage).toBe(lib)
    expect(libraryId).toBe('lib-open')
    expect(bookId).toBe('open-book')
    expect(heldLocks.has('open-book')).toBe(true)
    expect(releaseHeldBookLock).not.toHaveBeenCalled()
  })

  it('createLibrary when already clean skips releaseOpenBook side effects', async () => {
    const libNew = createMemoryLibraryStorage()
    const handleNew = createFakeBrowserDirectory({ name: 'CleanNew' })
    storagesByHandle.set('CleanNew', libNew)
    resolveIdByHandle.set('CleanNew', 'lib-clean')
    pickDirectory = () => Promise.resolve(handleNew)

    expect(storage).toBeNull()
    expect(bookId).toBeNull()
    book = makeBook({ id: 'session-book', gallery: [] })
    const created = await controller.createLibrary()
    expect(created.ok).toBe(true)
    expect(setActiveIds).not.toHaveBeenCalled()
    expect(setHomeError).toHaveBeenCalledWith(null)
    expect(bookId).toBe('session-book')
    expect(libraryId).toBe('lib-clean')
  })

  it('createLibrary still releases when storage is bound but bookId is null', async () => {
    const libOld = createMemoryLibraryStorage()
    await libOld.updateLibrary({})
    storage = libOld
    libraryId = 'lib-old'
    bookId = null
    const libNew = createMemoryLibraryStorage()
    const handleNew = createFakeBrowserDirectory({ name: 'ReleasePartial' })
    storagesByHandle.set('ReleasePartial', libNew)
    resolveIdByHandle.set('ReleasePartial', 'lib-new')
    pickDirectory = () => Promise.resolve(handleNew)

    const created = await controller.createLibrary()
    expect(created.ok).toBe(true)
    expect(setActiveIds).toHaveBeenCalledWith({ libraryId: null, bookId: null })
    expect(setStatus).toHaveBeenCalledWith({ kind: 'idle' })
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(setDirty).toHaveBeenCalledWith(false)
    expect(clearBlockedAndPending).toHaveBeenCalled()
    expect(releaseHeldBookLock).toHaveBeenCalled()
    expect(libraryId).toBe('lib-new')
  })

  it('createLibrary releases when storage is null but stale bookId remains', async () => {
    storage = null
    bookId = 'stale-book'
    libraryId = null
    const libNew = createMemoryLibraryStorage()
    const handleNew = createFakeBrowserDirectory({ name: 'StaleBookId' })
    storagesByHandle.set('StaleBookId', libNew)
    resolveIdByHandle.set('StaleBookId', 'lib-stale-clear')
    pickDirectory = () => Promise.resolve(handleNew)

    const created = await controller.createLibrary()
    expect(created.ok).toBe(true)
    expect(setActiveIds).toHaveBeenCalledWith({ libraryId: null, bookId: null })
    expect(setStatus).toHaveBeenCalledWith({ kind: 'idle' })
  })

  it('createLibrary updateLibrary failure sets homeError and status action', async () => {
    const lib = createMemoryLibraryStorage()
    lib.updateLibrary = () => Promise.resolve(failure('not-found'))
    const handle = createFakeBrowserDirectory({ name: 'CreateFail' })
    storagesByHandle.set('CreateFail', lib)
    pickDirectory = () => Promise.resolve(handle)

    const result = await controller.createLibrary()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBe('Could not create the library folder.')
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'create library',
    })
  })

  it('openLibrary getLibrary failure sets homeError and status action', async () => {
    const lib = createMemoryLibraryStorage()
    lib.getLibrary = () => Promise.resolve(failure('not-found'))
    const handle = createFakeBrowserDirectory({ name: 'OpenFail' })
    storagesByHandle.set('OpenFail', lib)
    pickDirectory = () => Promise.resolve(handle)

    const result = await controller.openLibrary()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBe('Could not open the library folder.')
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'open library',
    })
  })

  it('openLibrary flush failure aborts without binding', async () => {
    flushResult = failure('corrupted')
    pickDirectory = () =>
      Promise.resolve(createFakeBrowserDirectory({ name: 'FlushOpen' }))
    storagesByHandle.set('FlushOpen', createMemoryLibraryStorage())

    const result = await controller.openLibrary()
    expect(result).toEqual({ ok: false, code: 'corrupted' })
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
  })

  it('activateLoadedBook returns not-found when libraryId is missing', async () => {
    libraryId = null
    const result = await controller.activateLoadedBook(
      makeBook({ id: 'orphan', gallery: [] }),
    )
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(bookId).toBeNull()
    expect(resetAutosave).not.toHaveBeenCalled()
  })

  it('activateLoadedBook returns lock failure without mutating book state', async () => {
    libraryId = 'lib-lock'
    takeBookLockResult = failure('locked-elsewhere')
    const result = await controller.activateLoadedBook(
      makeBook({ id: 'locked-book', gallery: [] }),
    )
    expect(result).toEqual({ ok: false, code: 'locked-elsewhere' })
    expect(bookId).toBeNull()
    expect(persistIds).not.toHaveBeenCalled()
    expect(resetAutosave).not.toHaveBeenCalled()
  })

  it('activateLoadedBook success tracks resetAutosave and editor status', async () => {
    libraryId = 'lib-ok'
    dirty = true
    const next = makeBook({ id: 'activated', gallery: [] })
    const result = await controller.activateLoadedBook(next)
    expect(result).toEqual({ ok: true, value: next })
    expect(bookId).toBe('activated')
    expect(dirty).toBe(false)
    expect(persistIds).toHaveBeenCalled()
    expect(resetAutosave).toHaveBeenCalled()
    expect(surface).toBe('editor')
    expect(editorStatus).toBe('Book restored')
    expect(status).toEqual({
      kind: 'open',
      libraryId: 'lib-ok',
      bookId: 'activated',
    })
  })

  it('activateLoadedBook awaits onBookActivated when provided', async () => {
    libraryId = 'lib-ok'
    const onBookActivated = vi.fn().mockResolvedValue(undefined)
    host.onBookActivated = onBookActivated
    const next = makeBook({ id: 'with-photo-root', gallery: [] })
    await expect(controller.activateLoadedBook(next)).resolves.toEqual({
      ok: true,
      value: next,
    })
    expect(onBookActivated).toHaveBeenCalledTimes(1)
  })

  it('adoptCurrentBookInLibrary fails when storage is missing', async () => {
    storage = null
    libraryId = 'lib-only'
    const result = await controller.adoptCurrentBookInLibrary()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'adopt book',
    })
  })

  it('adoptCurrentBookInLibrary fails when libraryId is missing', async () => {
    storage = createMemoryLibraryStorage()
    libraryId = null
    const result = await controller.adoptCurrentBookInLibrary()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'adopt book',
    })
  })

  it('adoptCurrentBookInLibrary activates existing empty current book', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const existing = makeBook({ id: 'existing-empty', gallery: [] })
    expect((await lib.createBook(existing)).ok).toBe(true)
    storage = lib
    libraryId = 'lib-adopt'
    book = makeBook({ id: 'existing-empty', gallery: [] })

    const adopted = await controller.adoptCurrentBookInLibrary()
    expect(adopted.ok).toBe(true)
    assert(adopted.ok, 'expected adopt')
    expect(adopted.value.id).toBe('existing-empty')
    expect(bookId).toBe('existing-empty')
    expect(editorStatus).toBe('Book restored')
    expect(resetAutosave).toHaveBeenCalled()
  })

  it('adoptCurrentBookInLibrary keeps contentful current when existing and lock ok', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const existing = makeBook({
      id: 'contentful',
      gallery: ['g1'],
      assets: { g1: {} },
    })
    expect((await lib.createBook(existing)).ok).toBe(true)
    storage = lib
    libraryId = 'lib-adopt'
    book = makeBook({
      id: 'contentful',
      gallery: ['g1'],
      assets: { g1: {} },
    })

    const adopted = await controller.adoptCurrentBookInLibrary()
    expect(adopted).toEqual({ ok: true, value: existing })
    expect(bookId).toBe('contentful')
    expect(persistIds).toHaveBeenCalled()
    expect(status).toEqual({
      kind: 'open',
      libraryId: 'lib-adopt',
      bookId: 'contentful',
    })
    expect(editorStatus).toBeNull()
  })

  it('adoptCurrentBookInLibrary returns lock failure for contentful existing', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const existing = makeBook({
      id: 'contentful-lock',
      gallery: ['g1'],
      assets: { g1: {} },
    })
    expect((await lib.createBook(existing)).ok).toBe(true)
    storage = lib
    libraryId = 'lib-adopt'
    book = makeBook({
      id: 'contentful-lock',
      gallery: ['g1'],
      assets: { g1: {} },
    })
    takeBookLockResult = failure('locked-elsewhere')

    const adopted = await controller.adoptCurrentBookInLibrary()
    expect(adopted).toEqual({ ok: false, code: 'locked-elsewhere' })
    expect(bookId).toBeNull()
    expect(persistIds).not.toHaveBeenCalled()
  })

  it('adoptCurrentBookInLibrary createBook failure sets adopt status', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    lib.createBook = () => Promise.resolve(failure('not-found'))
    storage = lib
    libraryId = 'lib-adopt'
    book = makeBook({ id: 'missing-create', gallery: [] })

    const adopted = await controller.adoptCurrentBookInLibrary()
    expect(adopted).toEqual({ ok: false, code: 'not-found' })
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'adopt book',
    })
  })

  it('adoptCurrentBookInLibrary createBook lock failure returns code', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    storage = lib
    libraryId = 'lib-adopt'
    book = makeBook({ id: 'new-lock-fail', gallery: [] })
    takeBookLockResult = failure('locked-elsewhere')

    const adopted = await controller.adoptCurrentBookInLibrary()
    expect(adopted).toEqual({ ok: false, code: 'locked-elsewhere' })
    expect(bookId).toBeNull()
  })

  it('adoptCurrentBookInLibrary creates the in-memory book when missing', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    storage = lib
    libraryId = 'lib-adopt'
    book = makeBook({ id: 'new-adopt', gallery: [] })

    const adopted = await controller.adoptCurrentBookInLibrary()
    expect(adopted.ok).toBe(true)
    assert(adopted.ok, 'expected adopt')
    expect(adopted.value.id).toBe('new-adopt')
    expect(bookId).toBe('new-adopt')
    expect(editorStatus).toBe('Book created in library')
    expect(status).toEqual({
      kind: 'open',
      libraryId: 'lib-adopt',
      bookId: 'new-adopt',
    })
    const loaded = await lib.loadBook('new-adopt')
    expect(loaded.ok).toBe(true)
  })

  it('bindLibrary remember failure rolls back storage and lock', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    host = buildHost()
    host.rememberLibraryHandle = () => Promise.resolve(failure('not-found'))
    controller.setHost(host)

    const bound = await controller.bindLibrary(
      'lib-fail',
      createFakeBrowserDirectory({ name: 'Fail' }),
      lib,
      'adopt',
    )
    expect(bound.ok).toBe(false)
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
    expect(surface).toBe('home')
    expect(homeError).toBe('Could not remember this library. Try again.')
    expect(setHomeError).toHaveBeenCalledWith(
      'Could not remember this library. Try again.',
    )
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'open library',
    })
    expect(setStatus).toHaveBeenCalledWith({
      kind: 'error',
      code: 'not-found',
      action: 'open library',
    })
    expect(heldLocks.size).toBe(0)
    expect(clearAssetSources).toHaveBeenCalled()
    expect(resetAutosave).toHaveBeenCalled()
    expect(emit).toHaveBeenCalled()
    expect(setDirty).toHaveBeenCalledWith(false)
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(clearBlockedAndPending).toHaveBeenCalled()
    expect(setSurface).toHaveBeenCalledWith('home')
    expect(book.id).toBe('empty-book-id')
  })

  it('bindLibrary activation failure rolls back and emits', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    lib.createBook = () => Promise.resolve(failure('not-found'))
    book = makeBook({ id: 'will-fail', gallery: [] })

    const bound = await controller.bindLibrary(
      'lib-act-fail',
      createFakeBrowserDirectory({ name: 'ActFail' }),
      lib,
      'adopt',
    )
    expect(bound).toEqual({ ok: false, code: 'not-found' })
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'open library',
    })
    expect(emit).toHaveBeenCalled()
  })

  it('bindLibrary open mode fails when storage disappears before list', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    host = buildHost()
    host.withoutDirtyTrackingAsync = async (fn) => {
      storage = null
      return fn()
    }
    controller.setHost(host)

    const bound = await controller.bindLibrary(
      'lib-gone',
      createFakeBrowserDirectory({ name: 'Gone' }),
      lib,
      'open',
    )
    expect(bound).toEqual({ ok: false, code: 'not-found' })
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'open library',
    })
    expect(emit).toHaveBeenCalled()
  })

  it('bindLibrary open mode listBooks failure sets open library status', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    lib.listBooks = () => Promise.resolve(failure('corrupted'))

    const bound = await controller.bindLibrary(
      'lib-list-fail',
      createFakeBrowserDirectory({ name: 'ListFail' }),
      lib,
      'open',
    )
    expect(bound).toEqual({ ok: false, code: 'corrupted' })
    expect(setStatus).toHaveBeenCalledWith({
      kind: 'error',
      code: 'corrupted',
      action: 'open library',
    })
    expect(status).toEqual({
      kind: 'error',
      code: 'corrupted',
      action: 'open library',
    })
    expect(emit).toHaveBeenCalled()
  })

  it('bindLibrary defaults to adopt mode when mode is omitted', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    book = makeBook({ id: 'default-adopt', gallery: [] })

    const bound = await controller.bindLibrary(
      'lib-default-mode',
      createFakeBrowserDirectory({ name: 'DefaultMode' }),
      lib,
    )
    expect(bound.ok).toBe(true)
    expect(bookId).toBe('default-adopt')
    expect(editorStatus).toBe('Book created in library')
    expect(setStatus).toHaveBeenCalledWith({
      kind: 'open',
      libraryId: 'lib-default-mode',
      bookId: null,
    })
    expect(setBookId).toHaveBeenCalledWith(null)
    expect(persistIds).toHaveBeenCalled()
  })

  it('bindLibrary open prefers current contentful id over earlier contentful', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const other = makeBook({
      id: 'other-filled',
      gallery: ['g1'],
      assets: { g1: {} },
    })
    const current = makeBook({
      id: 'current-filled',
      gallery: ['g2'],
      assets: { g2: {} },
    })
    expect((await lib.createBook(other)).ok).toBe(true)
    expect((await lib.createBook(current)).ok).toBe(true)
    book = makeBook({
      id: 'current-filled',
      gallery: ['g2'],
      assets: { g2: {} },
    })

    const bound = await controller.bindLibrary(
      'lib-current-prefer',
      createFakeBrowserDirectory({ name: 'CurrentPrefer' }),
      lib,
      'open',
    )
    expect(bound.ok).toBe(true)
    expect(bookId).toBe('current-filled')
    expect(book.id).toBe('current-filled')
  })

  it('bindLibrary open empty library leaves empty session book untouched', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    book = makeBook({ id: 'already-empty', gallery: [] })

    const bound = await controller.bindLibrary(
      'lib-empty-keep',
      createFakeBrowserDirectory({ name: 'EmptyKeep' }),
      lib,
      'open',
    )
    expect(bound.ok).toBe(true)
    expect(clearAssetSources).not.toHaveBeenCalled()
    expect(book.id).toBe('already-empty')
    expect(bookId).toBe('already-empty')
  })

  it('bindLibrary success does not clear non-permission access phase', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    accessPhase = 'locked-elsewhere'
    book = makeBook({ id: 'keep-phase', gallery: [] })

    const bound = await controller.bindLibrary(
      'lib-keep-phase',
      createFakeBrowserDirectory({ name: 'KeepPhase' }),
      lib,
      'adopt',
    )
    expect(bound.ok).toBe(true)
    expect(accessPhase).toBe('locked-elsewhere')
    expect(setAccessPhase).not.toHaveBeenCalled()
  })

  it('bindLibrary open mode pickAndActivate failure propagates', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    expect(
      (await lib.createBook(makeBook({ id: 'pick-lock', gallery: [] }))).ok,
    ).toBe(true)
    takeBookLockResult = failure('locked-elsewhere')

    const bound = await controller.bindLibrary(
      'lib-pick-fail',
      createFakeBrowserDirectory({ name: 'PickFail' }),
      lib,
      'open',
    )
    expect(bound).toEqual({ ok: false, code: 'locked-elsewhere' })
    expect(storage).toBeNull()
    expect(emit).toHaveBeenCalled()
  })

  it('bindLibrary open empty library adopt failure after clearing foreign content', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    lib.createBook = () => Promise.resolve(failure('not-found'))
    book = makeBook({
      id: 'foreign-clear',
      gallery: ['asset-x'],
      assets: { 'asset-x': {} },
    })

    const bound = await controller.bindLibrary(
      'lib-empty-fail',
      createFakeBrowserDirectory({ name: 'EmptyFail' }),
      lib,
      'open',
    )
    expect(bound).toEqual({ ok: false, code: 'not-found' })
    expect(clearAssetSources).toHaveBeenCalled()
    expect(book.id).toBe('empty-book-id')
    expect(emit).toHaveBeenCalled()
  })

  it('bindLibrary open prefers contentful book and matches current id', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const empty = makeBook({ id: 'empty-one', gallery: [] })
    const contentful = makeBook({
      id: 'match-me',
      gallery: ['g1'],
      assets: { g1: {} },
    })
    expect((await lib.createBook(empty)).ok).toBe(true)
    expect((await lib.createBook(contentful)).ok).toBe(true)
    book = makeBook({
      id: 'match-me',
      gallery: ['g1'],
      assets: { g1: {} },
    })

    const bound = await controller.bindLibrary(
      'lib-match',
      createFakeBrowserDirectory({ name: 'Match' }),
      lib,
      'open',
    )
    expect(bound.ok).toBe(true)
    expect(bookId).toBe('match-me')
    expect(editorStatus).toBe('Book restored')
    expect(resetAutosave).toHaveBeenCalled()
    expect(emit).toHaveBeenCalled()
    expect(surface).toBe('editor')
  })

  it('bindLibrary open skips failed loads and prefers first contentful', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const empty = makeBook({ id: 'empty-first', gallery: [] })
    const contentful = makeBook({
      id: 'with-content',
      gallery: ['g1'],
      assets: { g1: {} },
    })
    expect((await lib.createBook(empty)).ok).toBe(true)
    expect((await lib.createBook(contentful)).ok).toBe(true)
    const realLoad = lib.loadBook.bind(lib)
    lib.loadBook = async (id) => {
      if (id === 'empty-first') {
        return failure('not-found')
      }
      return realLoad(id)
    }
    book = makeBook({ id: 'other-session', gallery: [] })

    const bound = await controller.bindLibrary(
      'lib-skip',
      createFakeBrowserDirectory({ name: 'Skip' }),
      lib,
      'open',
    )
    expect(bound.ok).toBe(true)
    expect(bookId).toBe('with-content')
  })

  it('bindLibrary open adopts when all listed books fail to load', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    expect(
      (await lib.createBook(makeBook({ id: 'ghost', gallery: [] }))).ok,
    ).toBe(true)
    lib.loadBook = () => Promise.resolve(failure('not-found'))
    book = makeBook({ id: 'session-adopt', gallery: [] })

    const bound = await controller.bindLibrary(
      'lib-all-fail',
      createFakeBrowserDirectory({ name: 'AllFail' }),
      lib,
      'open',
    )
    expect(bound.ok).toBe(true)
    expect(bookId).toBe('session-adopt')
    expect(editorStatus).toBe('Book created in library')
  })

  it('bindLibrary open prefers contentful over empty when current id differs', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const empty = makeBook({ id: 'empty-a', gallery: [] })
    const contentful = makeBook({
      id: 'content-b',
      gallery: ['g1'],
      assets: { g1: {} },
    })
    expect((await lib.createBook(empty)).ok).toBe(true)
    expect((await lib.createBook(contentful)).ok).toBe(true)
    book = makeBook({ id: 'session-other', gallery: [] })

    const bound = await controller.bindLibrary(
      'lib-prefer',
      createFakeBrowserDirectory({ name: 'Prefer' }),
      lib,
      'open',
    )
    expect(bound.ok).toBe(true)
    expect(bookId).toBe('content-b')
  })

  it('bindLibrary open pickAndActivate fails when storage cleared after list', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    expect(
      (await lib.createBook(makeBook({ id: 'listed', gallery: [] }))).ok,
    ).toBe(true)
    const realList = lib.listBooks.bind(lib)
    lib.listBooks = async () => {
      const listed = await realList()
      storage = null
      return listed
    }

    const bound = await controller.bindLibrary(
      'lib-pick-storage',
      createFakeBrowserDirectory({ name: 'PickStorage' }),
      lib,
      'open',
    )
    expect(bound).toEqual({ ok: false, code: 'not-found' })
    expect(emit).toHaveBeenCalled()
  })

  it('bindLibrary clears permission-required phase on success', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    accessPhase = 'permission-required'
    book = makeBook({ id: 'after-perm', gallery: [] })

    const bound = await controller.bindLibrary(
      'lib-perm-clear',
      createFakeBrowserDirectory({ name: 'PermClear' }),
      lib,
      'adopt',
    )
    expect(bound.ok).toBe(true)
    expect(accessPhase).toBe('idle')
    expect(emit).toHaveBeenCalled()
    expect(resetAutosave).toHaveBeenCalled()
    expect(surface).toBe('editor')
  })

  it('selectRecentLibrary catch returns not-found', async () => {
    recallThrows.add('boom-lib')
    const result = await controller.selectRecentLibrary('boom-lib')
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBeNull()
  })

  it('selectRecentLibrary non-permission recall sets homeError', async () => {
    recallResults.set('missing-lib', failure('not-found'))
    const result = await controller.selectRecentLibrary('missing-lib')
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBe('Could not open that recent library.')
    expect(accessPhase).toBe('idle')
  })

  it('selectRecentLibrary listBooks failure sets list books status', async () => {
    const lib = createMemoryLibraryStorage()
    lib.listBooks = () => Promise.resolve(failure('not-found'))
    const handle = createFakeBrowserDirectory({ name: 'RecentList' })
    storagesByHandle.set('RecentList', lib)
    remembered.set('recent-list', handle)

    const result = await controller.selectRecentLibrary('recent-list')
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBe('Could not list books.')
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'list books',
    })
  })

  it('selectRecentLibrary clears permission-required phase and emits', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const handle = createFakeBrowserDirectory({ name: 'RecentOk' })
    storagesByHandle.set('RecentOk', lib)
    remembered.set('recent-ok', handle)
    accessPhase = 'permission-required'

    const result = await controller.selectRecentLibrary('recent-ok')
    expect(result.ok).toBe(true)
    expect(accessPhase).toBe('idle')
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(emit).toHaveBeenCalled()
  })

  it('selectRecentLibrary does not clear locked-elsewhere phase', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const handle = createFakeBrowserDirectory({ name: 'RecentLocked' })
    storagesByHandle.set('RecentLocked', lib)
    remembered.set('recent-locked', handle)
    accessPhase = 'locked-elsewhere'

    const result = await controller.selectRecentLibrary('recent-locked')
    expect(result.ok).toBe(true)
    expect(accessPhase).toBe('locked-elsewhere')
    expect(setAccessPhase).not.toHaveBeenCalled()
  })

  it('openBookFromHome activates the requested book', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const target = makeBook({ id: 'home-book', gallery: [] })
    expect((await lib.createBook(target)).ok).toBe(true)
    const handle = createFakeBrowserDirectory({ name: 'HomeLib' })
    storagesByHandle.set('HomeLib', lib)
    remembered.set('lib-home', handle)

    const opened = await controller.openBookFromHome('lib-home', 'home-book')
    expect(opened.ok).toBe(true)
    assert(opened.ok, 'expected open')
    expect(opened.value.id).toBe('home-book')
    expect(libraryId).toBe('lib-home')
    expect(bookId).toBe('home-book')
    expect(surface).toBe('editor')
    expect(homeError).toBeNull()
    expect(emit).toHaveBeenCalled()
    expect(resetAutosave).toHaveBeenCalled()
  })

  it('openBookFromHome catch returns not-found', async () => {
    recallThrows.add('lib-throw')
    const result = await controller.openBookFromHome('lib-throw', 'book-x')
    expect(result).toEqual({ ok: false, code: 'not-found' })
  })

  it('openBookFromHome permission denied sets pending regrant for book', async () => {
    recallResults.set('lib-perm', failure('permission-required'))
    const result = await controller.openBookFromHome('lib-perm', 'book-perm')
    expect(result).toEqual({ ok: false, code: 'permission-required' })
    expect(setPendingRegrant).toHaveBeenCalledWith('lib-perm', 'book-perm')
    expect(status).toEqual({
      kind: 'error',
      code: 'permission-required',
      action: 'open book',
    })
    expect(accessPhase).toBe('permission-required')
  })

  it('openBookFromHome non-permission recall sets homeError', async () => {
    recallResults.set('lib-miss', failure('not-found'))
    const result = await controller.openBookFromHome('lib-miss', 'book-miss')
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBe('Could not open that book.')
  })

  it('openBookFromHome load failure rolls back to home', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const handle = createFakeBrowserDirectory({ name: 'HomeLoadFail' })
    storagesByHandle.set('HomeLoadFail', lib)
    remembered.set('lib-load-fail', handle)
    accessPhase = 'permission-required'

    const result = await controller.openBookFromHome('lib-load-fail', 'missing')
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
    expect(surface).toBe('home')
    expect(homeError).toBe('Could not open that book.')
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'open book',
    })
    expect(setStatus).toHaveBeenCalledWith({
      kind: 'error',
      code: 'not-found',
      action: 'open book',
    })
    expect(accessPhase).toBe('idle')
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(clearBlockedAndPending).toHaveBeenCalled()
    expect(setSurface).toHaveBeenCalledWith('home')
    expect(emit).toHaveBeenCalled()
    expect(persistIds).toHaveBeenCalled()
    expect(setLibraryId).toHaveBeenCalledWith(null)
    expect(setBookId).toHaveBeenCalledWith(null)
  })

  it('openBookFromHome activate failure rolls back and clears assets', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    expect(
      (await lib.createBook(makeBook({ id: 'lock-fail-book', gallery: [] })))
        .ok,
    ).toBe(true)
    const handle = createFakeBrowserDirectory({ name: 'HomeActFail' })
    storagesByHandle.set('HomeActFail', lib)
    remembered.set('lib-act-fail', handle)
    takeBookLockResult = failure('locked-elsewhere')

    const result = await controller.openBookFromHome(
      'lib-act-fail',
      'lock-fail-book',
    )
    expect(result).toEqual({ ok: false, code: 'locked-elsewhere' })
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
    expect(surface).toBe('home')
    expect(homeError).toBe('Could not open that book.')
    expect(editorStatus).toBe('')
    expect(clearAssetSources).toHaveBeenCalled()
    expect(emit).toHaveBeenCalled()
    expect(book.id).toBe('empty-book-id')
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(clearBlockedAndPending).toHaveBeenCalled()
    expect(persistIds).toHaveBeenCalled()
    expect(setLibraryId).toHaveBeenCalledWith(null)
    expect(setBookId).toHaveBeenCalledWith(null)
  })

  it('openBookFromHome remember failure rolls back lock and autosave', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    expect(
      (await lib.createBook(makeBook({ id: 'rem-fail-book', gallery: [] }))).ok,
    ).toBe(true)
    const handle = createFakeBrowserDirectory({ name: 'HomeRemFail' })
    storagesByHandle.set('HomeRemFail', lib)
    remembered.set('lib-rem-fail', handle)
    host = buildHost()
    host.rememberLibraryHandle = () => Promise.resolve(failure('not-found'))
    controller.setHost(host)

    const result = await controller.openBookFromHome(
      'lib-rem-fail',
      'rem-fail-book',
    )
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
    expect(surface).toBe('home')
    expect(homeError).toBe('Could not remember this library. Try again.')
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'open book',
    })
    expect(setStatus).toHaveBeenCalledWith({
      kind: 'error',
      code: 'not-found',
      action: 'open book',
    })
    expect(clearAssetSources).toHaveBeenCalled()
    expect(resetAutosave).toHaveBeenCalled()
    expect(emit).toHaveBeenCalled()
    expect(setDirty).toHaveBeenCalledWith(false)
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(clearBlockedAndPending).toHaveBeenCalled()
    expect(setSurface).toHaveBeenCalledWith('home')
    expect(book.id).toBe('empty-book-id')
    expect(heldLocks.size).toBe(0)
  })

  it('openBookFromHome clears permission-required before load', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    expect(
      (await lib.createBook(makeBook({ id: 'perm-clear-book', gallery: [] })))
        .ok,
    ).toBe(true)
    const handle = createFakeBrowserDirectory({ name: 'HomePermClear' })
    storagesByHandle.set('HomePermClear', lib)
    remembered.set('lib-home-perm', handle)
    accessPhase = 'permission-required'

    const opened = await controller.openBookFromHome(
      'lib-home-perm',
      'perm-clear-book',
    )
    expect(opened.ok).toBe(true)
    expect(accessPhase).toBe('idle')
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(setStatus).toHaveBeenCalledWith({
      kind: 'open',
      libraryId: 'lib-home-perm',
      bookId: null,
    })
    expect(setHomeError).toHaveBeenCalledWith(null)
  })

  it('openBookFromHome does not clear locked-elsewhere before load', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    expect(
      (await lib.createBook(makeBook({ id: 'keep-lock-book', gallery: [] })))
        .ok,
    ).toBe(true)
    const handle = createFakeBrowserDirectory({ name: 'HomeKeepLock' })
    storagesByHandle.set('HomeKeepLock', lib)
    remembered.set('lib-home-keep', handle)
    accessPhase = 'locked-elsewhere'

    const opened = await controller.openBookFromHome(
      'lib-home-keep',
      'keep-lock-book',
    )
    expect(opened.ok).toBe(true)
    expect(accessPhase).toBe('locked-elsewhere')
  })

  it('tryRestore loads the persisted book when recall succeeds', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const restored = makeBook({ id: 'restored-book', gallery: [] })
    expect((await lib.createBook(restored)).ok).toBe(true)
    const handle = createFakeBrowserDirectory({ name: 'RestoreLib' })
    storagesByHandle.set('RestoreLib', lib)
    remembered.set('lib-restore', handle)
    persisted = { libraryId: 'lib-restore', bookId: 'restored-book' }
    activeIds = { libraryId: 'lib-restore', bookId: 'restored-book' }

    const result = await controller.tryRestore()
    expect(result.ok).toBe(true)
    assert(result.ok, 'expected restore')
    expect(result.value?.id).toBe('restored-book')
    expect(bookId).toBe('restored-book')
    expect(surface).toBe('editor')
    expect(restorePending).toBe(false)
    expect(preferredLibraryId).toBe('lib-restore')
    expect(cancelAutosave).toHaveBeenCalled()
    expect(resetAutosave).toHaveBeenCalled()
    expect(emit).toHaveBeenCalled()
  })

  it('tryRestore with no bookId stays on home', async () => {
    persisted = { libraryId: 'lib-x', bookId: null }
    const result = await controller.tryRestore()
    expect(result).toEqual({ ok: true, value: null })
    expect(surface).toBe('home')
    expect(accessPhase).toBe('idle')
    expect(cancelAutosave).toHaveBeenCalled()
    expect(setSurface).toHaveBeenCalledWith('home')
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(setRestorePending).toHaveBeenCalledWith(true)
    expect(setRestorePending).toHaveBeenCalledWith(false)
    expect(emit).toHaveBeenCalled()
    expect(restorePending).toBe(false)
  })

  it('tryRestore recall throw clears stale state', async () => {
    persisted = { libraryId: 'lib-throw', bookId: 'book-throw' }
    recallThrows.add('lib-throw')
    const result = await controller.tryRestore()
    expect(result).toEqual({ ok: true, value: null })
    expect(surface).toBe('home')
    expect(storage).toBeNull()
    expect(libraryId).toBeNull()
    expect(bookId).toBeNull()
    expect(persisted).toEqual({ libraryId: null, bookId: null })
    expect(clearPersistedIdKeys).toHaveBeenCalled()
    expect(setActiveIds).toHaveBeenCalledWith({ libraryId: null, bookId: null })
    expect(setDirty).toHaveBeenCalledWith(false)
    expect(setAccessPhase).toHaveBeenCalledWith('idle')
    expect(clearBlockedAndPending).toHaveBeenCalled()
    expect(setStatus).toHaveBeenCalledWith({ kind: 'idle' })
    expect(setSurface).toHaveBeenCalledWith('home')
    expect(emit).toHaveBeenCalled()
    expect(resetAutosave).toHaveBeenCalled()
  })

  it('tryRestore non-permission recall failure clears stale state', async () => {
    persisted = { libraryId: 'lib-gone', bookId: 'book-gone' }
    recallResults.set('lib-gone', failure('not-found'))
    const result = await controller.tryRestore()
    expect(result).toEqual({ ok: true, value: null })
    expect(surface).toBe('home')
    expect(storage).toBeNull()
    expect(clearPersistedIdKeys).toHaveBeenCalled()
    expect(setActiveIds).toHaveBeenCalledWith({ libraryId: null, bookId: null })
    expect(setStatus).toHaveBeenCalledWith({ kind: 'idle' })
    expect(emit).toHaveBeenCalled()
  })

  it('tryRestore load failure sets restore book status', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const handle = createFakeBrowserDirectory({ name: 'RestoreLoad' })
    storagesByHandle.set('RestoreLoad', lib)
    remembered.set('lib-restore-load', handle)
    persisted = { libraryId: 'lib-restore-load', bookId: 'missing-book' }

    const result = await controller.tryRestore()
    expect(result).toEqual({ ok: false, code: 'not-found' })
    expect(homeError).toBe('Could not restore the previous book.')
    expect(status).toEqual({
      kind: 'error',
      code: 'not-found',
      action: 'restore book',
    })
    expect(setStatus).toHaveBeenCalledWith({
      kind: 'error',
      code: 'not-found',
      action: 'restore book',
    })
    expect(setSurface).toHaveBeenCalledWith('editor')
    expect(setSurface).toHaveBeenCalledWith('home')
    expect(surface).toBe('home')
    expect(storage).toBeNull()
  })

  it('tryRestore permission path clears book ids without preferred catch body', async () => {
    persisted = { libraryId: 'lib-r2', bookId: 'book-r2' }
    recallResults.set('lib-r2', failure('permission-required'))
    const result = await controller.tryRestore()
    expect(result).toEqual({ ok: true, value: null })
    expect(setLibraryId).toHaveBeenCalledWith(null)
    expect(setBookId).toHaveBeenCalledWith(null)
    expect(setDirty).toHaveBeenCalledWith(false)
    expect(resetAutosave).toHaveBeenCalled()
    expect(setSurface).toHaveBeenCalledWith('home')
    expect(setStatus).toHaveBeenCalledWith({
      kind: 'error',
      code: 'permission-required',
      action: 'restore library',
    })
  })

  it('tryRestore uses defaultLibraryId when persisted libraryId is null', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const restored = makeBook({ id: 'default-book', gallery: [] })
    expect((await lib.createBook(restored)).ok).toBe(true)
    const handle = createFakeBrowserDirectory({ name: 'DefaultLib' })
    storagesByHandle.set('DefaultLib', lib)
    remembered.set('library', handle)
    persisted = { libraryId: null, bookId: 'default-book' }
    activeIds = { libraryId: 'library', bookId: 'default-book' }

    const result = await controller.tryRestore()
    expect(result.ok).toBe(true)
    assert(result.ok, 'expected restore')
    expect(result.value?.id).toBe('default-book')
    expect(libraryId).toBe('library')
  })

  it('tryRestore preferredLibraryId catch sets null', async () => {
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const restored = makeBook({ id: 'pref-book', gallery: [] })
    expect((await lib.createBook(restored)).ok).toBe(true)
    const handle = createFakeBrowserDirectory({ name: 'PrefLib' })
    storagesByHandle.set('PrefLib', lib)
    remembered.set('lib-pref', handle)
    persisted = { libraryId: 'lib-pref', bookId: 'pref-book' }
    getActiveIdsImpl = () => Promise.reject(new Error('active ids boom'))

    const result = await controller.tryRestore()
    expect(result.ok).toBe(true)
    expect(preferredLibraryId).toBeNull()
    expect(restorePending).toBe(false)
    expect(emit).toHaveBeenCalled()
  })

  it('busy skip returns not-found for createLibrary', async () => {
    host = buildHost()
    host.withActionBusy = () => Promise.resolve(undefined)
    controller.setHost(host)
    pickDirectory = () =>
      Promise.resolve(createFakeBrowserDirectory({ name: 'Busy' }))
    await expect(controller.createLibrary()).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('busy skip returns not-found for openLibrary and selectRecentLibrary', async () => {
    host = buildHost()
    host.withActionBusy = () => Promise.resolve(undefined)
    controller.setHost(host)
    await expect(controller.openLibrary()).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(controller.selectRecentLibrary('x')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('busy skip returns not-found for openBookFromHome and null for tryRestore', async () => {
    host = buildHost()
    host.withActionBusy = () => Promise.resolve(undefined)
    controller.setHost(host)
    await expect(controller.openBookFromHome('a', 'b')).resolves.toEqual({
      ok: false,
      code: 'not-found',
    })
    await expect(controller.tryRestore()).resolves.toEqual({
      ok: true,
      value: null,
    })
  })

  it('uses memory session helpers without browser globals', async () => {
    const session = createMemorySessionState()
    const lib = createMemoryLibraryStorage()
    await lib.updateLibrary({})
    const handle = { name: 'MemLib' } as SessionDirectoryHandle
    await session.rememberLibraryHandle('mem', handle, 'MemLib')
    storagesByHandle.set('MemLib', lib)
    remembered.set('mem', handle)
    pickDirectory = () => Promise.resolve(handle as FileSystemDirectoryHandle)
    resolveIdByHandle.set('MemLib', 'mem')

    const opened = await controller.openLibrary()
    expect(opened.ok).toBe(true)
    expect(libraryId).toBe('mem')
    expect(vi.isFakeTimers()).toBe(false)
  })
})
