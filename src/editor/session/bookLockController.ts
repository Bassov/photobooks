import type { Book } from '../../core'
import type {
  BookLock,
  LibraryStorage,
  SessionDirectoryHandle,
  StorageFailureCode,
  StorageResult,
} from '../../project'
import type { RequestReadwritePermission } from './browserProjectSessionPlatform'
import type { SavePhase } from './autosaveController'

export const LOCK_BANNER_MESSAGE =
  'This book is open in another tab. Close it there and try again.'

const DEFAULT_LIBRARY_ID = 'library'

export interface BookLockControllerHost {
  cancelAutosave: () => void
  resetAutosave: () => void
  getSavePhase: () => SavePhase
  bumpSaveEpoch: () => void
  /** Reset book store to locked placeholder and clear dirty (no autosave). */
  clearLockedPlaceholderDocument: () => void
  setAccessPhase: (
    phase: 'idle' | 'permission-required' | 'locked-elsewhere',
  ) => void
  setBookId: (id: string | null) => void
  getBookId: () => string | null
  persistIds: () => void
  setEditorStatus: (message: string) => void
  emit: () => void
  getStorage: () => LibraryStorage | null
  setStorage: (next: LibraryStorage | null) => void
  getLibraryId: () => string | null
  setLibraryId: (id: string | null) => void
  setHomeError: (message: string | null) => void
  setStatusError: (code: StorageFailureCode, action: string) => void
  runSave: () => void
  createStorageFromHandle: (handle: SessionDirectoryHandle) => LibraryStorage
  rememberLibraryHandle: (
    libraryId: string,
    handle: SessionDirectoryHandle,
    label: string | undefined,
  ) => Promise<StorageResult<void>>
  peekLibraryHandle: (
    libraryId: string,
  ) => Promise<StorageResult<SessionDirectoryHandle>>
  handlesReferToSameDirectory: (
    left: SessionDirectoryHandle,
    right: SessionDirectoryHandle,
  ) => Promise<boolean>
  handleDisplayLabel: (handle: SessionDirectoryHandle) => string | undefined
  bindLibrary: (
    libraryId: string,
    handle: SessionDirectoryHandle,
    storage: LibraryStorage,
    mode: 'adopt' | 'open',
  ) => Promise<StorageResult<void>>
  resolveLibraryIdForHandle: (handle: SessionDirectoryHandle) => Promise<string>
  readPersistedIds: () => { libraryId: string | null; bookId: string | null }
  activateLoadedBook: (book: Book) => Promise<StorageResult<Book>>
  withActionBusy: <T>(task: () => Promise<T>) => Promise<T | undefined>
  humanMessageForCode: (code: StorageFailureCode, fallback: string) => string
  acquireBookLock: (bookId: string) => Promise<StorageResult<BookLock>>
  pickDirectory: () => Promise<FileSystemDirectoryHandle | null>
  requestReadwritePermission: RequestReadwritePermission
}

export interface BookLockController {
  getBlockedBookId: () => string | null
  getPendingRegrantLibraryId: () => string | null
  getPendingRegrantBookId: () => string | null
  hasHeldBookLock: () => boolean
  setPendingRegrant: (libraryId: string | null, bookId: string | null) => void
  clearBlockedAndPending: () => void
  releaseHeldBookLock: () => Promise<void>
  takeBookLock: (nextBookId: string) => Promise<StorageResult<void>>
  regrantWithHandle: (
    handle: SessionDirectoryHandle,
    options?: { requireSameAsStored?: SessionDirectoryHandle | null },
  ) => Promise<StorageResult<void>>
  regrantLibrary: () => Promise<StorageResult<void>>
  holdExternalBookLock: (nextBookId: string) => Promise<StorageResult<void>>
  releaseExternalBookLock: () => Promise<void>
  setHost: (next: BookLockControllerHost) => void
}

