import {
  addSpread,
  applyBookOp,
  CURRENT_SCHEMA_VERSION,
  defaultCover,
  defaultEndpapers,
  bookHasAnyPlacement,
  placementCountByAsset,
  resolveSpread,
  type Asset,
  type Book,
  type BookOp,
  type ResolvedSpread,
  type Spread,
} from '../core'
import { tryCacheKeyFromAsset } from '../assets/cacheKey'
import { setBookUsedAssetIds, setDecodeImportActive } from '../photo/assetPool'
import type { ExifOrientation } from '../photo/types'
import {
  canRedo,
  canUndo,
  coalesceKey,
  EMPTY_HISTORY,
  isUndoableOp,
  opLabel,
  recordStep,
  redoLabel,
  redoStep,
  snapshotOf,
  undoLabel,
  undoStep,
  type History,
  type HistoryMove,
} from './bookHistory'
import { setEditorStatus, unplacedFromSpreadStatus } from './editorStatus'
import { parseCapturedAtMs } from './galleryView'
import {
  filmstripScrollQuietRemainingMs,
  isFilmstripScrollQuiet,
} from './filmstripScrollQuiet'

export interface AssetSessionMeta {
  name: string
  correctedWidth: number
  correctedHeight: number
  orientation: ExifOrientation
  aspect: number
}

export interface BookStoreState {
  book: Book
  sessionMeta: ReadonlyMap<string, AssetSessionMeta>
  /** Synthetic or cached preview URLs keyed by asset id. Not part of the document. */
  previewUrls: ReadonlyMap<string, string>
  importRunning: boolean
  /** Reserved filmstrip scroll width in items (avoids per-chunk spacer layout). */
  importExpectedCount: number
}

export interface SpreadPaintSnapshot {
  resolved: ResolvedSpread
  previewUrlFor: (assetId: string) => string | undefined
}

type BookStoreInit = Omit<BookStoreState, 'previewUrls'> & {
  previewUrls?: BookStoreState['previewUrls']
}

const GALLERY_FLUSH_CHUNK = 4
/**
 * Cap session-meta (aspect) publishes per flush. Gallery ids already chunk;
 * unbounded meta used to rebuild the whole filmstrip prefix in one frame
 * when decode results land during scroll-during-import.
 */
const META_FLUSH_CHUNK = 1

function createSessionBook(): Book {
  const empty: Book = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'session-book',
    cover: defaultCover(''),
    endpapers: defaultEndpapers(),
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
    (book, id) => addSpread(book, { id }),
    empty,
  )
}

type Listener = () => void

let state: BookStoreState = {
  book: createSessionBook(),
  sessionMeta: new Map(),
  previewUrls: new Map(),
  importRunning: false,
  importExpectedCount: 0,
}

const listeners = new Set<Listener>()
const spreadListeners = new Map<string, Set<Listener>>()

interface CachedSpreadPaint extends SpreadPaintSnapshot {
  spread: Spread
  inputKey: string
}

const paintCache = new Map<string, CachedSpreadPaint>()
let assetSeq = 0
let flushScheduled = false
let flushWatchdogTimer: ReturnType<typeof setTimeout> | undefined
/** Separate from rAF flush scheduling so scroll-quiet waits do not race it. */
let quietFlushTimer: ReturnType<typeof setTimeout> | undefined
let pendingGalleryIds: string[] = []
let pendingMeta = new Map<string, AssetSessionMeta>()
let pendingAssetRecords = new Map<string, Asset>()
/** Patches that arrived before enqueueGalleryAssets (hash-before-flush race). */
let pendingAssetPatches = new Map<string, Partial<Asset>>()
/** Ids removed after a failed decode — late hash patches must not resurrect them. */
const droppedImportIds = new Set<string>()

const galleryListeners = new Set<Listener>()

const DEFAULT_ASPECT = 1
let galleryAspectsSnapshot: readonly number[] = Object.freeze([])
let galleryAspectsFor: readonly string[] | null = null
let galleryAspectsMeta: ReadonlyMap<string, AssetSessionMeta> | null = null
let galleryNamesSnapshot: readonly string[] = Object.freeze([])
let galleryNamesFor: readonly string[] | null = null
let galleryNamesMeta: ReadonlyMap<string, AssetSessionMeta> | null = null

