import type { AssetSource } from '../assets'
import { addSpread, CURRENT_SCHEMA_VERSION, type Book } from '../core'
import {
  createBrowserSessionState,
  createFsaLibraryStorage,
  createMemoryLibraryStorage,
  createMemorySessionState,
  fromFileSystemDirectoryHandle,
  type BookLock,
  type LibraryStorage,
  type RecentLibrary,
  type SessionDirectoryHandle,
  type SessionState,
  type StorageFailureCode,
  type StorageResult,
} from '../project'
import {
  getBookStoreSnapshot,
  resetBookStore,
  subscribeBookStore,
} from './bookStore'
import {
  isEditorGestureActive,
  resetEditorGestureForTests,
  subscribeEditorGesture,
} from './editorGesture'
import { setEditorStatus } from './editorStatus'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'
import { upgradeSessionAssetsForLibrary } from './upgradeSessionAssets'

const DEFAULT_LIBRARY_ID = 'library'
const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 1000

const ACTIVE_BOOK_KEY = 'photobooks.activeBookId'
const LIBRARY_ID_KEY = 'photobooks.libraryId'

type ProjectSessionStatus =
  | { kind: 'idle' }
  | { kind: 'open'; libraryId: string; bookId: string | null }
  | { kind: 'error'; code: StorageFailureCode; action: string }

type SavePhase = 'idle' | 'pending' | 'saving' | 'error'

type AccessPhase = 'idle' | 'permission-required' | 'locked-elsewhere'

type ProjectSessionSurface = 'home' | 'editor'

type Listener = () => void

export interface ProjectSessionSnapshot {
  libraryOpen: boolean
  bookId: string | null
  libraryId: string | null
  status: ProjectSessionStatus
  dirty: boolean
  savePhase: SavePhase
  /** True while `savePhase === 'saving'` (manual or autosave). */
  saving: boolean
  accessPhase: AccessPhase
  blockedBookId: string | null
  surface: ProjectSessionSurface
  /** True until the initial `tryRestore` settles. */
  restorePending: boolean
  /** True while a home/editor library action is in flight. */
  actionBusy: boolean
  /** Bumped when test seams reseed recents so home can refresh. */
  recentsRevision: number
  /** Last home/session error message for the UI (human-readable). */
  homeError: string | null
  /** Last active library id from session state (for home preselect). */
  preferredLibraryId: string | null
}

export interface ProjectSessionDeps {
  session?: SessionState
  createStorage?: (root: SessionDirectoryHandle) => LibraryStorage
  pickDirectory?: () => Promise<FileSystemDirectoryHandle | null>
  storageKey?: Storage
  nowId?: () => string
  autosaveDebounceMs?: number
}

function defaultStorageFromHandle(
  root: SessionDirectoryHandle,
): LibraryStorage {
  if (isFileSystemDirectoryHandle(root)) {
    return createFsaLibraryStorage({
      root: fromFileSystemDirectoryHandle(root),
    })
  }
  return createFsaLibraryStorage({
    root: root as Parameters<typeof createFsaLibraryStorage>[0]['root'],
  })
}

function isFileSystemDirectoryHandle(
  value: SessionDirectoryHandle,
): value is FileSystemDirectoryHandle {
  return (
    typeof FileSystemDirectoryHandle !== 'undefined' &&
    value instanceof FileSystemDirectoryHandle
  )
}

function createDefaultSession(): SessionState {
  if (typeof indexedDB === 'undefined') {
    return createMemorySessionState()
  }
  return createBrowserSessionState()
}

let session: SessionState = createDefaultSession()
let createStorageFromHandle: (root: SessionDirectoryHandle) => LibraryStorage =
  defaultStorageFromHandle
let pickDirectory: () => Promise<FileSystemDirectoryHandle | null> =
  defaultPickDirectory
let storageKey: Storage | null =
  typeof sessionStorage === 'undefined' ? null : sessionStorage
let nowId: () => string = () => crypto.randomUUID()

let storage: LibraryStorage | null = null
let libraryId: string | null = null
let bookId: string | null = null
let status: ProjectSessionStatus = { kind: 'idle' }
let dirty = false
let savePhase: SavePhase = 'idle'
let editGeneration = 0
let ignoreBookStoreDirty = false
let lastBookRef: Book | null = getBookStoreSnapshot().book
let autosaveDebounceMs = DEFAULT_AUTOSAVE_DEBOUNCE_MS
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let accessPhase: AccessPhase = 'idle'
let blockedBookId: string | null = null
let heldBookLock: BookLock | null = null
let externalBookLockForTests: BookLock | null = null
/** Bumped to invalidate in-flight saves before releasing a book lock. */
let saveEpoch = 0
let surface: ProjectSessionSurface = 'home'
/** Library id waiting for re-grant from home select/open. */
let pendingRegrantLibraryId: string | null = null
/** Book id to open after a successful home re-grant. */
let pendingRegrantBookId: string | null = null
let restorePending = true
let actionBusy = false
let homeError: string | null = null
let preferredLibraryId: string | null = null
let recentsRevision = 0
const assetSources = new Map<string, AssetSource>()
const listeners = new Set<Listener>()
let snapshot: ProjectSessionSnapshot = {
  libraryOpen: false,
  bookId: null,
  libraryId: null,
  status: { kind: 'idle' },
  dirty: false,
  savePhase: 'idle',
  saving: false,
  accessPhase: 'idle',
  blockedBookId: null,
  surface: 'home',
  restorePending: true,
  actionBusy: false,
  recentsRevision: 0,
  homeError: null,
  preferredLibraryId: null,
}

const LOCK_BANNER_MESSAGE =
  'This book is open in another tab. Close it there and try again.'

function humanMessageForCode(
  code: StorageFailureCode,
  fallback: string,
): string {
  switch (code) {
    case 'locked-elsewhere':
      return LOCK_BANNER_MESSAGE
    case 'permission-required':
      return 'Folder access is required. Use Grant access and allow write permission.'
    case 'not-found':
      return fallback
    default:
      return fallback
  }
}

function setHomeError(message: string | null): void {
  homeError = message
  emit()
}

