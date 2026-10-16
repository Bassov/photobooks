import type { AssetSource } from '../assets'
import { addSpread, CURRENT_SCHEMA_VERSION, type Book } from '../core'
import {
  createBrowserSessionState,
  createFsaLibraryStorage,
  createMemoryLibraryStorage,
  createMemorySessionState,
  fromFileSystemDirectoryHandle,
  type LibraryStorage,
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
  }
  if (
    next.libraryOpen === snapshot.libraryOpen &&
    next.bookId === snapshot.bookId &&
    next.libraryId === snapshot.libraryId &&
    next.status === snapshot.status &&
    next.dirty === snapshot.dirty &&
    next.savePhase === snapshot.savePhase &&
    next.saving === snapshot.saving
  ) {
    return false
  }
  snapshot = next
  return true
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
  if (storage === null || bookId === null) {
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
  if (!storageKey) {
    return
  }
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

function activateLoadedBook(book: Book): StorageResult<Book> {
  if (!libraryId) {
    return { ok: false, code: 'not-found' }
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
      return activateLoadedBook(loaded.value)
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
  if (mode === 'open' && !bookHasContent(getBookStoreSnapshot().book)) {
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
  const remembered = await session.rememberLibraryHandle(nextLibraryId, handle)
  if (!remembered.ok) {
    setStatus({ kind: 'error', code: remembered.code, action: 'open library' })
    return remembered
  }
  storage = nextStorage
  libraryId = nextLibraryId
  bookId = null
  persistIds()
  setStatus({ kind: 'open', libraryId: nextLibraryId, bookId: null })
  const activated = await withoutDirtyTrackingAsync(() =>
    activateLibraryAfterBind(mode),
  )
  if (!activated.ok) {
    return activated
  }
  dirty = false
  savePhase = 'idle'
  cancelAutosaveTimer()
  emit()
  return { ok: true, value: undefined }
}

export async function createLibrary(): Promise<StorageResult<void>> {
  const handle = await pickDirectory()
  if (!handle) {
    return { ok: false, code: 'not-found' }
  }
  const nextStorage = createStorageFromHandle(handle)
  const written = await nextStorage.updateLibrary({})
  if (!written.ok) {
    setStatus({ kind: 'error', code: written.code, action: 'create library' })
    return written
  }
  return bindLibrary(DEFAULT_LIBRARY_ID, handle, nextStorage, 'adopt')
}

export async function openLibrary(): Promise<StorageResult<void>> {
  const handle = await pickDirectory()
  if (!handle) {
    return { ok: false, code: 'not-found' }
  }
  const nextStorage = createStorageFromHandle(handle)
  const meta = await nextStorage.getLibrary()
  if (!meta.ok) {
    setStatus({ kind: 'error', code: meta.code, action: 'open library' })
    return meta
  }
  return bindLibrary(DEFAULT_LIBRARY_ID, handle, nextStorage, 'open')
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
  if (savePhase === 'saving') {
    return
  }
  if (bookId === null) {
    // Manual Save may still adopt; autosave never calls this path without bookId.
    cancelAutosaveTimer()
    savePhase = 'saving'
    emit()
    const activeStorage = storage
    scheduleBackground(async () => {
      try {
        const adopted = await withoutDirtyTrackingAsync(() =>
          adoptCurrentBookInLibrary(),
        )
        if (!adopted.ok) {
          savePhase = 'error'
          dirty = true
          return
        }
        await persistBookSnapshot(activeStorage, editGeneration)
      } finally {
        if (savePhase === 'saving') {
          savePhase = dirty ? 'pending' : 'idle'
        }
        emit()
        if (dirty && savePhase === 'pending') {
          armAutosaveDebounce()
        }
      }
    })
    return
  }
  cancelAutosaveTimer()
  const generationAtStart = editGeneration
  savePhase = 'saving'
  emit()
  const activeStorage = storage
  scheduleBackground(async () => {
    try {
      await persistBookSnapshot(activeStorage, generationAtStart)
    } finally {
      if (savePhase === 'saving') {
        savePhase = dirty ? 'pending' : 'idle'
      }
      emit()
      if (dirty && savePhase === 'pending') {
        armAutosaveDebounce()
      }
    }
  })
}

async function persistBookSnapshot(
  activeStorage: LibraryStorage,
  generationAtStart: number,
): Promise<void> {
  await awaitPendingHashes()
  const bookSnapshot = getBookStoreSnapshot().book
  const result = await activeStorage.saveBook(bookSnapshot)
  if (!result.ok) {
    savePhase = 'error'
    dirty = true
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
  runSave()
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

export function exposeProjectSessionTestApi(): void {
  if (typeof window === 'undefined') {
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
    tryRestore,
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
      tryRestore: typeof tryRestore
      getSnapshot: typeof getProjectSessionSnapshot
    }
  }
}

export async function tryRestore(): Promise<StorageResult<Book | null>> {
  cancelAutosaveTimer()
  const persisted = readPersistedIds()
  const id = persisted.libraryId ?? DEFAULT_LIBRARY_ID
  let recalled: StorageResult<SessionDirectoryHandle>
  try {
    recalled = await session.recallLibraryHandle(id)
  } catch {
    return { ok: true, value: null }
  }
  if (!recalled.ok) {
    if (recalled.code === 'permission-required') {
      setStatus({
        kind: 'error',
        code: 'permission-required',
        action: 'restore library',
      })
    }
    return { ok: true, value: null }
  }
  const nextStorage = createStorageFromHandle(recalled.value)
  storage = nextStorage
  libraryId = id
  const activeBookId = persisted.bookId
  if (!activeBookId) {
    persistIds()
    setStatus({ kind: 'open', libraryId: id, bookId: null })
    return { ok: true, value: null }
  }
  const loaded = await nextStorage.loadBook(activeBookId)
  if (!loaded.ok) {
    setStatus({ kind: 'error', code: loaded.code, action: 'restore book' })
    return loaded
  }
  bookId = loaded.value.id
  persistIds()
  withoutDirtyTracking(() => {
    resetBookStore({
      book: loaded.value,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  })
  dirty = false
  savePhase = 'idle'
  cancelAutosaveTimer()
  setStatus({ kind: 'open', libraryId: id, bookId })
  setEditorStatus('Book restored')
  return loaded
}