function invalidateGalleryAspectsCache(): void {
  galleryAspectsFor = null
  galleryAspectsMeta = null
  galleryNamesFor = null
  galleryNamesMeta = null
}

function sessionMetaEqual(a: AssetSessionMeta, b: AssetSessionMeta): boolean {
  return (
    a.name === b.name &&
    a.correctedWidth === b.correctedWidth &&
    a.correctedHeight === b.correctedHeight &&
    a.orientation === b.orientation &&
    a.aspect === b.aspect
  )
}

/** True when every key in `patch` already matches `existing` by `Object.is`. */
function assetPatchNoOp(
  existing: Partial<Asset>,
  patch: Partial<Asset>,
): boolean {
  for (const key of Object.keys(patch) as (keyof Asset)[]) {
    if (!Object.is(existing[key], patch[key])) {
      return false
    }
  }
  return true
}

function emit(): void {
  syncBookUsedDecodeIds(state.book)
  for (const listener of listeners) {
    listener()
  }
}

/** Coalesce bookStore emits onto rAF while import is running (hash patches). */
let emitCoalesceRaf: number | null = null

function scheduleEmit(): void {
  if (emitCoalesceRaf !== null) {
    return
  }
  emitCoalesceRaf = requestAnimationFrame(() => {
    emitCoalesceRaf = null
    emit()
  })
}

function flushScheduledEmit(): void {
  if (emitCoalesceRaf === null) {
    return
  }
  cancelAnimationFrame(emitCoalesceRaf)
  emitCoalesceRaf = null
  emit()
}

function emitGallery(): void {
  for (const listener of galleryListeners) {
    listener()
  }
  emit()
}

/**
 * Take meta for this frame: always include entries for gallery ids being
 * flushed, then at most {@link META_FLUSH_CHUNK} decode/refine updates when
 * the flush is meta-only (gallery already mounted).
 */
function takePendingMetaBatch(
  galleryIds: readonly string[],
): Map<string, AssetSessionMeta> {
  const batch = new Map<string, AssetSessionMeta>()
  for (const id of galleryIds) {
    const meta = pendingMeta.get(id)
    // enqueueGalleryAssets always pairs meta with the id; skip only if a
    // caller cleared pending meta before the gallery row flushed.
    if (meta !== undefined) {
      pendingMeta.delete(id)
      batch.set(id, meta)
    }
  }
  if (galleryIds.length > 0) {
    return batch
  }
  for (const [id, meta] of pendingMeta) {
    if (batch.size >= META_FLUSH_CHUNK) {
      break
    }
    pendingMeta.delete(id)
    batch.set(id, meta)
  }
  return batch
}

function scheduleFlushAfterQuiet(delayMs: number): void {
  clearTimeout(quietFlushTimer)
  quietFlushTimer = setTimeout(
    () => {
      quietFlushTimer = undefined
      flushPendingGalleryAndMeta()
    },
    Math.max(0, delayMs),
  )
}

