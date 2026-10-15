import {
  addSpread,
  applyBookOp,
  CURRENT_SCHEMA_VERSION,
  resolveSpread,
  type Book,
  type BookOp,
  type ResolvedSpread,
  type Spread,
} from '../core'
import { makePainterFixture } from '../core/testing/painterFixture'
import type { ExifOrientation } from '../photo/types'

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

function createSessionBook(): Book {
  const empty: Book = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'session-book',
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
let pendingGalleryIds: string[] = []
let pendingMeta = new Map<string, AssetSessionMeta>()

const galleryListeners = new Set<Listener>()

const DEFAULT_ASPECT = 1
let galleryAspectsSnapshot: readonly number[] = Object.freeze([])
let galleryAspectsFor: readonly string[] | null = null
let galleryAspectsMeta: ReadonlyMap<string, AssetSessionMeta> | null = null

function invalidateGalleryAspectsCache(): void {
  galleryAspectsFor = null
  galleryAspectsMeta = null
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function emitGallery(): void {
  for (const listener of galleryListeners) {
    listener()
  }
  emit()
}

function scheduleFlush(): void {
  if (flushScheduled) {
    return
  }
  flushScheduled = true
  requestAnimationFrame(() => {
    flushScheduled = false
    const ids = pendingGalleryIds.splice(0, GALLERY_FLUSH_CHUNK)
    const metaBatch = pendingMeta
    pendingMeta = new Map()
    if (ids.length === 0 && metaBatch.size === 0) {
      if (pendingGalleryIds.length > 0) {
        scheduleFlush()
      }
      return
    }
    let book = state.book
    let galleryChanged = false
    if (ids.length > 0) {
      book = applyBookOp(book, { type: 'addToGallery', assetIds: ids })
      galleryChanged = book.gallery !== state.book.gallery
    }
    const sessionMeta = new Map(state.sessionMeta)
    for (const [id, meta] of metaBatch) {
      sessionMeta.set(id, meta)
    }
    const prev = state
    state = {
      book,
      sessionMeta,
      previewUrls: state.previewUrls,
      importRunning: state.importRunning,
      importExpectedCount: state.importExpectedCount,
    }
    invalidateGalleryAspectsCache()
    notifyAffectedSpreads(prev, state)
    if (galleryChanged) {
      emitGallery()
    } else {
      emit()
    }
    if (pendingGalleryIds.length > 0 || pendingMeta.size > 0) {
      scheduleFlush()
    }
  })
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

export function getSpacerCountSnapshot(): number {
  return Math.max(state.book.gallery.length, state.importExpectedCount)
}

/** Per-asset aspect for filmstrip slots; defaults to 1 when meta is missing. */
export function getAssetAspectSnapshot(assetId: string): number {
  return state.sessionMeta.get(assetId)?.aspect ?? DEFAULT_ASPECT
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

export function getBookStoreSnapshot(): BookStoreState {
  return state
}

/** Mint a unique ephemeral asset id for this session. */
export function mintAssetId(fileName: string): string {
  assetSeq += 1
  const safe = fileName.replace(/[^\w.-]+/g, '_').slice(0, 48)
  return `asset-${String(assetSeq)}-${safe}`
}

/** Queue gallery append + optional placeholder meta; flushed in chunks per animation frame. */
export function enqueueGalleryAssets(
  entries: readonly {
    assetId: string
    meta?: AssetSessionMeta
  }[],
): void {
  for (const entry of entries) {
    pendingGalleryIds.push(entry.assetId)
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
  notifyAffectedSpreads(prev, state)
  emitGallery()
}

export function dispatchBookOp(op: BookOp): void {
  const book = applyBookOp(state.book, op)
  if (book === state.book) {
    return
  }
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

/** Replace the in-memory book with the painter fixture and its preview URLs. */
export function loadPainterFixture(): void {
  const fixture = makePainterFixture()
  resetBookStore({
    book: fixture.book,
    sessionMeta: new Map(),
    previewUrls: fixture.previewUrls,
    importRunning: false,
    importExpectedCount: 0,
  })
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
    key += `|${assetId}:${String(aspect)}:${url}`
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
  pendingGalleryIds = []
  pendingMeta = new Map()
  flushScheduled = false
  assetSeq = 0
  paintCache.clear()
  spreadIdsFor = null
  invalidateGalleryAspectsCache()
  notifyAffectedSpreads(prev, state)
  emit()
}
