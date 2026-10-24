import type { Book } from '../../core'
import type {
  BookSummary,
  LibraryStorage,
  SessionDirectoryHandle,
  StorageFailureCode,
  StorageResult,
} from '../../project'

export type LibraryActivationAccessPhase =
  'idle' | 'permission-required' | 'locked-elsewhere'

export type LibraryActivationSurface =
  'welcome' | 'library' | 'editor' | 'unsupported'

export type LibraryActivationStatus =
  | { kind: 'idle' }
  | { kind: 'open'; libraryId: string; bookId: string | null }
  | { kind: 'error'; code: StorageFailureCode; action: string }

export interface LibraryActivationHost {
  withActionBusy: <T>(task: () => Promise<T>) => Promise<T | undefined>
  pickDirectory: () => Promise<FileSystemDirectoryHandle | null>
  createStorageFromHandle: (handle: SessionDirectoryHandle) => LibraryStorage
  resolveLibraryIdForHandle: (handle: SessionDirectoryHandle) => Promise<string>
  flushPendingSaveBeforeRelease: () => Promise<StorageResult<void>>
  releaseHeldBookLock: () => Promise<void>
  takeBookLock: (bookId: string) => Promise<StorageResult<void>>
  setPendingRegrant: (libraryId: string | null, bookId: string | null) => void
  clearBlockedAndPending: () => void
  resetAutosave: () => void
  cancelAutosave: () => void
  persistIds: () => void
  clearPersistedIdKeys: () => void
  setActiveIds: (ids: {
    libraryId: string | null
    bookId: string | null
  }) => void
  getActiveIds: () => Promise<{
    libraryId: string | null
    bookId: string | null
  }>
  rememberLibraryHandle: (
    libraryId: string,
    handle: SessionDirectoryHandle,
    label: string | undefined,
  ) => Promise<StorageResult<void>>
  recallLibraryHandle: (
    libraryId: string,
  ) => Promise<StorageResult<SessionDirectoryHandle>>
  handleDisplayLabel: (handle: SessionDirectoryHandle) => string | undefined
  humanMessageForCode: (code: StorageFailureCode, fallback: string) => string
  setHomeError: (message: string | null) => void
  setStatus: (next: LibraryActivationStatus) => void
  setEditorStatus: (message: string) => void
  setPermissionRequiredAccess: () => void
  getAccessPhase: () => LibraryActivationAccessPhase
  setAccessPhase: (phase: LibraryActivationAccessPhase) => void
  setSurface: (surface: LibraryActivationSurface) => void
  emit: () => void
  getStorage: () => LibraryStorage | null
  setStorage: (next: LibraryStorage | null) => void
  getLibraryId: () => string | null
  setLibraryId: (id: string | null) => void
  getBookId: () => string | null
  setBookId: (id: string | null) => void
  setDirty: (next: boolean) => void
  getBook: () => Book
  resetBookStore: (book: Book) => void
  withoutDirtyTracking: (fn: () => void) => void
  withoutDirtyTrackingAsync: <T>(fn: () => Promise<T>) => Promise<T>
  clearAssetSources: () => void
  createEmptyLibraryBook: (id: string) => Book
  nowId: () => string
  upgradeSessionAssets: () => Promise<void>
  readPersistedIds: () => { libraryId: string | null; bookId: string | null }
  setRestorePending: (next: boolean) => void
  setPreferredLibraryId: (id: string | null) => void
  defaultLibraryId: () => string
}

export interface LibraryActivation {
  createLibrary: () => Promise<StorageResult<void>>
  openLibrary: () => Promise<StorageResult<void>>
  bindLibrary: (
    nextLibraryId: string,
    handle: SessionDirectoryHandle,
    nextStorage: LibraryStorage,
    mode?: 'adopt' | 'open' | 'browse',
  ) => Promise<StorageResult<void>>
  adoptCurrentBookInLibrary: () => Promise<StorageResult<Book>>
  activateLoadedBook: (book: Book) => Promise<StorageResult<Book>>
  selectRecentLibrary: (
    recentLibraryId: string,
  ) => Promise<StorageResult<readonly BookSummary[]>>
  openBookFromHome: (
    recentLibraryId: string,
    nextBookId: string,
  ) => Promise<StorageResult<Book>>
  tryRestore: () => Promise<StorageResult<Book | null>>
  setHost: (next: LibraryActivationHost) => void
}