function flushPendingGalleryAndMeta(): void {
  // Meta-only publishes rebuild filmstrip aspects/prefix; defer them while the
  // strip is scrolling so decode ticks do not LoAF scroll-during-import.
  // Gallery row flushes still proceed (list-first placeholders).
  if (
    pendingGalleryIds.length === 0 &&
    pendingMeta.size > 0 &&
    isFilmstripScrollQuiet()
  ) {
    scheduleFlushAfterQuiet(filmstripScrollQuietRemainingMs())
    return
  }
  const ids = pendingGalleryIds.splice(0, GALLERY_FLUSH_CHUNK)
  const metaBatch = takePendingMetaBatch(ids)
  if (ids.length === 0 && metaBatch.size === 0) {
    if (pendingGalleryIds.length > 0 || pendingMeta.size > 0) {
      scheduleFlush()
    }
    return
  }
  let book = state.book
  let galleryChanged = false
  if (ids.length > 0) {
    book = applyBookOp(book, { type: 'addToGallery', assetIds: ids })
    if (pendingAssetRecords.size > 0) {
      let assets = book.assets
      let assetsChanged = false
      for (const id of ids) {
        const record = pendingAssetRecords.get(id)
        if (record === undefined) {
          continue
        }
        pendingAssetRecords.delete(id)
        assets = { ...assets, [id]: { ...assets[id], ...record } }
        assetsChanged = true
      }
      if (assetsChanged) {
        book = { ...book, assets }
      }
    }
    galleryChanged = book.gallery !== state.book.gallery
  }
  let sessionMeta = state.sessionMeta
  const metaUpdates: [string, AssetSessionMeta][] = []
  for (const [id, meta] of metaBatch) {
    const prevMeta = sessionMeta.get(id)
    if (prevMeta !== undefined && sessionMetaEqual(prevMeta, meta)) {
      continue
    }
    metaUpdates.push([id, meta])
  }
  const metaChanged = metaUpdates.length > 0
  if (metaChanged) {
    const nextMeta = new Map(sessionMeta)
    for (const [id, meta] of metaUpdates) {
      nextMeta.set(id, meta)
    }
    sessionMeta = nextMeta
  }
  if (!galleryChanged && !metaChanged && book === state.book) {
    if (pendingGalleryIds.length > 0 || pendingMeta.size > 0) {
      scheduleFlush()
    }
    return
  }
  const prev = state
  state = {
    book,
    sessionMeta,
    previewUrls: state.previewUrls,
    importRunning: state.importRunning,
    importExpectedCount: state.importExpectedCount,
  }
  // Gallery / sessionMeta identity changes already bust aspect/name snapshots.
  notifyAffectedSpreads(prev, state)
  if (galleryChanged) {
    emitGallery()
  } else {
    emit()
  }
  if (pendingGalleryIds.length > 0 || pendingMeta.size > 0) {
    scheduleFlush()
  }
}

/** Watchdog if rAF is frozen (background tab under parallel Playwright). */
const FLUSH_RAF_WATCHDOG_MS = 32

function scheduleFlush(): void {
  if (flushScheduled) {
    return
  }
  flushScheduled = true
  const run = (): void => {
    if (!flushScheduled) {
      return
    }
    flushScheduled = false
    if (flushWatchdogTimer !== undefined) {
      clearTimeout(flushWatchdogTimer)
      flushWatchdogTimer = undefined
    }
    flushPendingGalleryAndMeta()
  }
  // Prefer rAF for LoAF pacing when the tab is visible. A short setTimeout
  // watchdog still fires if rAF is frozen after the page was backgrounded.
  // Clear the watchdog in `run` so a stale timer cannot flush a later batch
  // early after rAF already ran and scheduleFlush armed a new pair.
  requestAnimationFrame(run)
  flushWatchdogTimer = setTimeout(run, FLUSH_RAF_WATCHDOG_MS)
}