function refreshSnapshot(): boolean {
  const next: ProjectSessionSnapshot = {
    libraryOpen: storage !== null,
    bookId,
    libraryId,
    status,
    dirty,
    savePhase,
    saving: savePhase === 'saving',
    accessPhase,
    blockedBookId,
    surface,
    restorePending,
    actionBusy,
    recentsRevision,
    homeError,
    preferredLibraryId,
  }
  if (
    next.libraryOpen === snapshot.libraryOpen &&
    next.bookId === snapshot.bookId &&
    next.libraryId === snapshot.libraryId &&
    next.status === snapshot.status &&
    next.dirty === snapshot.dirty &&
    next.savePhase === snapshot.savePhase &&
    next.saving === snapshot.saving &&
    next.accessPhase === snapshot.accessPhase &&
    next.blockedBookId === snapshot.blockedBookId &&
    next.surface === snapshot.surface &&
    next.restorePending === snapshot.restorePending &&
    next.actionBusy === snapshot.actionBusy &&
    next.recentsRevision === snapshot.recentsRevision &&
    next.homeError === snapshot.homeError &&
    next.preferredLibraryId === snapshot.preferredLibraryId
  ) {
    return false
  }
  snapshot = next
  return true
}

async function withActionBusy<T>(
  task: () => Promise<T>,
): Promise<T | undefined> {
  if (actionBusy) {
    return undefined
  }
  actionBusy = true
  emit()
  try {
    return await task()
  } finally {
    actionBusy = false
    emit()
  }
}

async function flushPendingSaveBeforeRelease(): Promise<StorageResult<void>> {
  if (savePhase === 'error') {
    setEditorStatus(
      'Could not save changes. Fix the save error before leaving the editor.',
    )
    emit()
    return { ok: false, code: 'not-found' }
  }
  if (
    storage === null ||
    bookId === null ||
    heldBookLock === null ||
    (!dirty && savePhase !== 'pending' && savePhase !== 'saving')
  ) {
    return { ok: true, value: undefined }
  }
  cancelAutosaveTimer()
  const generationAtStart = editGeneration
  const epochAtStart = saveEpoch
  savePhase = 'saving'
  emit()
  await persistBookSnapshot(storage, generationAtStart, epochAtStart)
  if (epochAtStart !== saveEpoch) {
    return { ok: false, code: 'not-found' }
  }
  if (dirty) {
    savePhase = 'error'
    setEditorStatus(
      'Could not save changes. Fix the save error before leaving the editor.',
    )
    emit()
    return { ok: false, code: 'not-found' }
  }
  savePhase = 'idle'
  emit()
  return { ok: true, value: undefined }
}

async function releaseHeldBookLock(): Promise<void> {
  cancelAutosaveTimer()
  saveEpoch += 1
  if (savePhase === 'saving') {
    savePhase = 'idle'
  }
  if (heldBookLock === null) {
    return
  }
  const lock = heldBookLock
  heldBookLock = null
  await lock.release()
}

function clearDocumentWhileLocked(): void {
  withoutDirtyTracking(() => {
    resetBookStore({
      book: createEmptyLibraryBook('locked-placeholder'),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  })
  dirty = false
  savePhase = 'idle'
  cancelAutosaveTimer()
}

async function takeBookLock(nextBookId: string): Promise<StorageResult<void>> {
  await releaseHeldBookLock()
  const acquired = await session.acquireBookLock(nextBookId)
  if (!acquired.ok) {
    if (acquired.code === 'locked-elsewhere') {
      accessPhase = 'locked-elsewhere'
      blockedBookId = nextBookId
      bookId = null
      persistIds()
      clearDocumentWhileLocked()
      setEditorStatus(LOCK_BANNER_MESSAGE)
      emit()
    }
    return { ok: false, code: acquired.code }
  }
  heldBookLock = acquired.value
  accessPhase = 'idle'
  blockedBookId = null
  return { ok: true, value: undefined }
}

function setPermissionRequiredAccess(): void {
  accessPhase = 'permission-required'
  emit()
}

function cancelAutosaveTimer(): void {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
}

function armAutosaveDebounce(): void {
  if (storage === null || bookId === null || !dirty || savePhase === 'error') {
    return
  }
  if (savePhase === 'saving') {
    return
  }
  savePhase = 'pending'
  cancelAutosaveTimer()
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    if (savePhase !== 'pending' || !dirty || isEditorGestureActive()) {
      return
    }
    runSave()
  }, autosaveDebounceMs)
  emit()
}

function markDirtyFromUserEdit(): void {
  if (
    storage === null ||
    bookId === null ||
    accessPhase === 'locked-elsewhere'
  ) {
    return
  }
  dirty = true
  editGeneration += 1
  if (savePhase === 'error') {
    savePhase = 'pending'
  }
  if (savePhase !== 'saving') {
    armAutosaveDebounce()
  } else {
    emit()
  }
}

function withoutDirtyTracking(fn: () => void): void {
  ignoreBookStoreDirty = true
  try {
    fn()
  } finally {
    ignoreBookStoreDirty = false
    lastBookRef = getBookStoreSnapshot().book
  }
}

async function withoutDirtyTrackingAsync<T>(fn: () => Promise<T>): Promise<T> {
  ignoreBookStoreDirty = true
  try {
    return await fn()
  } finally {
    ignoreBookStoreDirty = false
    lastBookRef = getBookStoreSnapshot().book
  }
}

function onBookStoreChanged(): void {
  const book = getBookStoreSnapshot().book
  if (book === lastBookRef) {
    return
  }
  lastBookRef = book
  if (ignoreBookStoreDirty) {
    return
  }
  markDirtyFromUserEdit()
}

function onGestureChanged(): void {
  if (isEditorGestureActive()) {
    return
  }
  if (savePhase === 'pending' && dirty) {
    armAutosaveDebounce()
  }
}

subscribeBookStore(onBookStoreChanged)
subscribeEditorGesture(onGestureChanged)

function emit(): void {
  if (!refreshSnapshot()) {
    return
  }
  for (const listener of listeners) {
    listener()
  }
}

function setStatus(next: ProjectSessionStatus): void {
  status = next
  if (next.kind === 'error') {
    setEditorStatus(`Could not ${next.action}: ${next.code}`)
  }
  emit()
}

function persistIds(): void {
  if (storageKey) {
    if (libraryId) {
      storageKey.setItem(LIBRARY_ID_KEY, libraryId)
    } else {
      storageKey.removeItem(LIBRARY_ID_KEY)
    }
    if (bookId) {
      storageKey.setItem(ACTIVE_BOOK_KEY, bookId)
    } else {
      storageKey.removeItem(ACTIVE_BOOK_KEY)
    }
  }
  void session.setActiveIds({
    libraryId,
    bookId,
  })
}

