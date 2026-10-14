import { applyBookOp, CURRENT_SCHEMA_VERSION, type Book } from '../core'
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
  importRunning: boolean
  /** Reserved filmstrip scroll width in items (avoids per-chunk spacer layout). */
  importExpectedCount: number
}

const GALLERY_FLUSH_CHUNK = 4

function createSessionBook(): Book {
  return {
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
    spreads: [
      {
        id: 'spread-1',
        frames: [
          {
            id: 'frame-1',
            rect: { x: 15, y: 15, width: 270, height: 270 },
            z: 0,
          },
        ],
        templateId: 'one-per-page',
      },
    ],
  }
}

type Listener = () => void

let state: BookStoreState = {
  book: createSessionBook(),
  sessionMeta: new Map(),
  importRunning: false,
  importExpectedCount: 0,
}

const listeners = new Set<Listener>()
let assetSeq = 0
let flushScheduled = false
let pendingGalleryIds: string[] = []
let pendingMeta = new Map<string, AssetSessionMeta>()

const galleryListeners = new Set<Listener>()

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
    state = {
      book,
      sessionMeta,
      importRunning: state.importRunning,
      importExpectedCount: state.importExpectedCount,
    }
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
  state = {
    ...state,
    importRunning: running,
    importExpectedCount: running ? expectedCount : 0,
  }
  emitGallery()
}

/** Test helper: replace store state immediately. */
export function resetBookStore(next?: BookStoreState): void {
  state = next ?? {
    book: createSessionBook(),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  }
  pendingGalleryIds = []
  pendingMeta = new Map()
  flushScheduled = false
  assetSeq = 0
  emit()
}