export function subscribeBookStore(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Subscribe only to gallery identity changes (not session meta). */
export function subscribeGallery(listener: Listener): () => void {
  galleryListeners.add(listener)
  return () => {
    galleryListeners.delete(listener)
  }
}

export function getGalleryIdsSnapshot(): readonly string[] {
  return state.book.gallery
}

/** Relative path → asset id for flushed gallery plus still-pending enqueue records. */
export function getGalleryRelativePathIndex(): Map<string, string> {
  const map = new Map<string, string>()
  for (const assetId of state.book.gallery) {
    const path = state.book.assets[assetId]?.relativePath
    if (typeof path === 'string' && path !== '') {
      map.set(path, assetId)
    }
  }
  for (const [assetId, asset] of pendingAssetRecords) {
    const path = asset.relativePath
    if (typeof path === 'string' && path !== '') {
      map.set(path, assetId)
    }
  }
  return map
}

export function getSpacerCountSnapshot(): number {
  return Math.max(state.book.gallery.length, state.importExpectedCount)
}

/** Per-asset aspect for filmstrip slots; defaults to 1 when meta is missing. */
export function getAssetAspectSnapshot(assetId: string): number {
  return state.sessionMeta.get(assetId)?.aspect ?? DEFAULT_ASPECT
}

/** Optional content hash from the book asset record; undefined when unset. */
export function getAssetContentHash(assetId: string): string | undefined {
  return (
    state.book.assets[assetId]?.contentHash ??
    pendingAssetRecords.get(assetId)?.contentHash ??
    pendingAssetPatches.get(assetId)?.contentHash
  )
}

/**
 * DerivedCache key from durable identity (path/size/mtime/root).
 * Undefined until identity is complete — not file-byte contentHash.
 */
export function getAssetCacheKey(assetId: string): string | undefined {
  const book = state.book.assets[assetId]
  const pending = pendingAssetRecords.get(assetId)
  const patch = pendingAssetPatches.get(assetId)
  return tryCacheKeyFromAsset({
    sourceRootId:
      book?.sourceRootId ?? pending?.sourceRootId ?? patch?.sourceRootId,
    relativePath:
      book?.relativePath ?? pending?.relativePath ?? patch?.relativePath,
    byteSize: book?.byteSize ?? pending?.byteSize ?? patch?.byteSize,
    mtimeMs: book?.mtimeMs ?? pending?.mtimeMs ?? patch?.mtimeMs,
  })
}

/** Merge identity fields onto an existing gallery asset record. */
export function patchAssetRecord(assetId: string, patch: Partial<Asset>): void {
  if (droppedImportIds.has(assetId)) {
    return
  }
  const existing = state.book.assets[assetId]
  if (existing === undefined) {
    const pending = pendingAssetRecords.get(assetId)
    if (pending !== undefined) {
      // Pending path never emits; always merge (LoAF no-op is the live-asset path).
      pendingAssetRecords.set(assetId, { ...pending, ...patch })
      return
    }
    // Hash can finish before enqueueGalleryAssets; keep the patch for flush.
    const early = pendingAssetPatches.get(assetId) ?? {}
    pendingAssetPatches.set(assetId, { ...early, ...patch })
    return
  }
  if (assetPatchNoOp(existing, patch)) {
    return
  }
  const nextAsset: Asset = { ...existing, ...patch }
  const prev = state
  state = {
    ...state,
    book: {
      ...state.book,
      assets: { ...state.book.assets, [assetId]: nextAsset },
    },
  }
  notifyAffectedSpreads(prev, state)
  // Library seed/hash can finish dozens of assets per turn; notify once per
  // frame while import runs so scroll-during-import stays within the LoAF gate.
  if (state.importRunning) {
    scheduleEmit()
  } else {
    emit()
  }
}

/** Filmstrip label: session file name when present, otherwise the asset id. */
export function getAssetDisplayName(assetId: string): string {
  const name = state.sessionMeta.get(assetId)?.name
  if (name === undefined || name.length === 0) {
    return assetId
  }
  return name
}

let placementCountsFor: Book | null = null
let placementCounts: ReadonlyMap<string, number> = new Map()
let bookUsedSyncedFor: Book | null = null

function syncBookUsedDecodeIds(book: Book): void {
  if (bookUsedSyncedFor === book) {
    return
  }
  bookUsedSyncedFor = book
  const counts = placementCountByAsset(book)
  setBookUsedAssetIds([...counts.keys()])
}

export function getPlacementCountSnapshot(assetId: string): number {
  const book = state.book
  if (placementCountsFor !== book) {
    placementCounts = placementCountByAsset(book)
    placementCountsFor = book
    syncBookUsedDecodeIds(book)
  }
  return placementCounts.get(assetId) ?? 0
}

let placedIdsFor: Book | null = null
let placedIds: ReadonlySet<string> = new Set()

/**
 * Asset ids placed on any frame. Reference-stable while the placed set is
 * unchanged, so import/meta churn does not re-derive the filmstrip view.
 */
export function getPlacedAssetIdsSnapshot(): ReadonlySet<string> {
  const book = state.book
  if (placedIdsFor === book) {
    return placedIds
  }
  placedIdsFor = book
  const next = new Set(placementCountByAsset(book).keys())
  if (
    next.size !== placedIds.size ||
    [...next].some((id) => !placedIds.has(id))
  ) {
    placedIds = next
  }
  return placedIds
}

/** Epoch ms for sort-by-capture: `capturedAt`, else file mtime, else null. */
export function getAssetTimeMs(assetId: string): number | null {
  const asset = state.book.assets[assetId]
  return (
    parseCapturedAtMs(asset?.capturedAt) ??
    (typeof asset?.mtimeMs === 'number' ? asset.mtimeMs : null)
  )
}

/** User-initiated gallery removal (placements cascade); file on disk untouched. */
export function removeAssetFromGallery(assetId: string): void {
  removeFailedImportAssets([assetId])
}

let hasAnyPlacementFor: Book | null = null
let hasAnyPlacement = false

/** Narrow boolean: any frame in the book has an assetId. */
export function getHasAnyPlacementSnapshot(): boolean {
  const book = state.book
  if (hasAnyPlacementFor !== book) {
    hasAnyPlacement = bookHasAnyPlacement(book)
    hasAnyPlacementFor = book
  }
  return hasAnyPlacement
}

/**
 * Gallery-ordered aspects; referentially stable while gallery identity and
 * sessionMeta map identity are unchanged.
 */
export function getGalleryAspectsSnapshot(): readonly number[] {
  const gallery = state.book.gallery
  const meta = state.sessionMeta
  if (galleryAspectsFor === gallery && galleryAspectsMeta === meta) {
    return galleryAspectsSnapshot
  }
  const next = gallery.map((id) => meta.get(id)?.aspect ?? DEFAULT_ASPECT)
  galleryAspectsSnapshot = next
  galleryAspectsFor = gallery
  galleryAspectsMeta = meta
  return galleryAspectsSnapshot
}

/**
 * Gallery-ordered thumbnail labels; referentially stable while gallery
 * identity and sessionMeta map identity are unchanged.
 */
export function getGalleryDisplayNamesSnapshot(): readonly string[] {
  const gallery = state.book.gallery
  const meta = state.sessionMeta
  if (galleryNamesFor === gallery && galleryNamesMeta === meta) {
    return galleryNamesSnapshot
  }
  galleryNamesSnapshot = gallery.map((id) => getAssetDisplayName(id))
  galleryNamesFor = gallery
  galleryNamesMeta = meta
  return galleryNamesSnapshot
}

export function getBookStoreSnapshot(): BookStoreState {
  return state
}

/** Mint a unique ephemeral asset id for this session. */
export function mintAssetId(fileName: string): string {
  assetSeq += 1
  const safe = fileName.replace(/[^\w.-]+/g, '_').slice(0, 48)
  return `asset-${String(assetSeq)}-${safe}`
}

/**
 * Drop a failed import everywhere: still-pending queues, or flushed gallery
 * (cascading placements), plus session meta. Marks the id so a late hash
 * `patchAssetRecord` cannot recreate a record.
 */
export function removeFailedImportAsset(assetId: string): void {
  removeFailedImportAssets([assetId])
}

/**
 * Batch variant of {@link removeFailedImportAsset}: one gallery op and one
 * store emit. Used when Change photo folder clears a full prior root.
 */
export function removeFailedImportAssets(assetIds: readonly string[]): void {
  const unique = [...new Set(assetIds)]
  if (unique.length === 0) {
    return
  }
  const remove = new Set(unique)
  for (const assetId of unique) {
    droppedImportIds.add(assetId)
    pendingMeta.delete(assetId)
    pendingAssetRecords.delete(assetId)
    pendingAssetPatches.delete(assetId)
  }
  pendingGalleryIds = pendingGalleryIds.filter((id) => !remove.has(id))

  const inBook = unique.some(
    (assetId) =>
      state.book.gallery.includes(assetId) || assetId in state.book.assets,
  )
  if (inBook) {
    dispatchBookOp({ type: 'removeManyFromGallery', assetIds: unique })
  }

  let metaChanged = false
  const nextMeta = new Map(state.sessionMeta)
  for (const assetId of unique) {
    if (nextMeta.delete(assetId)) {
      metaChanged = true
    }
  }
  if (metaChanged) {
    const prev = state
    state = { ...state, sessionMeta: nextMeta }
    invalidateGalleryAspectsCache()
    notifyAffectedSpreads(prev, state)
    emit()
  }
}

/** Queue gallery append + optional placeholder meta; flushed in chunks per animation frame. */
export function enqueueGalleryAssets(
  entries: readonly {
    assetId: string
    meta?: AssetSessionMeta
    asset?: Asset
  }[],
): void {
  for (const entry of entries) {
    droppedImportIds.delete(entry.assetId)
    pendingGalleryIds.push(entry.assetId)
    const earlyPatch = pendingAssetPatches.get(entry.assetId)
    if (earlyPatch !== undefined) {
      pendingAssetPatches.delete(entry.assetId)
    }
    if (entry.asset) {
      pendingAssetRecords.set(
        entry.assetId,
        earlyPatch === undefined
          ? entry.asset
          : { ...entry.asset, ...earlyPatch },
      )
    } else if (earlyPatch !== undefined) {
      pendingAssetRecords.set(entry.assetId, earlyPatch)
    }
    if (entry.meta) {
      pendingMeta.set(entry.assetId, entry.meta)
    } else {
      pendingMeta.set(entry.assetId, {
        name: entry.assetId,
        correctedWidth: 1,
        correctedHeight: 1,
        orientation: 1,
        aspect: 1,
      })
    }
  }
  scheduleFlush()
}

/**
 * Drain pending gallery id chunks (list-first enqueue) before callers snapshot
 * `book.gallery` — e.g. folder-rescan priority planning. Yields between chunks
 * so large folders stay interruptible. Cancels any scheduled rAF/watchdog flush
 * so a deferred callback cannot race this drain.
 */
export async function awaitPendingGalleryFlush(
  yieldBetweenChunks: () => Promise<void>,
): Promise<void> {
  flushScheduled = false
  clearTimeout(flushWatchdogTimer)
  flushWatchdogTimer = undefined
  while (pendingGalleryIds.length > 0) {
    flushPendingGalleryAndMeta()
    if (pendingGalleryIds.length > 0) {
      await yieldBetweenChunks()
    }
  }
}

export function setAssetSessionMeta(
  assetId: string,
  meta: AssetSessionMeta,
): void {
  pendingMeta.set(assetId, meta)
  scheduleFlush()
}

export function setImportRunning(running: boolean, expectedCount = 0): void {
  if (
    state.importRunning === running &&
    state.importExpectedCount === expectedCount
  ) {
    return
  }
  const prev = state
  state = {
    ...state,
    importRunning: running,
    importExpectedCount: running ? expectedCount : 0,
  }
  setDecodeImportActive(running)
  notifyAffectedSpreads(prev, state)
  if (!running) {
    // Import ended: deliver any coalesced hash-patch emit before the gallery
    // notify so subscribers see the final asset map in the same turn.
    flushScheduledEmit()
  }
  emitGallery()
}

export interface HistoryAvailability {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}

let history: History = EMPTY_HISTORY
let historySnapshot: HistoryAvailability = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
}
const historyListeners = new Set<Listener>()