async function handlesReferToSameDirectory(
  left: SessionDirectoryHandle,
  right: SessionDirectoryHandle,
): Promise<boolean> {
  if (left === right) {
    return true
  }
  const leftEntry = left as {
    isSameEntry?: (other: SessionDirectoryHandle) => Promise<boolean>
  }
  if (typeof leftEntry.isSameEntry === 'function') {
    try {
      return await leftEntry.isSameEntry(right)
    } catch {
      return false
    }
  }
  return false
}

async function resolveLibraryIdForHandle(
  handle: SessionDirectoryHandle,
): Promise<string> {
  const listed = await session.listRecentLibraries()
  const recents = listed.ok ? listed.value : []
  for (const recent of recents) {
    const peeked = await session.peekLibraryHandle(recent.id)
    if (!peeked.ok) {
      continue
    }
    if (await handlesReferToSameDirectory(peeked.value, handle)) {
      return recent.id
    }
  }
  return nowId()
}

function handleDisplayLabel(
  handle: SessionDirectoryHandle,
): string | undefined {
  if ('name' in handle && typeof handle.name === 'string') {
    const name = handle.name.trim()
    return name.length > 0 ? name : undefined
  }
  return undefined
}

function enterEditorSurface(): void {
  surface = 'editor'
  emit()
}

function readPersistedIds(): {
  libraryId: string | null
  bookId: string | null
} {
  if (!storageKey) {
    return { libraryId: null, bookId: null }
  }
  return {
    libraryId: storageKey.getItem(LIBRARY_ID_KEY),
    bookId: storageKey.getItem(ACTIVE_BOOK_KEY),
  }
}

async function defaultPickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (
    globalThis as typeof globalThis & {
      showDirectoryPicker?: (options?: {
        mode?: 'read' | 'readwrite'
      }) => Promise<FileSystemDirectoryHandle>
    }
  ).showDirectoryPicker
  if (typeof picker !== 'function') {
    return null
  }
  try {
    return await picker({ mode: 'readwrite' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }
}

function scheduleBackground(task: () => Promise<void>): void {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: {
        postTask?: (
          callback: () => void,
          options?: { priority?: string },
        ) => Promise<unknown>
      }
    }
  ).scheduler
  if (typeof scheduler?.postTask === 'function') {
    void scheduler.postTask(
      () => {
        void task()
      },
      { priority: 'background' },
    )
    return
  }
  void Promise.resolve().then(task)
}

function createEmptyLibraryBook(id: string): Book {
  const empty: Book = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    settings: {
      bleedMm: 3,
      safeMarginMm: 5,
      trim: { widthMm: 300, heightMm: 300 },
    },
    layoutGrid: {
      columns: 2,
      rows: 2,
      columnGutterMm: 5,
      rowGutterMm: 5,
      margins: { top: 15, right: 15, bottom: 15, left: 15 },
    },
    guides: [],
    assets: {},
    gallery: [],
    spreads: [],
  }
  return ['spread-1', 'spread-2', 'spread-3'].reduce<Book>(
    (book, spreadId) => addSpread(book, { id: spreadId }),
    empty,
  )
}

export function configureProjectSession(deps: ProjectSessionDeps): void {
  if (deps.session) {
    session = deps.session
  }
  if (deps.createStorage) {
    createStorageFromHandle = deps.createStorage
  }
  if (deps.pickDirectory) {
    pickDirectory = deps.pickDirectory
  }
  if (deps.storageKey) {
    storageKey = deps.storageKey
  }
  if (deps.nowId) {
    nowId = deps.nowId
  }
  if (deps.autosaveDebounceMs !== undefined) {
    autosaveDebounceMs = deps.autosaveDebounceMs
  }
}

/** Reset module singletons (unit tests). */
export function resetProjectSessionForTests(): void {
  cancelAutosaveTimer()
  void releaseHeldBookLock()
  void externalBookLockForTests?.release()
  externalBookLockForTests = null
  session = createMemorySessionState()
  createStorageFromHandle = defaultStorageFromHandle
  pickDirectory = () => Promise.resolve(null)
  storageKey = createMemoryStorageKey()
  nowId = () => crypto.randomUUID()
  autosaveDebounceMs = DEFAULT_AUTOSAVE_DEBOUNCE_MS
  storage = null
  libraryId = null
  bookId = null
  status = { kind: 'idle' }
  dirty = false
  savePhase = 'idle'
  editGeneration = 0
  ignoreBookStoreDirty = false
  accessPhase = 'idle'
  blockedBookId = null
  heldBookLock = null
  saveEpoch = 0
  surface = 'home'
  pendingRegrantLibraryId = null
  pendingRegrantBookId = null
  restorePending = false
  actionBusy = false
  homeError = null
  preferredLibraryId = null
  recentsRevision = 0
  assetSources.clear()
  resetPendingHashesForTests()
  resetEditorGestureForTests()
  lastBookRef = getBookStoreSnapshot().book
  refreshSnapshot()
}

function createMemoryStorageKey(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key) {
      return map.get(key) ?? null
    },
    key(index) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key) {
      map.delete(key)
    },
    setItem(key, value) {
      map.set(key, value)
    },
  }
}

export function subscribeProjectSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getProjectSessionSnapshot(): ProjectSessionSnapshot {
  return snapshot
}

export function isLibraryBacked(): boolean {
  return storage !== null && bookId !== null
}

/** Register an in-session AssetSource root for a library-backed import. */
export function registerAssetSource(rootId: string, source: AssetSource): void {
  assetSources.set(rootId, source)
}

export function getRegisteredAssetSource(
  rootId: string,
): AssetSource | undefined {
  return assetSources.get(rootId)
}

function bookHasContent(book: Book): boolean {
  if (book.gallery.length > 0) {
    return true
  }
  return book.spreads.some((spread) =>
    spread.frames.some((frame) => frame.assetId !== undefined),
  )
}

async function activateLoadedBook(book: Book): Promise<StorageResult<Book>> {
  if (!libraryId) {
    return { ok: false, code: 'not-found' }
  }
  const locked = await takeBookLock(book.id)
  if (!locked.ok) {
    return { ok: false, code: locked.code }
  }
  bookId = book.id
  persistIds()
  withoutDirtyTracking(() => {
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  })
  dirty = false
  savePhase = 'idle'
  cancelAutosaveTimer()
  setStatus({ kind: 'open', libraryId, bookId })
  surface = 'editor'
  setEditorStatus('Book restored')
  return { ok: true, value: book }
}

