import type { AssetSource } from '../assets'
import { addSpread, CURRENT_SCHEMA_VERSION, type Book } from '../core'
import {
  createFsaLibraryStorage,
  createMemoryLibraryStorage,
  createMemorySessionState,
  normalizeBookTitleInput,
  type BookSummary,
  type LibraryStorage,
  type RecentLibrary,
  type SessionDirectoryHandle,
  type SessionState,
  type StorageFailureCode,
  type StorageResult,
} from '../project'
import {
  dispatchBookOp,
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
import { clearThumbsAndDerivedCacheForTests } from './clearThumbsForTests'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'
import {
  createAutosaveController,
  type SavePhase,
} from './session/autosaveController'
import {
  createBookLockController,
  LOCK_BANNER_MESSAGE,
  type BookLockController,
  type BookLockControllerHost,
} from './session/bookLockController'
import {
  browserPickDirectory,
  browserRequestReadwritePermission,
  browserTimers,
  createDefaultSession,
  defaultStorageFromHandle,
  type ProjectSessionTimers,
  type RequestReadwritePermission,
} from './session/browserProjectSessionPlatform'
import {
  createLibraryActivation,
  type LibraryActivation,
  type LibraryActivationHost,
} from './session/libraryActivation'
import { upgradeSessionAssetsForLibrary } from './upgradeSessionAssets'

const DEFAULT_LIBRARY_ID = 'library'
const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 1000

const ACTIVE_BOOK_KEY = 'photobooks.activeBookId'
const LIBRARY_ID_KEY = 'photobooks.libraryId'

type ProjectSessionStatus =
  | { kind: 'idle' }
  | { kind: 'open'; libraryId: string; bookId: string | null }
  | { kind: 'error'; code: StorageFailureCode; action: string }

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
  requestReadwritePermission?: RequestReadwritePermission
  timers?: ProjectSessionTimers
  storageKey?: Storage
  nowId?: () => string
  autosaveDebounceMs?: number
}

let session: SessionState = createDefaultSession()
let createStorageFromHandle: (root: SessionDirectoryHandle) => LibraryStorage =
  defaultStorageFromHandle
let pickDirectory: () => Promise<FileSystemDirectoryHandle | null> =
  browserPickDirectory
let requestReadwritePermission: RequestReadwritePermission =
  browserRequestReadwritePermission
let storageKey: Storage | null =
  typeof sessionStorage === 'undefined' ? null : sessionStorage
let nowId: () => string = () => crypto.randomUUID()

let storage: LibraryStorage | null = null
let libraryId: string | null = null
let bookId: string | null = null
let status: ProjectSessionStatus = { kind: 'idle' }
let dirty = false
let editGeneration = 0
let ignoreBookStoreDirty = false
let lastBookRef: Book | null = getBookStoreSnapshot().book
let autosave = createAutosaveController({
  timers: browserTimers,
  debounceMs: DEFAULT_AUTOSAVE_DEBOUNCE_MS,
  isGestureActive: isEditorGestureActive,
  awaitPendingHashes,
})
let accessPhase: AccessPhase = 'idle'
/** Bumped to invalidate in-flight saves before releasing a book lock. */
let saveEpoch = 0
let surface: ProjectSessionSurface = 'home'
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
  savePhase: autosave.getSavePhase(),
  saving: autosave.getSavePhase() === 'saving',
  accessPhase: 'idle',
  blockedBookId: null,
  surface: 'home',
  restorePending: true,
  actionBusy: false,
  recentsRevision: 0,
  homeError: null,
  preferredLibraryId: null,
}