function setHistory(next: History): void {
  history = next
  const avail = {
    canUndo: canUndo(next),
    canRedo: canRedo(next),
    undoLabel: undoLabel(next),
    redoLabel: redoLabel(next),
  }
  // A null label is exactly "nothing to undo / redo", so labels cover availability.
  if (
    avail.undoLabel === historySnapshot.undoLabel &&
    avail.redoLabel === historySnapshot.redoLabel
  ) {
    return
  }
  historySnapshot = avail
  for (const listener of historyListeners) {
    listener()
  }
}

export function subscribeHistory(listener: Listener): () => void {
  historyListeners.add(listener)
  return () => {
    historyListeners.delete(listener)
  }
}

export function getHistorySnapshot(): HistoryAvailability {
  return historySnapshot
}

function publishBook(book: Book): void {
  const prev = state
  state = { ...state, book }
  if (book.gallery !== prev.book.gallery) {
    invalidateGalleryAspectsCache()
  }
  notifyAffectedSpreads(prev, state)
  if (book.gallery !== prev.book.gallery) {
    emitGallery()
  } else {
    emit()
  }
}

function moveHistory(move: HistoryMove | null): void {
  if (move === null) {
    return
  }
  const book: Book = {
    ...state.book,
    spreads: move.snapshot.spreads,
    layoutGrid: move.snapshot.layoutGrid,
  }
  if (move.snapshot.title === undefined) {
    delete book.title
  } else {
    book.title = move.snapshot.title
  }
  setHistory(move.history)
  publishBook(book)
}