export function createBookLockController(
  initialHost: BookLockControllerHost,
): BookLockController {
  let host = initialHost
  let heldBookLock: BookLock | null = null
  let externalBookLock: BookLock | null = null
  let blockedBookId: string | null = null
  let pendingRegrantLibraryId: string | null = null
  let pendingRegrantBookId: string | null = null

  function clearDocumentWhileLocked(): void {
    host.clearLockedPlaceholderDocument()
    host.resetAutosave()
  }

  async function releaseHeldBookLock(): Promise<void> {
    host.cancelAutosave()
    host.bumpSaveEpoch()
    if (host.getSavePhase() === 'saving') {
      host.resetAutosave()
    }
    if (heldBookLock === null) {
      return
    }
    const lock = heldBookLock
    heldBookLock = null
    await lock.release()
  }

  async function takeBookLock(
    nextBookId: string,
  ): Promise<StorageResult<void>> {
    await releaseHeldBookLock()
    const acquired = await host.acquireBookLock(nextBookId)
    if (!acquired.ok) {
      if (acquired.code === 'locked-elsewhere') {
        host.setAccessPhase('locked-elsewhere')
        blockedBookId = nextBookId
        host.setBookId(null)
        host.persistIds()
        clearDocumentWhileLocked()
        host.setEditorStatus(LOCK_BANNER_MESSAGE)
        host.emit()
      }
      return { ok: false, code: acquired.code }
    }
    heldBookLock = acquired.value
    host.setAccessPhase('idle')
    blockedBookId = null
    return { ok: true, value: undefined }
  }

  async function regrantWithHandle(
    handle: SessionDirectoryHandle,
    options: { requireSameAsStored?: SessionDirectoryHandle | null } = {},
  ): Promise<StorageResult<void>> {
    if (options.requireSameAsStored) {
      const same = await host.handlesReferToSameDirectory(
        options.requireSameAsStored,
        handle,
      )
      if (!same) {
        host.setHomeError(
          'That folder does not match the recent library. Pick the original folder.',
        )
        host.setStatusError('not-found', 're-grant')
        return { ok: false, code: 'not-found' }
      }
    }
    const midSession = host.getBookId() !== null && host.getStorage() !== null
    const targetBookId = pendingRegrantBookId ?? host.readPersistedIds().bookId
    const nextStorage = host.createStorageFromHandle(handle)
    if (midSession) {
      const id = host.getLibraryId() ?? DEFAULT_LIBRARY_ID
      const remembered = await host.rememberLibraryHandle(
        id,
        handle,
        host.handleDisplayLabel(handle),
      )
      if (!remembered.ok) {
        host.setStatusError(remembered.code, 're-grant')
        return remembered
      }
      host.setStorage(nextStorage)
      host.setLibraryId(id)
      host.setAccessPhase('idle')
      host.setHomeError(null)
      pendingRegrantLibraryId = null
      pendingRegrantBookId = null
      host.emit()
      host.runSave()
      return { ok: true, value: undefined }
    }
    const meta = await nextStorage.getLibrary()
    if (!meta.ok) {
      host.setHomeError(
        host.humanMessageForCode(
          meta.code,
          'Could not open the library after grant.',
        ),
      )
      host.setStatusError(meta.code, 're-grant')
      return meta
    }
    const nextId =
      host.getLibraryId() ??
      pendingRegrantLibraryId ??
      host.readPersistedIds().libraryId ??
      (await host.resolveLibraryIdForHandle(handle))
    const bound = await host.bindLibrary(nextId, handle, nextStorage, 'open')
    if (!bound.ok) {
      return bound
    }
    const bookToOpen = targetBookId
    pendingRegrantLibraryId = null
    pendingRegrantBookId = null
    host.setHomeError(null)
    const storageAfterBind = host.getStorage()
    if (bookToOpen && storageAfterBind && host.getBookId() !== bookToOpen) {
      const loaded = await storageAfterBind.loadBook(bookToOpen)
      if (loaded.ok) {
        const activated = await host.activateLoadedBook(loaded.value)
        if (!activated.ok) {
          host.setHomeError(
            host.humanMessageForCode(
              activated.code,
              'Could not open the book after grant.',
            ),
          )
          return { ok: false, code: activated.code }
        }
      }
    }
    return { ok: true, value: undefined }
  }

  async function regrantLibrary(): Promise<StorageResult<void>> {
    const result = await host.withActionBusy(async () => {
      host.setHomeError(null)
      const targetLibraryId =
        pendingRegrantLibraryId ??
        host.getLibraryId() ??
        host.readPersistedIds().libraryId
      if (targetLibraryId) {
        const peeked = await host.peekLibraryHandle(targetLibraryId)
        if (peeked.ok) {
          const permission = await host.requestReadwritePermission(peeked.value)
          if (permission === 'granted') {
            return regrantWithHandle(peeked.value)
          }
          if (permission === 'denied') {
            host.setHomeError(
              'Write permission was denied. Allow access to continue.',
            )
            host.setStatusError('permission-required', 're-grant')
            return { ok: false as const, code: 'permission-required' as const }
          }
          const picked = await host.pickDirectory()
          if (!picked) {
            host.setHomeError('Library folder was not selected.')
            return { ok: false as const, code: 'not-found' as const }
          }
          return regrantWithHandle(picked, {
            requireSameAsStored: peeked.value,
          })
        }
        host.setHomeError(
          'Could not find the stored library folder. Use Open to pick it again.',
        )
        host.setStatusError('not-found', 're-grant')
        return { ok: false as const, code: 'not-found' as const }
      }
      const handle = await host.pickDirectory()
      if (!handle) {
        host.setHomeError('Library folder was not selected.')
        return { ok: false as const, code: 'not-found' as const }
      }
      return regrantWithHandle(handle)
    })
    return result ?? { ok: false, code: 'not-found' }
  }

  async function holdExternalBookLock(
    nextBookId: string,
  ): Promise<StorageResult<void>> {
    await releaseHeldBookLock()
    if (externalBookLock) {
      await externalBookLock.release()
      externalBookLock = null
    }
    const acquired = await host.acquireBookLock(nextBookId)
    if (!acquired.ok) {
      return { ok: false, code: acquired.code }
    }
    externalBookLock = acquired.value
    return { ok: true, value: undefined }
  }

  async function releaseExternalBookLock(): Promise<void> {
    if (externalBookLock) {
      await externalBookLock.release()
      externalBookLock = null
    }
  }

  return {
    getBlockedBookId: () => blockedBookId,
    getPendingRegrantLibraryId: () => pendingRegrantLibraryId,
    getPendingRegrantBookId: () => pendingRegrantBookId,
    hasHeldBookLock: () => heldBookLock !== null,
    setPendingRegrant(libraryId, bookId): void {
      pendingRegrantLibraryId = libraryId
      pendingRegrantBookId = bookId
    },
    clearBlockedAndPending(): void {
      blockedBookId = null
      pendingRegrantLibraryId = null
      pendingRegrantBookId = null
    },
    releaseHeldBookLock,
    takeBookLock,
    regrantWithHandle,
    regrantLibrary,
    holdExternalBookLock,
    releaseExternalBookLock,
    setHost(next): void {
      host = next
    },
  }
}