function buildBookLockHost(): BookLockControllerHost {
  return {
    cancelAutosave: () => {
      autosave.cancel()
    },
    resetAutosave: () => {
      autosave.reset()
    },
    getSavePhase: () => autosave.getSavePhase(),
    bumpSaveEpoch: () => {
      saveEpoch += 1
    },
    clearLockedPlaceholderDocument: () => {
      withoutDirtyTracking(() => {
        resetBookStore({
          book: createEmptyLibraryBook('locked-placeholder'),
          sessionMeta: new Map(),
          importRunning: false,
          importExpectedCount: 0,
        })
      })
      dirty = false
    },
    setAccessPhase: (phase) => {
      accessPhase = phase
    },
    setBookId: (id) => {
      bookId = id
    },
    getBookId: () => bookId,
    persistIds: () => {
      persistIds()
    },
    setEditorStatus: (message) => {
      setEditorStatus(message)
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
      libraryId = id
    },
    setHomeError: (message) => {
      setHomeError(message)
    },
    setStatusError: (code, action) => {
      setStatus({ kind: 'error', code, action })
    },
    runSave: () => {
      runSave()
    },
    createStorageFromHandle: (handle) => createStorageFromHandle(handle),
    rememberLibraryHandle: (id, handle, label) =>
      session.rememberLibraryHandle(id, handle, label),
    peekLibraryHandle: (id) => session.peekLibraryHandle(id),
    handlesReferToSameDirectory: (left, right) =>
      handlesReferToSameDirectory(left, right),
    handleDisplayLabel: (handle) => handleDisplayLabel(handle),
    bindLibrary: (id, handle, nextStorage, mode) =>
      libraryActivation.bindLibrary(id, handle, nextStorage, mode),
    resolveLibraryIdForHandle: (handle) => resolveLibraryIdForHandle(handle),
    readPersistedIds: () => readPersistedIds(),
    activateLoadedBook: (book) => libraryActivation.activateLoadedBook(book),
    withActionBusy: (task) => withActionBusy(task),
    humanMessageForCode: (code, fallback) =>
      humanMessageForCode(code, fallback),
    acquireBookLock: (id) => session.acquireBookLock(id),
    pickDirectory: () => pickDirectory(),
    requestReadwritePermission: (handle) => requestReadwritePermission(handle),
  }
}

let bookLocks: BookLockController =
  createBookLockController(buildBookLockHost())