/** Step back one layout/title edit. No-op when there is nothing to undo. */
export function undoBook(): void {
  moveHistory(undoStep(history, snapshotOf(state.book)))
}

/** Step forward one undone edit. No-op when there is nothing to redo. */
export function redoBook(): void {
  moveHistory(redoStep(history, snapshotOf(state.book)))
}

export function dispatchBookOp(op: BookOp): void {
  const book = applyBookOp(state.book, op)
  if (book === state.book) {
    return
  }
  const prev = state
  if (isUndoableOp(op)) {
    setHistory(
      recordStep(
        history,
        snapshotOf(prev.book),
        coalesceKey(op),
        undefined,
        opLabel(op),
      ),
    )
  } else if (book.spreads !== prev.book.spreads) {
    // Gallery removal also unplaced frames: older snapshots would reference
    // assets that are gone.
    setHistory(EMPTY_HISTORY)
  }
  publishBook(book)
  if (op.type === 'applyTemplate') {
    const removed = removedPlacementCount(prev.book, book, op.spreadId)
    if (removed > 0) {
      setEditorStatus(unplacedFromSpreadStatus(removed))
    }
  }
}

function removedPlacementCount(
  before: Book,
  after: Book,
  spreadId: string,
): number {
  const prevSpread = before.spreads.find((spread) => spread.id === spreadId)
  const nextSpread = after.spreads.find((spread) => spread.id === spreadId)
  if (prevSpread === undefined || nextSpread === undefined) {
    return 0
  }
  let removed = 0
  for (
    let index = nextSpread.frames.length;
    index < prevSpread.frames.length;
    index += 1
  ) {
    if (prevSpread.frames[index]?.assetId !== undefined) {
      removed += 1
    }
  }
  return removed
}