async function pickAndActivateLibraryBook(
  summaries: readonly { id: string }[],
): Promise<StorageResult<Book>> {
  if (!storage) {
    return { ok: false, code: 'not-found' }
  }
  const currentId = getBookStoreSnapshot().book.id
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
  mode: 'adopt' | 'open',
): Promise<StorageResult<void>> {
  if (mode === 'open') {
    if (!storage) {
      return { ok: false, code: 'not-found' }
    }
    const listed = await storage.listBooks()
    if (!listed.ok) {
      setStatus({ kind: 'error', code: listed.code, action: 'open library' })
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
    if (bookHasContent(getBookStoreSnapshot().book)) {
      withoutDirtyTracking(() => {
        resetBookStore({
          book: createEmptyLibraryBook(nowId()),
          sessionMeta: new Map(),
          importRunning: false,
          importExpectedCount: 0,
        })
      })
      assetSources.clear()
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
  mode: 'adopt' | 'open' = 'adopt',
): Promise<StorageResult<void>> {
  await releaseHeldBookLock()
  storage = nextStorage
  libraryId = nextLibraryId
  bookId = null
  persistIds()
  setStatus({ kind: 'open', libraryId: nextLibraryId, bookId: null })
  const activated = await withoutDirtyTrackingAsync(() =>
    activateLibraryAfterBind(mode),
  )
  if (!activated.ok) {
    storage = null
    libraryId = null
    bookId = null
    persistIds()
    setStatus({ kind: 'error', code: activated.code, action: 'open library' })
    emit()
    return activated
  }
  const remembered = await session.rememberLibraryHandle(
    nextLibraryId,
    handle,
    handleDisplayLabel(handle),
  )
  if (!remembered.ok) {
    await releaseHeldBookLock()
    storage = null
    libraryId = null
    bookId = null
    persistIds()
    accessPhase = 'idle'
    blockedBookId = null
    withoutDirtyTracking(() => {
      resetBookStore({
        book: createEmptyLibraryBook(nowId()),
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    assetSources.clear()
    dirty = false
    savePhase = 'idle'
    cancelAutosaveTimer()
    surface = 'home'
    setHomeError(
      humanMessageForCode(
        remembered.code,
        'Could not remember this library. Try again.',
      ),
    )
    setStatus({ kind: 'error', code: remembered.code, action: 'open library' })
    emit()
    return remembered
  }
  dirty = false
  savePhase = 'idle'
  cancelAutosaveTimer()
  if (accessPhase === 'permission-required') {
    accessPhase = 'idle'
  }
  surface = 'editor'
  emit()
  return { ok: true, value: undefined }
}

async function releaseOpenBookForNewLibrary(): Promise<void> {
  if (storage === null && bookId === null) {
    return
  }
  await releaseHeldBookLock()
  storage = null
  libraryId = null
  bookId = null
  persistIds()
  void session.setActiveIds({ libraryId: null, bookId: null })
  accessPhase = 'idle'
  blockedBookId = null
  withoutDirtyTracking(() => {
    resetBookStore({
      book: createEmptyLibraryBook(nowId()),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  })
  dirty = false
  savePhase = 'idle'
  cancelAutosaveTimer()
  setStatus({ kind: 'idle' })
}

export async function createLibrary(): Promise<StorageResult<void>> {
  const result = await withActionBusy(async () => {
    setHomeError(null)
    const handle = await pickDirectory()
    if (!handle) {
      setHomeError('Library folder was not selected.')
      return { ok: false as const, code: 'not-found' as const }
    }
    const flushed = await flushPendingSaveBeforeRelease()
    if (!flushed.ok) {
      return flushed
    }
    await releaseOpenBookForNewLibrary()
    const nextStorage = createStorageFromHandle(handle)
    const written = await nextStorage.updateLibrary({})
    if (!written.ok) {
      const message = humanMessageForCode(
        written.code,
        'Could not create the library folder.',
      )
      setHomeError(message)
      setStatus({ kind: 'error', code: written.code, action: 'create library' })
      return written
    }
    const nextId = await resolveLibraryIdForHandle(handle)
    return bindLibrary(nextId, handle, nextStorage, 'adopt')
  })
  return result ?? { ok: false, code: 'not-found' }
}

export async function openLibrary(): Promise<StorageResult<void>> {
  const result = await withActionBusy(async () => {
    setHomeError(null)
    const handle = await pickDirectory()
    if (!handle) {
      setHomeError('Library folder was not selected.')
      return { ok: false as const, code: 'not-found' as const }
    }
    const flushed = await flushPendingSaveBeforeRelease()
    if (!flushed.ok) {
      return flushed
    }
    const nextStorage = createStorageFromHandle(handle)
    const meta = await nextStorage.getLibrary()
    if (!meta.ok) {
      const message = humanMessageForCode(
        meta.code,
        'Could not open the library folder.',
      )
      setHomeError(message)
      setStatus({ kind: 'error', code: meta.code, action: 'open library' })
      return meta
    }
    const nextId = await resolveLibraryIdForHandle(handle)
    return bindLibrary(nextId, handle, nextStorage, 'open')
  })
  return result ?? { ok: false, code: 'not-found' }
}

/** Leave the editor: release lock, clear in-tab book id, show home. */
export async function leaveEditorForHome(): Promise<void> {
  await withActionBusy(async () => {
    const flushed = await flushPendingSaveBeforeRelease()
    if (!flushed.ok) {
      return
    }
    await releaseHeldBookLock()
    storage = null
    libraryId = null
    bookId = null
    if (storageKey) {
      storageKey.removeItem(ACTIVE_BOOK_KEY)
    }
    const active = await session.getActiveIds()
    void session.setActiveIds({
      libraryId: active.libraryId,
      bookId: null,
    })
    accessPhase = 'idle'
    blockedBookId = null
    pendingRegrantLibraryId = null
    pendingRegrantBookId = null
    withoutDirtyTracking(() => {
      resetBookStore({
        book: createEmptyLibraryBook(nowId()),
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    assetSources.clear()
    dirty = false
    savePhase = 'idle'
    cancelAutosaveTimer()
    setStatus({ kind: 'idle' })
    homeError = null
    surface = 'home'
    recentsRevision += 1
    emit()
  })
}

/** Test / e2e seam: attach an already-built storage without a directory picker. */
export async function attachLibraryForTests(options: {
  storage: LibraryStorage
  session?: SessionState
  libraryId?: string
  handle?: SessionDirectoryHandle
  mode?: 'adopt' | 'open'
}): Promise<StorageResult<void>> {
  if (options.session) {
    session = options.session
  }
  const id = options.libraryId ?? DEFAULT_LIBRARY_ID
  const handle = options.handle ?? { id: 'test-library-handle' }
  return bindLibrary(id, handle, options.storage, options.mode ?? 'adopt')
}

/** Test / e2e seam: memory library without a directory picker. */
export async function attachMemoryLibraryForTests(): Promise<
  StorageResult<void>
> {
  const next = createMemoryLibraryStorage()
  configureProjectSession({ createStorage: () => next })
  return attachLibraryForTests({ storage: next })
}

/**
 * Persist the in-memory editor book into an attached library.
 * Upgrades session assets, creates the book when missing, then marks it active.
 */
export async function adoptCurrentBookInLibrary(): Promise<
  StorageResult<Book>
> {
  if (!storage || !libraryId) {
    const failure = { ok: false as const, code: 'not-found' as const }
    setStatus({ kind: 'error', code: 'not-found', action: 'adopt book' })
    return failure
  }
  await upgradeSessionAssetsForLibrary(registerAssetSource)
  const current = getBookStoreSnapshot().book
  const existing = await storage.loadBook(current.id)
  if (existing.ok) {
    if (!bookHasContent(current)) {
      return activateLoadedBook(existing.value)
    }
    const locked = await takeBookLock(current.id)
    if (!locked.ok) {
      return { ok: false, code: locked.code }
    }
    bookId = current.id
    persistIds()
    setStatus({ kind: 'open', libraryId, bookId })
    return existing
  }
  const created = await storage.createBook(current)
  if (!created.ok) {
    setStatus({ kind: 'error', code: created.code, action: 'adopt book' })
    return created
  }
  const locked = await takeBookLock(created.value.id)
  if (!locked.ok) {
    return { ok: false, code: locked.code }
  }
  bookId = created.value.id
  persistIds()
  setStatus({ kind: 'open', libraryId, bookId })
  setEditorStatus('Book created in library')
  return created
}

export async function createBookInLibrary(): Promise<StorageResult<Book>> {
  if (!storage || !libraryId) {
    const failure = { ok: false as const, code: 'not-found' as const }
    setStatus({ kind: 'error', code: 'not-found', action: 'create book' })
    return failure
  }
  const id = nowId()
  const book = createEmptyLibraryBook(id)
  const created = await storage.createBook(book)
  if (!created.ok) {
    setStatus({ kind: 'error', code: created.code, action: 'create book' })
    return created
  }
  const locked = await takeBookLock(created.value.id)
  if (!locked.ok) {
    return { ok: false, code: locked.code }
  }
  bookId = created.value.id
  persistIds()
  withoutDirtyTracking(() => {
    resetBookStore({
      book: created.value,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  })
  dirty = false
  savePhase = 'idle'
  cancelAutosaveTimer()
  setStatus({ kind: 'open', libraryId, bookId })
  setEditorStatus('Book created')
  return created
}

function runSave(): void {
  if (!storage) {
    setStatus({ kind: 'error', code: 'not-found', action: 'save' })
    return
  }
  if (accessPhase === 'locked-elsewhere') {
    setEditorStatus(LOCK_BANNER_MESSAGE)
    return
  }
  if (savePhase === 'saving') {
    return
  }
  if (bookId === null) {
    // Manual Save may still adopt; autosave never calls this path without bookId.
    cancelAutosaveTimer()
    const epochAtStart = saveEpoch
    savePhase = 'saving'
    emit()
    const activeStorage = storage
    scheduleBackground(async () => {
      try {
        if (epochAtStart !== saveEpoch) {
          return
        }
        const adopted = await withoutDirtyTrackingAsync(() =>
          adoptCurrentBookInLibrary(),
        )
        if (!adopted.ok) {
          if (epochAtStart === saveEpoch) {
            savePhase = 'error'
            dirty = true
          }
          return
        }
        await persistBookSnapshot(activeStorage, editGeneration, epochAtStart)
      } finally {
        if (epochAtStart === saveEpoch && savePhase === 'saving') {
          savePhase = dirty ? 'pending' : 'idle'
        }
        emit()
        if (epochAtStart === saveEpoch && dirty && savePhase === 'pending') {
          armAutosaveDebounce()
        }
      }
    })
    return
  }
  cancelAutosaveTimer()
  const generationAtStart = editGeneration
  const epochAtStart = saveEpoch
  savePhase = 'saving'
  emit()
  const activeStorage = storage
  scheduleBackground(async () => {
    try {
      await persistBookSnapshot(activeStorage, generationAtStart, epochAtStart)
    } finally {
      if (epochAtStart === saveEpoch && savePhase === 'saving') {
        savePhase = dirty ? 'pending' : 'idle'
      }
      emit()
      if (epochAtStart === saveEpoch && dirty && savePhase === 'pending') {
        armAutosaveDebounce()
      }
    }
  })
}

async function persistBookSnapshot(
  activeStorage: LibraryStorage,
  generationAtStart: number,
  epochAtStart: number,
): Promise<void> {
  await awaitPendingHashes()
  if (
    epochAtStart !== saveEpoch ||
    heldBookLock === null ||
    bookId === null ||
    accessPhase === 'locked-elsewhere'
  ) {
    return
  }
  const bookSnapshot = getBookStoreSnapshot().book
  if (bookSnapshot.id !== bookId) {
    return
  }
  const result = await activeStorage.saveBook(bookSnapshot)
  if (epochAtStart !== saveEpoch) {
    return
  }
  if (!result.ok) {
    savePhase = 'error'
    dirty = true
    if (result.code === 'permission-required') {
      setPermissionRequiredAccess()
    }
    setStatus({ kind: 'error', code: result.code, action: 'save' })
    return
  }
  withoutDirtyTracking(() => {
    // Keep lastBookRef aligned if save path ever rewrites the book.
    lastBookRef = getBookStoreSnapshot().book
  })
  bookId = result.value.id
  persistIds()
  setStatus({
    kind: 'open',
    libraryId: libraryId ?? DEFAULT_LIBRARY_ID,
    bookId,
  })
  setEditorStatus('Book saved')
  if (editGeneration === generationAtStart) {
    dirty = false
    savePhase = 'idle'
  } else {
    dirty = true
    savePhase = 'pending'
  }
}

export function saveBookNow(): void {
  if (!storage) {
    setStatus({ kind: 'error', code: 'not-found', action: 'save' })
    return
  }
  if (accessPhase === 'locked-elsewhere') {
    setEditorStatus(LOCK_BANNER_MESSAGE)
    return
  }
  runSave()
}

async function requestPermissionOnHandle(
  handle: SessionDirectoryHandle,
): Promise<'granted' | 'denied' | 'unavailable'> {
  const candidate = handle as {
    requestPermission?: (options?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<PermissionState>
  }
  const requestPermission = candidate.requestPermission
  if (typeof requestPermission !== 'function') {
    return 'unavailable'
  }
  try {
    const state = await requestPermission.call(handle, { mode: 'readwrite' })
    return state === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

async function regrantWithHandle(
  handle: SessionDirectoryHandle,
  options: { requireSameAsStored?: SessionDirectoryHandle | null } = {},
): Promise<StorageResult<void>> {
  if (options.requireSameAsStored) {
    const same = await handlesReferToSameDirectory(
      options.requireSameAsStored,
      handle,
    )
    if (!same) {
      setHomeError(
        'That folder does not match the recent library. Pick the original folder.',
      )
      setStatus({ kind: 'error', code: 'not-found', action: 're-grant' })
      return { ok: false, code: 'not-found' }
    }
  }
  const midSession = bookId !== null && storage !== null
  const targetBookId = pendingRegrantBookId ?? readPersistedIds().bookId
  const nextStorage = createStorageFromHandle(handle)
  if (midSession) {
    const id = libraryId ?? DEFAULT_LIBRARY_ID
    const remembered = await session.rememberLibraryHandle(
      id,
      handle,
      handleDisplayLabel(handle),
    )
    if (!remembered.ok) {
      setStatus({ kind: 'error', code: remembered.code, action: 're-grant' })
      return remembered
    }
    storage = nextStorage
    libraryId = id
    accessPhase = 'idle'
    homeError = null
    pendingRegrantLibraryId = null
    pendingRegrantBookId = null
    emit()
    runSave()
    return { ok: true, value: undefined }
  }
  const meta = await nextStorage.getLibrary()
  if (!meta.ok) {
    setHomeError(
      humanMessageForCode(meta.code, 'Could not open the library after grant.'),
    )
    setStatus({ kind: 'error', code: meta.code, action: 're-grant' })
    return meta
  }
  const nextId =
    libraryId ??
    pendingRegrantLibraryId ??
    readPersistedIds().libraryId ??
    (await resolveLibraryIdForHandle(handle))
  const bound = await bindLibrary(nextId, handle, nextStorage, 'open')
  if (!bound.ok) {
    return bound
  }
  const bookToOpen = targetBookId
  pendingRegrantLibraryId = null
  pendingRegrantBookId = null
  homeError = null
  if (bookToOpen && storage && bookId !== bookToOpen) {
    const loaded = await storage.loadBook(bookToOpen)
    if (loaded.ok) {
      const activated = await activateLoadedBook(loaded.value)
      if (!activated.ok) {
        setHomeError(
          humanMessageForCode(
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

/**
 * One-step re-grant: requestPermission on the stored handle first; folder
 * picker only when that fails, with isSameEntry before bind.
 */
export async function regrantLibrary(): Promise<StorageResult<void>> {
  const result = await withActionBusy(async () => {
    setHomeError(null)
    const targetLibraryId =
      pendingRegrantLibraryId ?? libraryId ?? readPersistedIds().libraryId
    if (targetLibraryId) {
      const peeked = await session.peekLibraryHandle(targetLibraryId)
      if (peeked.ok) {
        const permission = await requestPermissionOnHandle(peeked.value)
        if (permission === 'granted') {
          return regrantWithHandle(peeked.value)
        }
        if (permission === 'denied') {
          setHomeError('Write permission was denied. Allow access to continue.')
          setStatus({
            kind: 'error',
            code: 'permission-required',
            action: 're-grant',
          })
          return { ok: false as const, code: 'permission-required' as const }
        }
        const picked = await pickDirectory()
        if (!picked) {
          setHomeError('Library folder was not selected.')
          return { ok: false as const, code: 'not-found' as const }
        }
        return regrantWithHandle(picked, {
          requireSameAsStored: peeked.value,
        })
      }
    }
    const handle = await pickDirectory()
    if (!handle) {
      setHomeError('Library folder was not selected.')
      return { ok: false as const, code: 'not-found' as const }
    }
    return regrantWithHandle(handle)
  })
  return result ?? { ok: false, code: 'not-found' }
}

/** Test seam: complete re-grant without a real directory picker. */
export async function regrantLibraryWithHandleForTests(
  handle: SessionDirectoryHandle = { id: 'regrant-test-handle' },
): Promise<StorageResult<void>> {
  return regrantWithHandle(handle)
}

async function opfsTestLibraryHandle(
  folderName = 'photobooks-e2e-library',
): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator.storage.getDirectory !== 'function') {
    return null
  }
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(folderName, { create: true })
}

/** E2E seam: attach an OPFS library folder without a directory picker. */
export async function attachOpfsTestLibrary(
  folderName?: string,
): Promise<StorageResult<void>> {
  const dir = await opfsTestLibraryHandle(folderName)
  if (!dir) {
    return { ok: false, code: 'not-found' }
  }
  return attachLibraryForTests({
    storage: createFsaLibraryStorage({ root: dir }),
    handle: dir,
    mode: 'adopt',
  })
}

/** E2E seam: open an existing OPFS library (load books; do not adopt empty session). */
async function openOpfsTestLibrary(
  folderName?: string,
): Promise<StorageResult<void>> {
  const dir = await opfsTestLibraryHandle(folderName)
  if (!dir) {
    return { ok: false, code: 'not-found' }
  }
  return attachLibraryForTests({
    storage: createFsaLibraryStorage({ root: dir }),
    handle: dir,
    mode: 'open',
  })
}

/** Test seam: force access chrome phase without a real FSA denial. */
export function setAccessPhaseForTests(phase: AccessPhase): void {
  accessPhase = phase
  if (phase === 'permission-required') {
    setStatus({
      kind: 'error',
      code: 'permission-required',
      action: 'restore library',
    })
    return
  }
  if (phase === 'locked-elsewhere') {
    setEditorStatus(LOCK_BANNER_MESSAGE)
    emit()
    return
  }
  emit()
}

/** Test seam: release this tab's book lock, then hold it externally. */
export async function holdExternalBookLockForTests(
  nextBookId: string,
): Promise<StorageResult<void>> {
  await releaseHeldBookLock()
  if (externalBookLockForTests) {
    await externalBookLockForTests.release()
    externalBookLockForTests = null
  }
  const acquired = await session.acquireBookLock(nextBookId)
  if (!acquired.ok) {
    return { ok: false, code: acquired.code }
  }
  externalBookLockForTests = acquired.value
  return { ok: true, value: undefined }
}

/** Test seam: try to activate a stored book (exercises lock acquire). */
export async function tryActivateLibraryBookForTests(
  nextBookId: string,
): Promise<StorageResult<Book>> {
  if (!storage || !libraryId) {
    return { ok: false, code: 'not-found' }
  }
  const loaded = await storage.loadBook(nextBookId)
  if (!loaded.ok) {
    return loaded
  }
  return activateLoadedBook(loaded.value)
}

/** Test seam: replace session with many recent libraries and stay on home. */
async function seedHomeRecentsForTests(count: number): Promise<void> {
  const next = createMemorySessionState()
  for (let i = 0; i < count; i += 1) {
    await next.rememberLibraryHandle(`lib-${String(i)}`, {
      name: `Library ${String(i).padStart(2, '0')} overflow label for scroll`,
    })
  }
  session = next
  storage = null
  libraryId = null
  bookId = null
  surface = 'home'
  accessPhase = 'idle'
  pendingRegrantLibraryId = null
  pendingRegrantBookId = null
  if (storageKey) {
    storageKey.removeItem(LIBRARY_ID_KEY)
    storageKey.removeItem(ACTIVE_BOOK_KEY)
  }
  recentsRevision += 1
  emit()
}

function shouldExposeProjectSessionTestApi(): boolean {
  if (import.meta.env.DEV) {
    return true
  }
  if (import.meta.env.VITE_E2E === '1' || import.meta.env.VITE_E2E === 'true') {
    return true
  }
  return typeof window !== 'undefined' && window.__photobooksE2e === true
}

export function exposeProjectSessionTestApi(): void {
  if (typeof window === 'undefined') {
    return
  }
  if (!shouldExposeProjectSessionTestApi()) {
    return
  }
  window.__photobooksProject = {
    attachLibraryForTests,
    attachMemoryLibraryForTests,
    attachOpfsTestLibrary,
    openOpfsTestLibrary,
    adoptCurrentBookInLibrary,
    saveBookNow,
    createBookInLibrary,
    createLibrary,
    openLibrary,
    tryRestore,
    listRecents,
    selectRecentLibrary,
    openBookFromHome,
    startSessionEditor,
    leaveEditorForHome,
    seedHomeRecentsForTests,
    regrantLibrary,
    regrantLibraryWithHandleForTests,
    setAccessPhaseForTests,
    holdExternalBookLockForTests,
    tryActivateLibraryBookForTests,
    configureProjectSession,
    getSnapshot: getProjectSessionSnapshot,
  }
}

declare global {
  interface Window {
    __photobooksProject?: {
      attachLibraryForTests: typeof attachLibraryForTests
      attachMemoryLibraryForTests: typeof attachMemoryLibraryForTests
      attachOpfsTestLibrary: typeof attachOpfsTestLibrary
      openOpfsTestLibrary: typeof openOpfsTestLibrary
      adoptCurrentBookInLibrary: typeof adoptCurrentBookInLibrary
      saveBookNow: typeof saveBookNow
      createBookInLibrary: typeof createBookInLibrary
      createLibrary: typeof createLibrary
      openLibrary: typeof openLibrary
      tryRestore: typeof tryRestore
      listRecents: typeof listRecents
      selectRecentLibrary: typeof selectRecentLibrary
      openBookFromHome: typeof openBookFromHome
      startSessionEditor: typeof startSessionEditor
      leaveEditorForHome: typeof leaveEditorForHome
      seedHomeRecentsForTests: typeof seedHomeRecentsForTests
      regrantLibrary: typeof regrantLibrary
      regrantLibraryWithHandleForTests: typeof regrantLibraryWithHandleForTests
      setAccessPhaseForTests: typeof setAccessPhaseForTests
      holdExternalBookLockForTests: typeof holdExternalBookLockForTests
      tryActivateLibraryBookForTests: typeof tryActivateLibraryBookForTests
      configureProjectSession: typeof configureProjectSession
      getSnapshot: typeof getProjectSessionSnapshot
    }
    __photobooksE2e?: boolean
  }
}

export async function listRecents(): Promise<
  StorageResult<readonly RecentLibrary[]>
> {
  try {
    return await session.listRecentLibraries()
  } catch {
    return { ok: false, code: 'not-found' }
  }
}

export async function removeRecentFromHome(
  recentLibraryId: string,
): Promise<StorageResult<void>> {
  const result = await withActionBusy(async () => {
    const cleared = await session.removeRecentLibrary(recentLibraryId)
    if (cleared.ok) {
      recentsRevision += 1
      homeError = null
      emit()
    }
    return cleared
  })
  return result ?? { ok: false, code: 'not-found' }
}

/**
 * Recall a recent library and list its books. Sets permission-required access
 * phase instead of returning an empty silent list when recall is denied.
 */
export async function selectRecentLibrary(
  recentLibraryId: string,
): Promise<StorageResult<readonly { id: string }[]>> {
  const result = await withActionBusy(async () => {
    setHomeError(null)
    let recalled: StorageResult<SessionDirectoryHandle>
    try {
      recalled = await session.recallLibraryHandle(recentLibraryId)
    } catch {
      return { ok: false as const, code: 'not-found' as const }
    }
    if (!recalled.ok) {
      if (recalled.code === 'permission-required') {
        pendingRegrantLibraryId = recentLibraryId
        pendingRegrantBookId = null
        setPermissionRequiredAccess()
        setStatus({
          kind: 'error',
          code: 'permission-required',
          action: 'open recent library',
        })
      } else {
        setHomeError(
          humanMessageForCode(
            recalled.code,
            'Could not open that recent library.',
          ),
        )
      }
      return { ok: false as const, code: recalled.code }
    }
    const nextStorage = createStorageFromHandle(recalled.value)
    const listed = await nextStorage.listBooks()
    if (!listed.ok) {
      setHomeError(humanMessageForCode(listed.code, 'Could not list books.'))
      setStatus({
        kind: 'error',
        code: listed.code,
        action: 'list books',
      })
      return listed
    }
    if (accessPhase === 'permission-required') {
      accessPhase = 'idle'
      emit()
    }
    return listed
  })
  return result ?? { ok: false, code: 'not-found' }
}

export async function openBookFromHome(
  recentLibraryId: string,
  nextBookId: string,
): Promise<StorageResult<Book>> {
  const result = await withActionBusy(async () => {
    setHomeError(null)
    let recalled: StorageResult<SessionDirectoryHandle>
    try {
      recalled = await session.recallLibraryHandle(recentLibraryId)
    } catch {
      return { ok: false as const, code: 'not-found' as const }
    }
    if (!recalled.ok) {
      if (recalled.code === 'permission-required') {
        pendingRegrantLibraryId = recentLibraryId
        pendingRegrantBookId = nextBookId
        setPermissionRequiredAccess()
        setStatus({
          kind: 'error',
          code: 'permission-required',
          action: 'open book',
        })
      } else {
        setHomeError(
          humanMessageForCode(recalled.code, 'Could not open that book.'),
        )
      }
      return { ok: false as const, code: recalled.code }
    }
    await releaseHeldBookLock()
    const nextStorage = createStorageFromHandle(recalled.value)
    storage = nextStorage
    libraryId = recentLibraryId
    bookId = null
    if (accessPhase === 'permission-required') {
      accessPhase = 'idle'
    }
    setStatus({ kind: 'open', libraryId: recentLibraryId, bookId: null })
    const loaded = await nextStorage.loadBook(nextBookId)
    if (!loaded.ok) {
      storage = null
      libraryId = null
      bookId = null
      persistIds()
      accessPhase = 'idle'
      blockedBookId = null
      surface = 'home'
      setHomeError(
        humanMessageForCode(loaded.code, 'Could not open that book.'),
      )
      setStatus({ kind: 'error', code: loaded.code, action: 'open book' })
      emit()
      return loaded
    }
    const activated = await activateLoadedBook(loaded.value)
    if (!activated.ok) {
      storage = null
      libraryId = null
      bookId = null
      persistIds()
      accessPhase = 'idle'
      blockedBookId = null
      withoutDirtyTracking(() => {
        resetBookStore({
          book: createEmptyLibraryBook(nowId()),
          sessionMeta: new Map(),
          importRunning: false,
          importExpectedCount: 0,
        })
      })
      assetSources.clear()
      surface = 'home'
      setEditorStatus('')
      setHomeError(
        humanMessageForCode(activated.code, 'Could not open that book.'),
      )
      emit()
      return activated
    }
    const remembered = await session.rememberLibraryHandle(
      recentLibraryId,
      recalled.value,
      handleDisplayLabel(recalled.value),
    )
    if (!remembered.ok) {
      await releaseHeldBookLock()
      storage = null
      libraryId = null
      bookId = null
      persistIds()
      accessPhase = 'idle'
      blockedBookId = null
      withoutDirtyTracking(() => {
        resetBookStore({
          book: createEmptyLibraryBook(nowId()),
          sessionMeta: new Map(),
          importRunning: false,
          importExpectedCount: 0,
        })
      })
      assetSources.clear()
      dirty = false
      savePhase = 'idle'
      cancelAutosaveTimer()
      surface = 'home'
      setHomeError(
        humanMessageForCode(
          remembered.code,
          'Could not remember this library. Try again.',
        ),
      )
      setStatus({ kind: 'error', code: remembered.code, action: 'open book' })
      emit()
      return remembered
    }
    surface = 'editor'
    homeError = null
    emit()
    return activated
  })
  return result ?? { ok: false, code: 'not-found' }
}

/** Enter the editor without a library (session-only editing). */
export function startSessionEditor(): void {
  enterEditorSurface()
}

async function clearStaleRestoreState(): Promise<void> {
  await releaseHeldBookLock()
  storage = null
  libraryId = null
  bookId = null
  if (storageKey) {
    storageKey.removeItem(ACTIVE_BOOK_KEY)
    storageKey.removeItem(LIBRARY_ID_KEY)
  }
  void session.setActiveIds({ libraryId: null, bookId: null })
  dirty = false
  savePhase = 'idle'
  cancelAutosaveTimer()
  accessPhase = 'idle'
  blockedBookId = null
  setStatus({ kind: 'idle' })
}

export async function tryRestore(): Promise<StorageResult<Book | null>> {
  const result = await withActionBusy(async () => {
    restorePending = true
    emit()
    try {
      cancelAutosaveTimer()
      const persisted = readPersistedIds()
      if (!persisted.bookId) {
        surface = 'home'
        accessPhase = 'idle'
        emit()
        return { ok: true as const, value: null }
      }
      surface = 'editor'
      emit()
      const id = persisted.libraryId ?? DEFAULT_LIBRARY_ID
      let recalled: StorageResult<SessionDirectoryHandle>
      try {
        recalled = await session.recallLibraryHandle(id)
      } catch {
        await clearStaleRestoreState()
        surface = 'home'
        emit()
        return { ok: true as const, value: null }
      }
      if (!recalled.ok) {
        if (recalled.code === 'permission-required') {
          await releaseHeldBookLock()
          storage = null
          bookId = null
          libraryId = null
          dirty = false
          savePhase = 'idle'
          cancelAutosaveTimer()
          surface = 'home'
          setPermissionRequiredAccess()
          setStatus({
            kind: 'error',
            code: 'permission-required',
            action: 'restore library',
          })
          return { ok: true as const, value: null }
        }
        await clearStaleRestoreState()
        surface = 'home'
        emit()
        return { ok: true as const, value: null }
      }
      const nextStorage = createStorageFromHandle(recalled.value)
      storage = nextStorage
      libraryId = id
      const loaded = await nextStorage.loadBook(persisted.bookId)
      if (!loaded.ok) {
        await clearStaleRestoreState()
        surface = 'home'
        setHomeError(
          humanMessageForCode(
            loaded.code,
            'Could not restore the previous book.',
          ),
        )
        setStatus({ kind: 'error', code: loaded.code, action: 'restore book' })
        return loaded
      }
      return await activateLoadedBook(loaded.value)
    } finally {
      try {
        const active = await session.getActiveIds()
        preferredLibraryId = active.libraryId
      } catch {
        preferredLibraryId = null
      }
      restorePending = false
      emit()
    }
  })
  return result ?? { ok: true, value: null }
}