export function createLibraryActivation(
  initialHost: LibraryActivationHost,
): LibraryActivation {
  let host = initialHost

  function bookHasContent(book: Book): boolean {
    if (book.gallery.length > 0) {
      return true
    }
    return book.spreads.some((spread) =>
      spread.frames.some((frame) => frame.assetId !== undefined),
    )
  }

  async function activateLoadedBook(book: Book): Promise<StorageResult<Book>> {
    const libraryId = host.getLibraryId()
    if (!libraryId) {
      return { ok: false, code: 'not-found' }
    }
    const locked = await host.takeBookLock(book.id)
    if (!locked.ok) {
      return { ok: false, code: locked.code }
    }
    host.setBookId(book.id)
    host.persistIds()
    host.withoutDirtyTracking(() => {
      host.resetBookStore(book)
    })
    host.setDirty(false)
    host.resetAutosave()
    host.setStatus({ kind: 'open', libraryId, bookId: book.id })
    host.setSurface('editor')
    host.setEditorStatus('Book restored')
    return { ok: true, value: book }
  }

  async function adoptCurrentBookInLibrary(): Promise<StorageResult<Book>> {
    const storage = host.getStorage()
    const libraryId = host.getLibraryId()
    if (!storage || !libraryId) {
      const failure = { ok: false as const, code: 'not-found' as const }
      host.setStatus({ kind: 'error', code: 'not-found', action: 'adopt book' })
      return failure
    }
    await host.upgradeSessionAssets()
    const current = host.getBook()
    const existing = await storage.loadBook(current.id)
    if (existing.ok) {
      if (!bookHasContent(current)) {
        return activateLoadedBook(existing.value)
      }
      const locked = await host.takeBookLock(current.id)
      if (!locked.ok) {
        return { ok: false, code: locked.code }
      }
      host.setBookId(current.id)
      host.persistIds()
      host.setStatus({ kind: 'open', libraryId, bookId: current.id })
      return existing
    }
    const created = await storage.createBook(current)
    if (!created.ok) {
      host.setStatus({
        kind: 'error',
        code: created.code,
        action: 'adopt book',
      })
      return created
    }
    const locked = await host.takeBookLock(created.value.id)
    if (!locked.ok) {
      return { ok: false, code: locked.code }
    }
    host.setBookId(created.value.id)
    host.persistIds()
    host.setStatus({
      kind: 'open',
      libraryId,
      bookId: created.value.id,
    })
    host.setEditorStatus('Book created in library')
    return created
  }

  async function pickAndActivateLibraryBook(
    summaries: readonly { id: string }[],
  ): Promise<StorageResult<Book>> {
    const storage = host.getStorage()
    if (!storage) {
      return { ok: false, code: 'not-found' }
    }
    const currentId = host.getBook().id
    let first: Book | null = null
    let withContent: Book | null = null
    for (const summary of summaries) {
      const loaded = await storage.loadBook(summary.id)
      if (!loaded.ok) {
        continue
      }
      first ??= loaded.value
      if (!bookHasContent(loaded.value)) {
        continue
      }
      if (summary.id === currentId) {
        return await activateLoadedBook(loaded.value)
      }
      withContent ??= loaded.value
    }
    const chosen = withContent ?? first
    if (!chosen) {
      return adoptCurrentBookInLibrary()
    }
    return activateLoadedBook(chosen)
  }

  async function activateLibraryAfterBind(
    mode: 'adopt' | 'open' | 'browse',
  ): Promise<StorageResult<void>> {
    if (mode === 'browse') {
      // Bind only — library screen lists books / empty create.
      if (bookHasContent(host.getBook())) {
        host.withoutDirtyTracking(() => {
          host.resetBookStore(host.createEmptyLibraryBook(host.nowId()))
        })
        host.clearAssetSources()
      }
      return { ok: true, value: undefined }
    }
    if (mode === 'open') {
      const storage = host.getStorage()
      if (!storage) {
        return { ok: false, code: 'not-found' }
      }
      const listed = await storage.listBooks()
      if (!listed.ok) {
        host.setStatus({
          kind: 'error',
          code: listed.code,
          action: 'open library',
        })
        return listed
      }
      if (listed.value.length > 0) {
        const opened = await pickAndActivateLibraryBook(listed.value)
        if (!opened.ok) {
          return { ok: false, code: opened.code }
        }
        return { ok: true, value: undefined }
      }
      // Empty library: never import a foreign in-memory document.
      if (bookHasContent(host.getBook())) {
        host.withoutDirtyTracking(() => {
          host.resetBookStore(host.createEmptyLibraryBook(host.nowId()))
        })
        host.clearAssetSources()
      }
    }
    const adopted = await adoptCurrentBookInLibrary()
    if (!adopted.ok) {
      return { ok: false, code: adopted.code }
    }
    return { ok: true, value: undefined }
  }

  async function bindLibrary(
    nextLibraryId: string,
    handle: SessionDirectoryHandle,
    nextStorage: LibraryStorage,
    mode: 'adopt' | 'open' | 'browse' = 'adopt',
  ): Promise<StorageResult<void>> {
    await host.releaseHeldBookLock()
    host.setStorage(nextStorage)
    host.setLibraryId(nextLibraryId)
    host.setBookId(null)
    host.persistIds()
    host.setStatus({
      kind: 'open',
      libraryId: nextLibraryId,
      bookId: null,
    })
    const activated = await host.withoutDirtyTrackingAsync(() =>
      activateLibraryAfterBind(mode),
    )
    if (!activated.ok) {
      host.setStorage(null)
      host.setLibraryId(null)
      host.setBookId(null)
      host.persistIds()
      host.setStatus({
        kind: 'error',
        code: activated.code,
        action: 'open library',
      })
      host.emit()
      return activated
    }
    const remembered = await host.rememberLibraryHandle(
      nextLibraryId,
      handle,
      host.handleDisplayLabel(handle),
    )
    if (!remembered.ok) {
      await host.releaseHeldBookLock()
      host.setStorage(null)
      host.setLibraryId(null)
      host.setBookId(null)
      host.persistIds()
      host.setAccessPhase('idle')
      host.clearBlockedAndPending()
      host.withoutDirtyTracking(() => {
        host.resetBookStore(host.createEmptyLibraryBook(host.nowId()))
      })
      host.clearAssetSources()
      host.setDirty(false)
      host.resetAutosave()
      host.setSurface('library')
      host.setHomeError(
        host.humanMessageForCode(
          remembered.code,
          'Could not remember this library. Try again.',
        ),
      )
      host.setStatus({
        kind: 'error',
        code: remembered.code,
        action: 'open library',
      })
      host.emit()
      return remembered
    }
    host.setDirty(false)
    host.resetAutosave()
    if (host.getAccessPhase() === 'permission-required') {
      host.setAccessPhase('idle')
    }
    host.setSurface(mode === 'browse' ? 'library' : 'editor')
    host.emit()
    return { ok: true, value: undefined }
  }

  async function releaseOpenBookForNewLibrary(): Promise<void> {
    if (host.getStorage() === null && host.getBookId() === null) {
      return
    }
    await host.releaseHeldBookLock()
    host.setStorage(null)
    host.setLibraryId(null)
    host.setBookId(null)
    host.persistIds()
    host.setActiveIds({ libraryId: null, bookId: null })
    host.setAccessPhase('idle')
    host.clearBlockedAndPending()
    host.withoutDirtyTracking(() => {
      host.resetBookStore(host.createEmptyLibraryBook(host.nowId()))
    })
    host.setDirty(false)
    host.resetAutosave()
    host.setStatus({ kind: 'idle' })
  }

  async function createLibrary(): Promise<StorageResult<void>> {
    const result = await host.withActionBusy(async () => {
      host.setHomeError(null)
      const handle = await host.pickDirectory()
      if (!handle) {
        host.setHomeError('Library folder was not selected.')
        return { ok: false as const, code: 'not-found' as const }
      }
      const flushed = await host.flushPendingSaveBeforeRelease()
      if (!flushed.ok) {
        return flushed
      }
      await releaseOpenBookForNewLibrary()
      const nextStorage = host.createStorageFromHandle(handle)
      const written = await nextStorage.updateLibrary({})
      if (!written.ok) {
        const message = host.humanMessageForCode(
          written.code,
          'Could not create the library folder.',
        )
        host.setHomeError(message)
        host.setStatus({
          kind: 'error',
          code: written.code,
          action: 'create library',
        })
        return written
      }
      const nextId = await host.resolveLibraryIdForHandle(handle)
      return bindLibrary(nextId, handle, nextStorage, 'browse')
    })
    return result ?? { ok: false, code: 'not-found' }
  }

  async function openLibrary(): Promise<StorageResult<void>> {
    const result = await host.withActionBusy(async () => {
      host.setHomeError(null)
      const handle = await host.pickDirectory()
      if (!handle) {
        host.setHomeError('Library folder was not selected.')
        return { ok: false as const, code: 'not-found' as const }
      }
      const flushed = await host.flushPendingSaveBeforeRelease()
      if (!flushed.ok) {
        return flushed
      }
      const nextStorage = host.createStorageFromHandle(handle)
      const meta = await nextStorage.getLibrary()
      if (!meta.ok) {
        const message = host.humanMessageForCode(
          meta.code,
          'Could not open the library folder.',
        )
        host.setHomeError(message)
        host.setStatus({
          kind: 'error',
          code: meta.code,
          action: 'open library',
        })
        return meta
      }
      const nextId = await host.resolveLibraryIdForHandle(handle)
      return bindLibrary(nextId, handle, nextStorage, 'browse')
    })
    return result ?? { ok: false, code: 'not-found' }
  }

  async function selectRecentLibrary(
    recentLibraryId: string,
  ): Promise<StorageResult<readonly BookSummary[]>> {
    const result = await host.withActionBusy(async () => {
      host.setHomeError(null)
      let recalled: StorageResult<SessionDirectoryHandle>
      try {
        recalled = await host.recallLibraryHandle(recentLibraryId)
      } catch {
        return { ok: false as const, code: 'not-found' as const }
      }
      if (!recalled.ok) {
        if (recalled.code === 'permission-required') {
          host.setPendingRegrant(recentLibraryId, null)
          host.setPermissionRequiredAccess()
          host.setStatus({
            kind: 'error',
            code: 'permission-required',
            action: 'open recent library',
          })
        } else {
          host.setHomeError(
            host.humanMessageForCode(
              recalled.code,
              'Could not open that recent library.',
            ),
          )
        }
        return { ok: false as const, code: recalled.code }
      }
      const nextStorage = host.createStorageFromHandle(recalled.value)
      const listed = await nextStorage.listBooks()
      if (!listed.ok) {
        host.setHomeError(
          host.humanMessageForCode(listed.code, 'Could not list books.'),
        )
        host.setStatus({
          kind: 'error',
          code: listed.code,
          action: 'list books',
        })
        return listed
      }
      if (host.getAccessPhase() === 'permission-required') {
        host.setAccessPhase('idle')
        host.emit()
      }
      return listed
    })
    return result ?? { ok: false, code: 'not-found' }
  }

  async function openBoundLibraryBook(
    libraryKey: string,
    nextBookId: string,
    nextStorage: LibraryStorage,
  ): Promise<StorageResult<Book>> {
    await host.releaseHeldBookLock()
    host.setBookId(null)
    if (host.getAccessPhase() === 'permission-required') {
      host.setAccessPhase('idle')
    }
    host.setStatus({
      kind: 'open',
      libraryId: libraryKey,
      bookId: null,
    })
    const loaded = await nextStorage.loadBook(nextBookId)
    if (!loaded.ok) {
      host.setAccessPhase('idle')
      host.clearBlockedAndPending()
      host.setHomeError(
        host.humanMessageForCode(loaded.code, 'Could not open that book.'),
      )
      host.setStatus({
        kind: 'error',
        code: loaded.code,
        action: 'open book',
      })
      host.setSurface('library')
      host.emit()
      return loaded
    }
    const activated = await activateLoadedBook(loaded.value)
    if (!activated.ok) {
      host.setAccessPhase('idle')
      host.clearBlockedAndPending()
      host.withoutDirtyTracking(() => {
        host.resetBookStore(host.createEmptyLibraryBook(host.nowId()))
      })
      host.clearAssetSources()
      host.setSurface('library')
      host.setEditorStatus('')
      host.setHomeError(
        host.humanMessageForCode(activated.code, 'Could not open that book.'),
      )
      host.emit()
      return activated
    }
    host.setSurface('editor')
    host.setHomeError(null)
    host.emit()
    return activated
  }

  async function openBookFromHome(
    recentLibraryId: string,
    nextBookId: string,
  ): Promise<StorageResult<Book>> {
    const result = await host.withActionBusy(async () => {
      host.setHomeError(null)
      const boundStorage = host.getStorage()
      if (boundStorage !== null && host.getLibraryId() === recentLibraryId) {
        return openBoundLibraryBook(recentLibraryId, nextBookId, boundStorage)
      }
      let recalled: StorageResult<SessionDirectoryHandle>
      try {
        recalled = await host.recallLibraryHandle(recentLibraryId)
      } catch {
        return { ok: false as const, code: 'not-found' as const }
      }
      if (!recalled.ok) {
        if (recalled.code === 'permission-required') {
          host.setPendingRegrant(recentLibraryId, nextBookId)
          host.setPermissionRequiredAccess()
          host.setStatus({
            kind: 'error',
            code: 'permission-required',
            action: 'open book',
          })
        } else {
          host.setHomeError(
            host.humanMessageForCode(
              recalled.code,
              'Could not open that book.',
            ),
          )
        }
        return { ok: false as const, code: recalled.code }
      }
      const nextStorage = host.createStorageFromHandle(recalled.value)
      host.setStorage(nextStorage)
      host.setLibraryId(recentLibraryId)
      const opened = await openBoundLibraryBook(
        recentLibraryId,
        nextBookId,
        nextStorage,
      )
      if (!opened.ok) {
        host.setStorage(null)
        host.setLibraryId(null)
        host.setBookId(null)
        host.persistIds()
        host.setAccessPhase('idle')
        host.clearBlockedAndPending()
        host.setSurface('library')
        host.emit()
        return opened
      }
      const remembered = await host.rememberLibraryHandle(
        recentLibraryId,
        recalled.value,
        host.handleDisplayLabel(recalled.value),
      )
      if (!remembered.ok) {
        await host.releaseHeldBookLock()
        host.setStorage(null)
        host.setLibraryId(null)
        host.setBookId(null)
        host.persistIds()
        host.setAccessPhase('idle')
        host.clearBlockedAndPending()
        host.withoutDirtyTracking(() => {
          host.resetBookStore(host.createEmptyLibraryBook(host.nowId()))
        })
        host.clearAssetSources()
        host.setDirty(false)
        host.resetAutosave()
        host.setSurface('library')
        host.setHomeError(
          host.humanMessageForCode(
            remembered.code,
            'Could not remember this library. Try again.',
          ),
        )
        host.setStatus({
          kind: 'error',
          code: remembered.code,
          action: 'open book',
        })
        host.emit()
        return remembered
      }
      return opened
    })
    return result ?? { ok: false, code: 'not-found' }
  }

  async function clearStaleRestoreState(): Promise<void> {
    await host.releaseHeldBookLock()
    host.setStorage(null)
    host.setLibraryId(null)
    host.setBookId(null)
    host.clearPersistedIdKeys()
    host.setActiveIds({ libraryId: null, bookId: null })
    host.setDirty(false)
    host.resetAutosave()
    host.setAccessPhase('idle')
    host.clearBlockedAndPending()
    host.setStatus({ kind: 'idle' })
  }

  async function tryRestore(): Promise<StorageResult<Book | null>> {
    const result = await host.withActionBusy(async () => {
      host.setRestorePending(true)
      host.emit()
      try {
        host.cancelAutosave()
        const id = host.readPersistedIds().libraryId ?? host.defaultLibraryId()
        let recalled: StorageResult<SessionDirectoryHandle>
        try {
          recalled = await host.recallLibraryHandle(id)
        } catch {
          await clearStaleRestoreState()
          host.setSurface('welcome')
          host.emit()
          return { ok: true as const, value: null }
        }
        if (!recalled.ok) {
          if (recalled.code === 'permission-required') {
            await host.releaseHeldBookLock()
            host.setStorage(null)
            host.setBookId(null)
            host.setLibraryId(id)
            host.setPendingRegrant(id, host.readPersistedIds().bookId)
            host.setDirty(false)
            host.resetAutosave()
            host.setSurface('welcome')
            host.setPermissionRequiredAccess()
            host.setStatus({
              kind: 'error',
              code: 'permission-required',
              action: 'restore library',
            })
            return { ok: true as const, value: null }
          }
          await clearStaleRestoreState()
          host.setSurface('welcome')
          host.emit()
          return { ok: true as const, value: null }
        }
        const nextStorage = host.createStorageFromHandle(recalled.value)
        host.setStorage(nextStorage)
        host.setLibraryId(id)
        const persistedBookId = host.readPersistedIds().bookId
        if (!persistedBookId) {
          host.setSurface('library')
          host.setAccessPhase('idle')
          host.emit()
          return { ok: true as const, value: null }
        }
        host.setSurface('editor')
        host.emit()
        const loaded = await nextStorage.loadBook(persistedBookId)
        if (!loaded.ok) {
          await clearStaleRestoreState()
          host.setStorage(nextStorage)
          host.setLibraryId(id)
          host.setSurface('library')
          host.setHomeError(
            host.humanMessageForCode(
              loaded.code,
              'Could not restore the previous book.',
            ),
          )
          host.setStatus({
            kind: 'error',
            code: loaded.code,
            action: 'restore book',
          })
          return loaded
        }
        return await activateLoadedBook(loaded.value)
      } finally {
        try {
          const active = await host.getActiveIds()
          host.setPreferredLibraryId(active.libraryId)
        } catch {
          host.setPreferredLibraryId(null)
        }
        host.setRestorePending(false)
        host.emit()
      }
    })
    return result ?? { ok: true, value: null }
  }

  return {
    createLibrary,
    openLibrary,
    bindLibrary,
    adoptCurrentBookInLibrary,
    activateLoadedBook,
    selectRecentLibrary,
    openBookFromHome,
    tryRestore,
    setHost(next): void {
      host = next
    },
  }
}