/** Replace the in-memory book with the painter fixture (fixture builds only). */
export function loadPainterFixture(): void {
  if (import.meta.env.DEV || import.meta.env.VITE_TEST_FIXTURES === '1') {
    void import('../testFixtures/loadPainterFixture').then((m) => {
      m.loadPainterFixture()
    })
  }
}

export function subscribeSpread(
  spreadId: string,
  listener: Listener,
): () => void {
  const existing = spreadListeners.get(spreadId)
  const set = existing ?? new Set<Listener>()
  if (existing === undefined) {
    spreadListeners.set(spreadId, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) {
      spreadListeners.delete(spreadId)
    }
  }
}

/** Decoded pixel size; the 1×1 enqueue placeholder counts as unknown. */
function sessionPixelSize(
  meta: AssetSessionMeta | undefined,
): { widthPx: number; heightPx: number } | undefined {
  if (
    meta === undefined ||
    (meta.correctedWidth <= 1 && meta.correctedHeight <= 1)
  ) {
    return undefined
  }
  return { widthPx: meta.correctedWidth, heightPx: meta.correctedHeight }
}

export function getSpreadPaintSnapshot(
  spreadId: string,
): SpreadPaintSnapshot | undefined {
  const spread = state.book.spreads.find(
    (candidate) => candidate.id === spreadId,
  )
  if (spread === undefined) {
    return undefined
  }
  const inputKey = paintInputKey(
    state.book,
    spread,
    state.sessionMeta,
    state.previewUrls,
  )
  const cached = paintCache.get(spreadId)
  if (cached?.spread === spread && cached.inputKey === inputKey) {
    return cached
  }
  const urls = state.previewUrls
  const meta = state.sessionMeta
  const resolved = resolveSpread(state.book, spreadId, {
    getAspectRatio: (assetId) => meta.get(assetId)?.aspect ?? 1,
    getPixelSize: (assetId) => sessionPixelSize(meta.get(assetId)),
  })
  if (resolved === undefined) {
    return undefined
  }
  const next: CachedSpreadPaint = {
    spread,
    inputKey,
    resolved,
    previewUrlFor: (assetId) => urls.get(assetId),
  }
  paintCache.set(spreadId, next)
  return next
}

