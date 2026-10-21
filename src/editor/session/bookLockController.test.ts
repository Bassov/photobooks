import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Book } from '../../core'
import { makeBook } from '../../core/testing/fixtures'
import { createFakeBrowserDirectory } from '../../project/fsa/browserDirectory.test-helpers'
import type {
  BookLock,
  LibraryStorage,
  SessionDirectoryHandle,
  StorageFailureCode,
  StorageResult,
} from '../../project'
import {
  createBookLockController,
  LOCK_BANNER_MESSAGE,
  type BookLockController,
  type BookLockControllerHost,
} from './bookLockController'
import type { SavePhase } from './autosaveController'

function success<T>(value: T): StorageResult<T> {
  return { ok: true, value }
}

function failure(code: StorageFailureCode): StorageResult<never> {
  return { ok: false, code }
}

function createLockTable(): {
  acquireBookLock: (bookId: string) => Promise<StorageResult<BookLock>>
  held: Set<string>
} {
  const held = new Set<string>()
  return {
    held,
    acquireBookLock(bookId) {
      if (held.has(bookId)) {
        return Promise.resolve(failure('locked-elsewhere'))
      }
      held.add(bookId)
      const lock: BookLock = {
        release() {
          held.delete(bookId)
          return Promise.resolve()
        },
      }
      return Promise.resolve(success(lock))
    },
  }
}