function buildLibraryActivationHost(): LibraryActivationHost {
  return {
    withActionBusy: (task) => withActionBusy(task),
    pickDirectory: () => pickDirectory(),
    createStorageFromHandle: (handle) => createStorageFromHandle(handle),
    resolveLibraryIdForHandle: (handle) => resolveLibraryIdForHandle(handle),
    flushPendingSaveBeforeRelease: () => flushPendingSaveBeforeRelease(),
    releaseHeldBookLock: () => bookLocks.releaseHeldBookLock(),
    takeBookLock: (id) => bookLocks.takeBookLock(id),
    setPendingRegrant: (nextLibraryId, nextBookId) => {
      bookLocks.setPendingRegrant(nextLibraryId, nextBookId)
    },
    clearBlockedAndPending: () => {
      bookLocks.clearBlockedAndPending()
    },
    resetAutosave: () => {
      autosave.reset()
    },
    cancelAutosave: () => {
      autosave.cancel()
    },
    persistIds: () => {
      persistIds()
    },
    clearPersistedIdKeys: () => {
      if (storageKey) {
        storageKey.removeItem(ACTIVE_BOOK_KEY)
        storageKey.removeItem(LIBRARY_ID_KEY)
      }
    },
    setActiveIds: (ids) => {
      void session.setActiveIds(ids)
    },
    getActiveIds: () => session.getActiveIds(),
    rememberLibraryHandle: (id, handle, label) =>
      session.rememberLibraryHandle(id, handle, label),
    recallLibraryHandle: (id) => session.recallLibraryHandle(id),
    handleDisplayLabel: (handle) => handleDisplayLabel(handle),
    humanMessageForCode: (code, fallback) =>
      humanMessageForCode(code, fallback),
    setHomeError: (message) => {
      setHomeError(message)
    },
    setStatus: (next) => {
      setStatus(next)
    },
    setEditorStatus: (message) => {
      setEditorStatus(message)
    },
    setPermissionRequiredAccess: () => {
      setPermissionRequiredAccess()
    },
    getAccessPhase: () => accessPhase,
    setAccessPhase: (phase) => {
      accessPhase = phase
    },
    setSurface: (next) => {
      surface = next
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
      libraryId = id
    },
    getBookId: () => bookId,
    setBookId: (id) => {
      bookId = id
    },
    setDirty: (next) => {
      dirty = next
    },
    getBook: () => getBookStoreSnapshot().book,
    resetBookStore: (book) => {
      resetBookStore({
        book,
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    },
    withoutDirtyTracking: (fn) => {
      withoutDirtyTracking(fn)
    },
    withoutDirtyTrackingAsync: (fn) => withoutDirtyTrackingAsync(fn),
    clearAssetSources: () => {
      assetSources.clear()
    },
    createEmptyLibraryBook: (id) => createEmptyLibraryBook(id),
    nowId: () => nowId(),
    upgradeSessionAssets: () =>
      upgradeSessionAssetsForLibrary(registerAssetSource),
    readPersistedIds: () => readPersistedIds(),
    setRestorePending: (next) => {
      restorePending = next
    },
    setPreferredLibraryId: (id) => {
      preferredLibraryId = id
    },
    defaultLibraryId: () => DEFAULT_LIBRARY_ID,
  }
}

let libraryActivation: LibraryActivation = createLibraryActivation(
  buildLibraryActivationHost(),
)
bookLocks.setHost(buildBookLockHost())

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
  const savePhase = autosave.getSavePhase()
  const next: ProjectSessionSnapshot = {
    libraryOpen: storage !== null,
    bookId,
    libraryId,
    status,
    dirty,
    savePhase,
    saving: savePhase === 'saving',
    accessPhase,
    blockedBookId: bookLocks.getBlockedBookId(),
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
  const phase = autosave.getSavePhase()
  if (phase === 'error') {
    setEditorStatus(
      'Could not save changes. Fix the save error before leaving the editor.',
    )
    emit()
    return { ok: false, code: 'not-found' }
  }
  if (
    storage === null ||
    bookId === null ||
    !bookLocks.hasHeldBookLock() ||
    (!dirty && phase !== 'pending' && phase !== 'saving')
  ) {
    return { ok: true, value: undefined }
  }
  const generationAtStart = editGeneration
  const epochAtStart = saveEpoch
  autosave.ensureSaving()
  emit()
  await persistBookSnapshot(storage, generationAtStart, epochAtStart)
  if (epochAtStart !== saveEpoch) {
    return { ok: false, code: 'not-found' }
  }
  if (dirty) {
    autosave.failSaving()
    setEditorStatus(
      'Could not save changes. Fix the save error before leaving the editor.',
    )
    emit()
    return { ok: false, code: 'not-found' }
  }
  autosave.reset()
  emit()
  return { ok: true, value: undefined }
}

function releaseHeldBookLock(): Promise<void> {
  return bookLocks.releaseHeldBookLock()
}

function takeBookLock(nextBookId: string): Promise<StorageResult<void>> {
  return bookLocks.takeBookLock(nextBookId)
}

function setPermissionRequiredAccess(): void {
  accessPhase = 'permission-required'
  emit()
}

function canArmAutosave(): boolean {
  return storage !== null && bookId !== null && dirty
}

function armAutosaveDebounce(): void {
  if (autosave.arm(canArmAutosave(), () => dirty, runSave)) {
    emit()
  }
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
  autosave.markPendingFromError()
  if (autosave.getSavePhase() !== 'saving') {
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
  if (autosave.onGestureIdle(canArmAutosave(), () => dirty, runSave)) {
    emit()
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

function createEmptyLibraryBook(id: string, title?: string): Book {
  const empty: Book = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    ...(title !== undefined ? { title } : {}),
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
  if (deps.requestReadwritePermission) {
    requestReadwritePermission = deps.requestReadwritePermission
  }
  bookLocks.setHost(buildBookLockHost())
  libraryActivation.setHost(buildLibraryActivationHost())
  if (deps.timers) {
    autosave.setTimers(deps.timers)
  }
  if (deps.storageKey) {
    storageKey = deps.storageKey
  }
  if (deps.nowId) {
    nowId = deps.nowId
  }
  if (deps.autosaveDebounceMs !== undefined) {
    autosave.setDebounceMs(deps.autosaveDebounceMs)
  }
}

/** Reset module singletons (unit tests). */
export function resetProjectSessionForTests(): void {
  autosave.reset()
  void bookLocks.releaseHeldBookLock()
  void bookLocks.releaseExternalBookLock()
  session = createMemorySessionState()
  createStorageFromHandle = defaultStorageFromHandle
  pickDirectory = () => Promise.resolve(null)
  requestReadwritePermission = browserRequestReadwritePermission
  storageKey = createMemoryStorageKey()
  nowId = () => crypto.randomUUID()
  autosave = createAutosaveController({
    timers: browserTimers,
    debounceMs: DEFAULT_AUTOSAVE_DEBOUNCE_MS,
    isGestureActive: isEditorGestureActive,
    awaitPendingHashes,
  })
  storage = null
  libraryId = null
  bookId = null
  status = { kind: 'idle' }
  dirty = false
  editGeneration = 0
  ignoreBookStoreDirty = false
  accessPhase = 'idle'
  saveEpoch = 0
  surface = 'home'
  restorePending = false
  actionBusy = false
  homeError = null
  preferredLibraryId = null
  recentsRevision = 0
  bookLocks = createBookLockController(buildBookLockHost())
  libraryActivation = createLibraryActivation(buildLibraryActivationHost())
  bookLocks.setHost(buildBookLockHost())
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

function bindLibrary(
  nextLibraryId: string,
  handle: SessionDirectoryHandle,
  nextStorage: LibraryStorage,
  mode: 'adopt' | 'open' = 'adopt',
): Promise<StorageResult<void>> {
  return libraryActivation.bindLibrary(nextLibraryId, handle, nextStorage, mode)
}

export async function createLibrary(): Promise<StorageResult<void>> {
  return libraryActivation.createLibrary()
}

export async function openLibrary(): Promise<StorageResult<void>> {
  return libraryActivation.openLibrary()
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
    bookLocks.clearBlockedAndPending()
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
    autosave.reset()
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

export async function adoptCurrentBookInLibrary(): Promise<
  StorageResult<Book>
> {
  return libraryActivation.adoptCurrentBookInLibrary()
}

export async function createBookInLibrary(
  title?: string,
): Promise<StorageResult<Book>> {
  if (!storage || !libraryId) {
    const failure = { ok: false as const, code: 'not-found' as const }
    setStatus({ kind: 'error', code: 'not-found', action: 'create book' })
    return failure
  }
  const id = nowId()
  const normalized =
    title === undefined ? undefined : normalizeBookTitleInput(title)
  const book = createEmptyLibraryBook(id, normalized)
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
  autosave.reset()
  setStatus({ kind: 'open', libraryId, bookId })
  setEditorStatus('Book created')
  return created
}

function finishSaveAttempt(epochAtStart: number): void {
  if (epochAtStart === saveEpoch) {
    autosave.completeSavingIfSaving(dirty)
  }
  emit()
  if (
    epochAtStart === saveEpoch &&
    dirty &&
    autosave.getSavePhase() === 'pending'
  ) {
    armAutosaveDebounce()
  }
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
  if (!autosave.beginSaving()) {
    return
  }
  if (bookId === null) {
    // Manual Save may still adopt; autosave never calls this path without bookId.
    const epochAtStart = saveEpoch
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
            autosave.failSaving()
            dirty = true
          }
          return
        }
        await persistBookSnapshot(activeStorage, editGeneration, epochAtStart)
      } finally {
        finishSaveAttempt(epochAtStart)
      }
    })
    return
  }
  const generationAtStart = editGeneration
  const epochAtStart = saveEpoch
  emit()
  const activeStorage = storage
  scheduleBackground(async () => {
    try {
      await persistBookSnapshot(activeStorage, generationAtStart, epochAtStart)
    } finally {
      finishSaveAttempt(epochAtStart)
    }
  })
}

async function persistBookSnapshot(
  activeStorage: LibraryStorage,
  generationAtStart: number,
  epochAtStart: number,
): Promise<void> {
  await autosave.waitForPendingHashes()
  if (
    epochAtStart !== saveEpoch ||
    !bookLocks.hasHeldBookLock() ||
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
    autosave.failSaving()
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
    autosave.settleAfterPersist(false)
  } else {
    dirty = true
    autosave.settleAfterPersist(true)
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

/**
 * One-step re-grant: requestPermission on the stored handle first; folder
 * picker only when that fails, with isSameEntry before bind.
 */
export function regrantLibrary(): Promise<StorageResult<void>> {
  return bookLocks.regrantLibrary()
}

/** Test seam: complete re-grant without a real directory picker. */
export function regrantLibraryWithHandleForTests(
  handle: SessionDirectoryHandle = { id: 'regrant-test-handle' },
): Promise<StorageResult<void>> {
  return bookLocks.regrantWithHandle(handle)
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
export function holdExternalBookLockForTests(
  nextBookId: string,
): Promise<StorageResult<void>> {
  return bookLocks.holdExternalBookLock(nextBookId)
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
  return libraryActivation.activateLoadedBook(loaded.value)
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
  bookLocks.setPendingRegrant(null, null)
  if (storageKey) {
    storageKey.removeItem(LIBRARY_ID_KEY)
    storageKey.removeItem(ACTIVE_BOOK_KEY)
  }
  recentsRevision += 1
  emit()
}

export interface ProjectSessionTestEnv {
  DEV?: boolean
  VITE_E2E?: string
}

/** Pure gate shared by `__photobooksProject` and `__photobooksThumbs`. */
export function shouldExposeProjectSessionTestApi(
  env: ProjectSessionTestEnv = import.meta.env,
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
): boolean {
  if (env.DEV) {
    return true
  }
  if (env.VITE_E2E === '1' || env.VITE_E2E === 'true') {
    return true
  }
  return win?.__photobooksE2e === true
}

export function exposeProjectSessionTestApi(
  env: ProjectSessionTestEnv = import.meta.env,
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
): void {
  if (win === undefined) {
    return
  }
  if (!shouldExposeProjectSessionTestApi(env, win)) {
    return
  }
  win.__photobooksThumbs = { clearThumbsAndDerivedCacheForTests }
  win.__photobooksProject = {
    attachLibraryForTests,
    attachMemoryLibraryForTests,
    attachOpfsTestLibrary,
    openOpfsTestLibrary,
    adoptCurrentBookInLibrary,
    saveBookNow,
    createBookInLibrary,
    renameBookInLibrary,
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
  void import('./relink').then((relink) => {
    relink.exposeRelinkTestApi(win)
  })
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
      renameBookInLibrary: typeof renameBookInLibrary
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
    __photobooksThumbs?: {
      clearThumbsAndDerivedCacheForTests: () => Promise<void>
    }
    __photobooksRelink?: {
      detectMissingAssets: (options?: { openDialog?: boolean }) => {
        missing: number
      }
      rescanRelinkFiles: (
        files: readonly File[],
        options?: { sourceRootId?: string },
      ) => Promise<unknown>
      resolvePendingRelink: () => Promise<number>
      resetRelinkStore: () => void
      setRelinkDialogOpen: (open: boolean) => void
      setRelinkProgress: (
        next: {
          total: number
          completed: number
          running: boolean
        } | null,
      ) => void
      problemAssetIds: () => string[]
      clearLiveAssetSources: () => void
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

export async function selectRecentLibrary(
  recentLibraryId: string,
): Promise<StorageResult<readonly BookSummary[]>> {
  return libraryActivation.selectRecentLibrary(recentLibraryId)
}

export async function renameBookInLibrary(
  targetBookId: string,
  title: string,
  recentLibraryId?: string,
): Promise<StorageResult<void>> {
  const normalized = normalizeBookTitleInput(title)
  if (storage !== null && bookId === targetBookId) {
    // Local string update; autosave persists (same dirty path as other edits).
    dispatchBookOp({ type: 'setTitle', title: normalized })
    return { ok: true, value: undefined }
  }

  let targetStorage = storage
  if (targetStorage === null) {
    if (recentLibraryId === undefined) {
      const failure = { ok: false as const, code: 'not-found' as const }
      setStatus({ kind: 'error', code: 'not-found', action: 'rename book' })
      setHomeError('Could not rename book.')
      return failure
    }
    let recalled: StorageResult<SessionDirectoryHandle>
    try {
      recalled = await session.recallLibraryHandle(recentLibraryId)
    } catch {
      recalled = { ok: false, code: 'not-found' }
    }
    if (!recalled.ok) {
      setStatus({
        kind: 'error',
        code: recalled.code,
        action: 'rename book',
      })
      setHomeError(humanMessageForCode(recalled.code, 'Could not rename book.'))
      return { ok: false, code: recalled.code }
    }
    targetStorage = createStorageFromHandle(recalled.value)
  }

  // Same book lock as open: load+save without it races another tab's autosave.
  const lockResult = await session.acquireBookLock(targetBookId)
  if (!lockResult.ok) {
    setStatus({
      kind: 'error',
      code: lockResult.code,
      action: 'rename book',
    })
    setHomeError(humanMessageForCode(lockResult.code, 'Could not rename book.'))
    return { ok: false, code: lockResult.code }
  }
  try {
    const loaded = await targetStorage.loadBook(targetBookId)
    if (!loaded.ok) {
      setStatus({ kind: 'error', code: loaded.code, action: 'rename book' })
      setHomeError(humanMessageForCode(loaded.code, 'Could not rename book.'))
      return { ok: false, code: loaded.code }
    }
    if ((loaded.value.title ?? '') === normalized) {
      return { ok: true, value: undefined }
    }
    const next = { ...loaded.value, title: normalized }
    const saved = await targetStorage.saveBook(next)
    if (!saved.ok) {
      setStatus({ kind: 'error', code: saved.code, action: 'rename book' })
      setHomeError(humanMessageForCode(saved.code, 'Could not rename book.'))
      return { ok: false, code: saved.code }
    }
    setEditorStatus('Book renamed')
    return { ok: true, value: undefined }
  } finally {
    await lockResult.value.release()
  }
}

export async function openBookFromHome(
  recentLibraryId: string,
  nextBookId: string,
): Promise<StorageResult<Book>> {
  return libraryActivation.openBookFromHome(recentLibraryId, nextBookId)
}

/** Enter the editor without a library (session-only editing). */
export function startSessionEditor(): void {
  enterEditorSurface()
}

export async function tryRestore(): Promise<StorageResult<Book | null>> {
  return libraryActivation.tryRestore()
}