let spreadIdsSnapshot: readonly string[] = []
let spreadIdsFor: Book['spreads'] | null = null

export function getSpreadTemplateId(spreadId: string): string | null {
  const spread = state.book.spreads.find((item) => item.id === spreadId)
  return spread?.templateId ?? null
}

export function getSpreadIdsSnapshot(): readonly string[] {
  const spreads = state.book.spreads
  if (spreadIdsFor === spreads) {
    return spreadIdsSnapshot
  }
  spreadIdsSnapshot = spreads.map((spread) => spread.id)
  spreadIdsFor = spreads
  return spreadIdsSnapshot
}

function paintInputKey(
  book: Book,
  spread: Spread | undefined,
  sessionMeta: BookStoreState['sessionMeta'],
  previewUrls: BookStoreState['previewUrls'],
): string {
  if (spread === undefined) {
    return ''
  }
  const index = book.spreads.indexOf(spread)
  const { trim, bleedMm, safeMarginMm } = book.settings
  let key = `${String(index)}:${String(book.spreads.length)}:${String(trim.widthMm)}:${String(trim.heightMm)}:${String(bleedMm)}:${String(safeMarginMm)}`
  for (const frame of spread.frames) {
    const assetId = frame.assetId
    if (assetId === undefined) {
      key += '|'
      continue
    }
    const aspect = sessionMeta.get(assetId)?.aspect ?? 1
    const url = previewUrls.get(assetId) ?? ''
    const asset = book.assets[assetId]
    const size = sessionPixelSize(sessionMeta.get(assetId))
    key += `|${assetId}:${String(aspect)}:${url}:${String(size?.widthPx ?? asset?.widthPx)}x${String(size?.heightPx ?? asset?.heightPx)}`
  }
  return key
}

function notifySpread(spreadId: string): void {
  const set = spreadListeners.get(spreadId)
  if (set === undefined) {
    return
  }
  for (const listener of set) {
    listener()
  }
}

function notifyAffectedSpreads(
  prev: BookStoreState,
  next: BookStoreState,
): void {
  const ids = new Set<string>()
  for (const spread of prev.book.spreads) {
    ids.add(spread.id)
  }
  for (const spread of next.book.spreads) {
    ids.add(spread.id)
  }
  for (const id of ids) {
    const before = prev.book.spreads.find((spread) => spread.id === id)
    const after = next.book.spreads.find((spread) => spread.id === id)
    const beforeKey = paintInputKey(
      prev.book,
      before,
      prev.sessionMeta,
      prev.previewUrls,
    )
    const afterKey = paintInputKey(
      next.book,
      after,
      next.sessionMeta,
      next.previewUrls,
    )
    if (before !== after || beforeKey !== afterKey) {
      paintCache.delete(id)
      notifySpread(id)
    }
  }
}

/** Test helper: replace store state immediately. */
export function resetBookStore(next?: BookStoreInit): void {
  const prev = state
  state = next
    ? {
        book: next.book,
        sessionMeta: next.sessionMeta,
        previewUrls: next.previewUrls ?? new Map(),
        importRunning: next.importRunning,
        importExpectedCount: next.importExpectedCount,
      }
    : {
        book: createSessionBook(),
        sessionMeta: new Map(),
        previewUrls: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      }
  setDecodeImportActive(state.importRunning)
  setHistory(EMPTY_HISTORY)
  pendingGalleryIds = []
  pendingMeta = new Map()
  pendingAssetRecords = new Map()
  pendingAssetPatches = new Map()
  droppedImportIds.clear()
  flushScheduled = false
  if (emitCoalesceRaf !== null) {
    cancelAnimationFrame(emitCoalesceRaf)
    emitCoalesceRaf = null
  }
  clearTimeout(flushWatchdogTimer)
  flushWatchdogTimer = undefined
  clearTimeout(quietFlushTimer)
  quietFlushTimer = undefined
  placementCountsFor = null
  bookUsedSyncedFor = null
  hasAnyPlacementFor = null
  assetSeq = 0
  paintCache.clear()
  spreadIdsFor = null
  invalidateGalleryAspectsCache()
  notifyAffectedSpreads(prev, state)
  emit()
}