describe('createBookLockController', () => {
  let locks: ReturnType<typeof createLockTable>
  let savePhase: SavePhase
  let saveEpoch: number
  let autosaveCancel: ReturnType<typeof vi.fn<() => void>>
  let autosaveReset: ReturnType<typeof vi.fn<() => void>>
  let clearDoc: ReturnType<typeof vi.fn<() => void>>
  let accessPhase: 'idle' | 'permission-required' | 'locked-elsewhere'
  let bookId: string | null
  let libraryId: string | null
  let storage: LibraryStorage | null
  let editorStatus: string | null
  let homeError: string | null
  let statusErrors: { code: StorageFailureCode; action: string }[]
  let emitCount: number
  let persistCount: number
  let runSaveCount: number
  let pickDirectory: () => Promise<FileSystemDirectoryHandle | null>
  let requestReadwritePermission: BookLockControllerHost['requestReadwritePermission']
  let peekedHandles: Map<string, SessionDirectoryHandle>
  let rememberResult: StorageResult<void>
  let bindResult: StorageResult<void>
  let libraryMeta: StorageResult<{ id: string }>
  let activateResult: StorageResult<Book>
  let loadedBooks: Map<string, Book>
  let sameEntry: boolean
  let busyResult: 'run' | 'skip'
  let resolveLibraryId: string
  let persisted: { libraryId: string | null; bookId: string | null }
  let boundCalls: {
    id: string
    mode: 'adopt' | 'open'
  }[]
  let emitHomeError: string | null | undefined
  let controller: BookLockController
  let host: BookLockControllerHost

  function fakeStorage(): LibraryStorage {
    return {
      getLibrary: () => Promise.resolve(libraryMeta),
      loadBook: (id: string) => {
        const book = loadedBooks.get(id)
        if (!book) {
          return Promise.resolve(failure('not-found'))
        }
        return Promise.resolve(success(book))
      },
    } as unknown as LibraryStorage
  }

  function buildHost(): BookLockControllerHost {
    return {
      cancelAutosave: () => {
        autosaveCancel()
      },
      resetAutosave: () => {
        autosaveReset()
      },
      getSavePhase: () => savePhase,
      bumpSaveEpoch: () => {
        saveEpoch += 1
      },
      clearLockedPlaceholderDocument: () => {
        clearDoc()
      },
      setAccessPhase: (phase) => {
        accessPhase = phase
      },
      setBookId: (id) => {
        bookId = id
      },
      getBookId: () => bookId,
      persistIds: () => {
        persistCount += 1
      },
      setEditorStatus: (message) => {
        editorStatus = message
      },
      emit: () => {
        emitCount += 1
      },
      getStorage: () => storage,
      setStorage: (next) => {
        storage = next
      },
      getLibraryId: () => libraryId,
      setLibraryId: (id) => {
        libraryId = id
      },
      setHomeError: (message) => {
        homeError = message
        emitHomeError = message
      },
      setStatusError: (code, action) => {
        statusErrors.push({ code, action })
      },
      runSave: () => {
        runSaveCount += 1
      },
      createStorageFromHandle: () => fakeStorage(),
      rememberLibraryHandle: () => Promise.resolve(rememberResult),
      peekLibraryHandle: (id) => {
        const handle = peekedHandles.get(id)
        if (!handle) {
          return Promise.resolve(failure('not-found'))
        }
        return Promise.resolve(success(handle))
      },
      handlesReferToSameDirectory: () => Promise.resolve(sameEntry),
      handleDisplayLabel: () => 'label',
      bindLibrary: (id, _h, nextStorage, mode) => {
        boundCalls.push({ id, mode })
        if (bindResult.ok) {
          storage = nextStorage
        }
        return Promise.resolve(bindResult)
      },
      resolveLibraryIdForHandle: () => Promise.resolve(resolveLibraryId),
      readPersistedIds: () => persisted,
      activateLoadedBook: () => Promise.resolve(activateResult),
      withActionBusy: async (task) => {
        if (busyResult === 'skip') {
          return undefined
        }
        return task()
      },
      humanMessageForCode: (code, fallback) => `${code}:${fallback}`,
      acquireBookLock: (id) => locks.acquireBookLock(id),
      pickDirectory: () => pickDirectory(),
      requestReadwritePermission: (handle) =>
        requestReadwritePermission(handle),
    }
  }

  beforeEach(() => {
    locks = createLockTable()
    savePhase = 'idle'
    saveEpoch = 0
    autosaveCancel = vi.fn<() => void>()
    autosaveReset = vi.fn<() => void>()
    clearDoc = vi.fn<() => void>()
    accessPhase = 'idle'
    bookId = null
    libraryId = null
    storage = null
    editorStatus = null
    homeError = null
    statusErrors = []
    emitCount = 0
    persistCount = 0
    runSaveCount = 0
    pickDirectory = () => Promise.resolve(null)
    requestReadwritePermission = () => Promise.resolve('unavailable')
    peekedHandles = new Map()
    rememberResult = success(undefined)
    bindResult = success(undefined)
    libraryMeta = success({ id: 'lib' })
    activateResult = success(makeBook({ id: 'book-1' }))
    loadedBooks = new Map()
    sameEntry = true
    busyResult = 'run'
    resolveLibraryId = 'resolved-lib'
    persisted = { libraryId: null, bookId: null }
    boundCalls = []
    emitHomeError = undefined
    host = buildHost()
    controller = createBookLockController(host)
  })

  it('acquires a book lock and clears blocked state', async () => {
    const taken = await controller.takeBookLock('book-a')

    expect(taken).toEqual(success(undefined))
    expect(controller.hasHeldBookLock()).toBe(true)
    expect(controller.getBlockedBookId()).toBeNull()
    expect(accessPhase).toBe('idle')
    expect(locks.held.has('book-a')).toBe(true)
  })

  it('reports locked-elsewhere when a second holder takes the same book', async () => {
    const first = await controller.takeBookLock('book-shared')
    expect(first.ok).toBe(true)

    const other = createBookLockController(buildHost())
    const second = await other.takeBookLock('book-shared')

    expect(second).toEqual(failure('locked-elsewhere'))
    expect(other.getBlockedBookId()).toBe('book-shared')
    expect(accessPhase).toBe('locked-elsewhere')
    expect(bookId).toBeNull()
    expect(persistCount).toBe(1)
    expect(clearDoc).toHaveBeenCalledOnce()
    expect(autosaveReset).toHaveBeenCalled()
    expect(editorStatus).toBe(LOCK_BANNER_MESSAGE)
    expect(emitCount).toBeGreaterThan(0)
  })

  it('propagates non-lock acquire failures without locked-elsewhere chrome', async () => {
    host.acquireBookLock = () => Promise.resolve(failure('permission-required'))
    controller.setHost(host)

    const result = await controller.takeBookLock('book-perm')

    expect(result).toEqual(failure('permission-required'))
    expect(controller.getBlockedBookId()).toBeNull()
    expect(accessPhase).toBe('idle')
    expect(clearDoc).not.toHaveBeenCalled()
  })

  it('releases the held lock so another controller can acquire it', async () => {
    await controller.takeBookLock('book-free')
    await controller.releaseHeldBookLock()

    expect(controller.hasHeldBookLock()).toBe(false)
    expect(locks.held.has('book-free')).toBe(false)

    const other = createBookLockController(buildHost())
    const taken = await other.takeBookLock('book-free')
    expect(taken.ok).toBe(true)
  })

  it('release cancels autosave, bumps epoch, and resets when saving', async () => {
    await controller.takeBookLock('book-epoch')
    savePhase = 'saving'
    const epochBefore = saveEpoch

    await controller.releaseHeldBookLock()

    expect(autosaveCancel).toHaveBeenCalled()
    expect(saveEpoch).toBe(epochBefore + 1)
    expect(autosaveReset).toHaveBeenCalled()
    expect(controller.hasHeldBookLock()).toBe(false)
  })

  it('release early-returns after cancel/epoch when no lock is held', async () => {
    savePhase = 'idle'
    const epochBefore = saveEpoch

    await controller.releaseHeldBookLock()

    expect(autosaveCancel).toHaveBeenCalledOnce()
    expect(saveEpoch).toBe(epochBefore + 1)
    expect(autosaveReset).not.toHaveBeenCalled()
  })

  it('holdExternalBookLock frees the tab lock then holds externally', async () => {
    await controller.takeBookLock('book-ext')
    const held = await controller.holdExternalBookLock('book-ext')

    expect(held.ok).toBe(true)
    expect(controller.hasHeldBookLock()).toBe(false)
    expect(locks.held.has('book-ext')).toBe(true)

    const other = createBookLockController(buildHost())
    const blocked = await other.takeBookLock('book-ext')
    expect(blocked).toEqual(failure('locked-elsewhere'))

    // Replacing an existing external hold must release the previous lock first.
    const replaced = await controller.holdExternalBookLock('book-ext')
    expect(replaced.ok).toBe(true)
    expect(locks.held.has('book-ext')).toBe(true)

    await controller.releaseExternalBookLock()
    const free = await other.takeBookLock('book-ext')
    expect(free.ok).toBe(true)
  })

  it('holdExternalBookLock propagates acquire failure', async () => {
    host.acquireBookLock = () => Promise.resolve(failure('not-found'))
    controller.setHost(host)

    await expect(controller.holdExternalBookLock('missing')).resolves.toEqual(
      failure('not-found'),
    )
  })

  it('setPendingRegrant and clearBlockedAndPending update owned ids', () => {
    controller.setPendingRegrant('lib-1', 'book-1')
    expect(controller.getPendingRegrantLibraryId()).toBe('lib-1')
    expect(controller.getPendingRegrantBookId()).toBe('book-1')

    controller.clearBlockedAndPending()
    expect(controller.getPendingRegrantLibraryId()).toBeNull()
    expect(controller.getPendingRegrantBookId()).toBeNull()
    expect(controller.getBlockedBookId()).toBeNull()
  })

  it('regrantLibrary grants when requestPermission succeeds', async () => {
    const handle = createFakeBrowserDirectory({ name: 'lib' })
    peekedHandles.set('lib-1', handle)
    controller.setPendingRegrant('lib-1', null)
    requestReadwritePermission = () => Promise.resolve('granted')
    bookId = 'book-open'
    storage = fakeStorage()
    libraryId = 'lib-1'

    const granted = await controller.regrantLibrary()

    expect(granted.ok).toBe(true)
    expect(runSaveCount).toBe(1)
    expect(accessPhase).toBe('idle')
    expect(controller.getPendingRegrantLibraryId()).toBeNull()
  })

  it('regrantLibrary reports denied without opening the picker', async () => {
    const handle = createFakeBrowserDirectory({ name: 'lib' })
    peekedHandles.set('lib-1', handle)
    controller.setPendingRegrant('lib-1', null)
    requestReadwritePermission = () => Promise.resolve('denied')
    let pickerCalls = 0
    pickDirectory = () => {
      pickerCalls += 1
      return Promise.resolve(null)
    }

    const denied = await controller.regrantLibrary()

    expect(denied).toEqual(failure('permission-required'))
    expect(pickerCalls).toBe(0)
    expect(homeError).toMatch(/denied/i)
    expect(statusErrors).toEqual([
      { code: 'permission-required', action: 're-grant' },
    ])
  })

  it('regrantLibrary uses picker with same-entry check when permission is unavailable', async () => {
    const stored = createFakeBrowserDirectory({ name: 'stored' })
    const picked = createFakeBrowserDirectory({ name: 'picked' })
    peekedHandles.set('lib-1', stored)
    controller.setPendingRegrant('lib-1', null)
    requestReadwritePermission = () => Promise.resolve('unavailable')
    pickDirectory = () => Promise.resolve(picked)
    sameEntry = false

    const mismatch = await controller.regrantLibrary()

    expect(mismatch).toEqual(failure('not-found'))
    expect(homeError).toMatch(/does not match/i)
    expect(statusErrors).toEqual([{ code: 'not-found', action: 're-grant' }])
  })

  it('regrantLibrary picker cancel after unavailable returns not-found', async () => {
    const stored = createFakeBrowserDirectory({ name: 'stored' })
    peekedHandles.set('lib-1', stored)
    controller.setPendingRegrant('lib-1', null)
    requestReadwritePermission = () => Promise.resolve('unavailable')
    pickDirectory = () => Promise.resolve(null)

    const cancelled = await controller.regrantLibrary()

    expect(cancelled).toEqual(failure('not-found'))
    expect(homeError).toMatch(/not selected/i)
  })

  it('regrantLibrary refuses when peek fails for a known library id', async () => {
    controller.setPendingRegrant('missing-lib', null)
    let pickerCalls = 0
    pickDirectory = () => {
      pickerCalls += 1
      return Promise.resolve(createFakeBrowserDirectory({ name: 'fresh' }))
    }
    libraryId = null
    bookId = null
    storage = null

    const result = await controller.regrantLibrary()

    expect(result).toEqual(failure('not-found'))
    expect(homeError).toMatch(/stored library folder/i)
    expect(statusErrors).toEqual([{ code: 'not-found', action: 're-grant' }])
    expect(pickerCalls).toBe(0)
  })

  it('regrantLibrary bare picker cancel returns not-found', async () => {
    pickDirectory = () => Promise.resolve(null)

    const cancelled = await controller.regrantLibrary()

    expect(cancelled).toEqual(failure('not-found'))
    expect(homeError).toMatch(/not selected/i)
  })

  it('regrantLibrary returns not-found when withActionBusy skips', async () => {
    busyResult = 'skip'
    controller.setHost(buildHost())

    await expect(controller.regrantLibrary()).resolves.toEqual(
      failure('not-found'),
    )
  })

  it('regrantWithHandle mid-session remembers handle and retries save', async () => {
    bookId = 'book-mid'
    libraryId = 'lib-mid'
    const previousStorage = fakeStorage()
    storage = previousStorage
    homeError = 'stale'
    const emitBefore = emitCount
    const handle = createFakeBrowserDirectory({ name: 'mid' })

    const result = await controller.regrantWithHandle(handle)

    expect(result.ok).toBe(true)
    expect(runSaveCount).toBe(1)
    expect(accessPhase).toBe('idle')
    expect(libraryId).toBe('lib-mid')
    expect(storage).not.toBe(previousStorage)
    expect(homeError).toBeNull()
    expect(emitHomeError).toBeNull()
    expect(emitCount).toBeGreaterThan(emitBefore)
  })

  it('regrantWithHandle uses home path when only bookId is set without storage', async () => {
    bookId = 'book-only'
    storage = null
    libraryId = null
    persisted = { libraryId: null, bookId: null }
    resolveLibraryId = 'from-resolve'

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'home-only-book' }),
    )

    expect(result.ok).toBe(true)
    expect(runSaveCount).toBe(0)
    expect(boundCalls).toEqual([{ id: 'from-resolve', mode: 'open' }])
  })

  it('regrantWithHandle uses home path when only storage is set without bookId', async () => {
    bookId = null
    storage = fakeStorage()
    libraryId = 'lib-only-storage'
    persisted = { libraryId: null, bookId: null }

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'home-only-storage' }),
    )

    expect(result.ok).toBe(true)
    expect(runSaveCount).toBe(0)
    expect(boundCalls).toEqual([{ id: 'lib-only-storage', mode: 'open' }])
  })

  it('regrantWithHandle mid-session uses default library id when unset', async () => {
    bookId = 'book-mid'
    libraryId = null
    storage = fakeStorage()
    let rememberedId: string | null = null
    host.rememberLibraryHandle = (id) => {
      rememberedId = id
      return Promise.resolve(rememberResult)
    }
    controller.setHost(host)

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'mid-default' }),
    )

    expect(result.ok).toBe(true)
    expect(rememberedId).toBe('library')
    expect(libraryId).toBe('library')
  })

  it('regrantWithHandle mid-session surfaces remember failure', async () => {
    bookId = 'book-mid'
    libraryId = 'lib-mid'
    storage = fakeStorage()
    rememberResult = failure('not-found')

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'mid-fail' }),
    )

    expect(result).toEqual(failure('not-found'))
    expect(statusErrors).toEqual([{ code: 'not-found', action: 're-grant' }])
    expect(runSaveCount).toBe(0)
  })

  it('regrantWithHandle home path fails when library meta cannot open', async () => {
    libraryMeta = failure('permission-required')
    bookId = null
    storage = null

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'meta-fail' }),
    )

    expect(result).toEqual(failure('permission-required'))
    expect(homeError).toBe(
      'permission-required:Could not open the library after grant.',
    )
    expect(statusErrors).toEqual([
      { code: 'permission-required', action: 're-grant' },
    ])
  })

  it('regrantWithHandle home path prefers pending library id over persisted', async () => {
    bookId = null
    libraryId = null
    storage = null
    controller.setPendingRegrant('pending-lib', null)
    persisted = { libraryId: 'persisted-lib', bookId: null }

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'pending-id' }),
    )

    expect(result.ok).toBe(true)
    expect(boundCalls).toEqual([{ id: 'pending-lib', mode: 'open' }])
  })

  it('regrantWithHandle home path prefers persisted library id over resolve', async () => {
    bookId = null
    libraryId = null
    storage = null
    persisted = { libraryId: 'persisted-lib', bookId: null }
    resolveLibraryId = 'should-not-use'

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'persisted-id' }),
    )

    expect(result.ok).toBe(true)
    expect(boundCalls).toEqual([{ id: 'persisted-lib', mode: 'open' }])
  })

  it('regrantWithHandle home path resolves library id and reports bind failure', async () => {
    bookId = null
    libraryId = null
    storage = null
    persisted = { libraryId: null, bookId: null }
    bindResult = failure('not-found')

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'bind-fail' }),
    )

    expect(result).toEqual(failure('not-found'))
    expect(boundCalls).toEqual([{ id: 'resolved-lib', mode: 'open' }])
  })

  it('regrantWithHandle home path activates pending book after bind', async () => {
    const handle = createFakeBrowserDirectory({ name: 'home' })
    const book = makeBook({ id: 'pending-book' })
    loadedBooks.set('pending-book', book)
    activateResult = success(book)
    controller.setPendingRegrant('lib-home', 'pending-book')
    persisted = { libraryId: 'lib-home', bookId: 'pending-book' }
    bookId = null
    libraryId = null
    storage = null
    homeError = 'stale'

    const result = await controller.regrantWithHandle(handle)

    expect(result.ok).toBe(true)
    expect(controller.getPendingRegrantBookId()).toBeNull()
    expect(homeError).toBeNull()
    expect(boundCalls[0]?.mode).toBe('open')
  })

  it('regrantWithHandle skips activate when book id already matches', async () => {
    controller.setPendingRegrant('lib-home', 'pending-book')
    persisted = { libraryId: 'lib-home', bookId: 'pending-book' }
    bookId = 'pending-book'
    libraryId = null
    storage = null
    let activateCalls = 0
    host.activateLoadedBook = () => {
      activateCalls += 1
      return Promise.resolve(activateResult)
    }
    controller.setHost(host)

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'already-open' }),
    )

    expect(result.ok).toBe(true)
    expect(activateCalls).toBe(0)
  })

  it('regrantWithHandle skips activate when pending book is missing from storage', async () => {
    controller.setPendingRegrant('lib-home', 'missing-book')
    persisted = { libraryId: 'lib-home', bookId: 'missing-book' }
    bookId = null
    libraryId = null
    storage = null
    let activateCalls = 0
    host.activateLoadedBook = () => {
      activateCalls += 1
      return Promise.resolve(activateResult)
    }
    controller.setHost(host)

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'missing-book' }),
    )

    expect(result.ok).toBe(true)
    expect(activateCalls).toBe(0)
  })

  it('regrantWithHandle home path reports activate failure after load', async () => {
    const book = makeBook({ id: 'pending-book' })
    loadedBooks.set('pending-book', book)
    activateResult = failure('locked-elsewhere')
    controller.setPendingRegrant('lib-home', 'pending-book')
    persisted = { libraryId: 'lib-home', bookId: 'pending-book' }
    bookId = null
    libraryId = null
    storage = null

    const result = await controller.regrantWithHandle(
      createFakeBrowserDirectory({ name: 'activate-fail' }),
    )

    expect(result).toEqual(failure('locked-elsewhere'))
    expect(homeError).toBe(
      'locked-elsewhere:Could not open the book after grant.',
    )
  })

  it('setHost switches acquireBookLock dependency for later calls', async () => {
    const nextHost = buildHost()
    nextHost.acquireBookLock = () =>
      Promise.resolve(failure('permission-required'))
    controller.setHost(nextHost)

    await expect(controller.takeBookLock('switched')).resolves.toEqual(
      failure('permission-required'),
    )
  })

  it('regrantLibrary clears home error before starting', async () => {
    homeError = 'previous'
    pickDirectory = () => Promise.resolve(null)

    await controller.regrantLibrary()

    expect(emitHomeError).toBe('Library folder was not selected.')
  })
})
