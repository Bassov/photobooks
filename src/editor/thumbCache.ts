import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'
import { noteDecodeScrollActivity } from '../photo/decodeScrollQuiet'
import type {
  DerivedCacheEntry,
  DerivedCacheResult,
} from '../assets/derivedCache/types'
import {
  getAssetCacheKey,
  getGalleryIdsSnapshot,
  subscribeAssetRemovals,
} from './bookStore'
import {
  filmstripScrollQuietRemainingMs,
  isFilmstripScrollQuiet,
  noteFilmstripScrollActivity,
} from './filmstripScrollQuiet'
import { trackHashJob } from './pendingHashes'
import { restoreAspectFromPreview } from './previewAspect'
import { yieldForPaint } from './relink/yieldForPaint'
import { decodeThumbOnCacheMiss } from './thumbMissDecode'

/** Hot thumb bytes kept this session; LRU past the budget (mounted stay). */
const DEFAULT_BYTE_BUDGET = 128 * 1024 * 1024
/** Per-frame publish budget so bulk import + scroll stays within LoAF. */
const FLUSH_MAX_NOTIFIES = 8
const FLUSH_MAX_MS = 3
/** Matches bookStore gallery flush: progress if rAF freezes (background tab). */
const FLUSH_RAF_WATCHDOG_MS = 32
/** Parallel DerivedCache reads on mount. */
const HYDRATE_CONCURRENCY = 4
/** DerivedCache reads the restore bulk pass keeps in flight. */
const BULK_HYDRATE_CONCURRENCY = 24

/** One hot thumb: the object URL lives as long as the entry. */
interface ThumbEntry {
  blob: Blob
  url: string
  byteLength: number
}

/** Map order is LRU order: oldest first (set / mount re-inserts). */
const entries = new Map<string, ThumbEntry>()
let totalBytes = 0
let byteBudget = DEFAULT_BYTE_BUDGET

const assetListeners = new Map<string, Set<() => void>>()
const publishListeners = new Set<() => void>()
let publishGeneration = 0

/** Mounted ids whose URL changed and still need a React notify. */
const pendingNotify = new Set<string>()
let flushScheduled = false
let flushWatchdogTimer: ReturnType<typeof setTimeout> | undefined
/** Separate from rAF flush scheduling so scroll-quiet waits do not race it. */
let quietFlushTimer: ReturnType<typeof setTimeout> | undefined

let viewportProvider: (() => readonly string[]) | null = null

interface HydrateRequest {
  assetId: string
  cacheKey: string
  controller: AbortController
  /** A tile was mounted when it asked; unmount before the read drops it. */
  mounted: boolean
}

/** Waiting DerivedCache reads (insertion order); started ones leave. */
const hydrateQueue = new Map<string, HydrateRequest>()
const hydrateRunning = new Set<HydrateRequest>()
/** Started reads (incl. miss decode) per asset; reset aborts them. */
const hydrateInflight = new Map<string, AbortController>()

/** Identity digests already written to DerivedCache this session (skip re-puts). */
const putCacheKeys = new Set<string>()

export interface ThumbBulkHydrateStats {
  state: 'idle' | 'running' | 'done'
  hydrated: number
  missed: number
  /** Wall time of the finished pass. */
  ms: number
}

function idleBulkStats(): ThumbBulkHydrateStats {
  return { state: 'idle', hydrated: 0, missed: 0, ms: 0 }
}

/** A new pass or reset bumps it; a stale pass stops at its next await. */
let bulkGeneration = 0
let bulkStats = idleBulkStats()
/** Ids the current bulk pass is reading; removal deletes so the read drops. */
let bulkInflight = new Set<string>()

subscribeAssetRemovals((assetIds) => {
  for (const assetId of assetIds) {
    // A read in flight for a removed asset must not store it again.
    bulkInflight.delete(assetId)
    hydrateQueue.delete(assetId)
    hydrateInflight.get(assetId)?.abort()
    hydrateInflight.delete(assetId)
    const entry = entries.get(assetId)
    if (entry !== undefined) {
      removeEntry(assetId, entry)
      enqueueNotify(assetId)
    }
  }
})

function viewportIds(): ReadonlySet<string> {
  return new Set(viewportProvider?.() ?? [])
}

function notifyAsset(assetId: string): void {
  publishGeneration += 1
  const set = assetListeners.get(assetId)
  if (set) {
    for (const listener of set) {
      listener()
    }
  }
  for (const listener of publishListeners) {
    listener()
  }
}

function removeEntry(assetId: string, entry: ThumbEntry): void {
  entries.delete(assetId)
  totalBytes -= entry.byteLength
  URL.revokeObjectURL(entry.url)
}

function evictOverBudget(): void {
  for (const [assetId, entry] of entries) {
    if (totalBytes <= byteBudget) {
      return
    }
    // Mounted tiles keep their URL; they are re-touched on the next mount.
    if (!assetListeners.has(assetId)) {
      removeEntry(assetId, entry)
    }
  }
}

/** Create the object URL as soon as bytes arrive; replace revokes the old one. */
function storeThumb(assetId: string, blob: Blob): void {
  const prior = entries.get(assetId)
  if (prior !== undefined) {
    removeEntry(assetId, prior)
  }
  entries.set(assetId, {
    blob,
    url: URL.createObjectURL(blob),
    byteLength: blob.size,
  })
  totalBytes += blob.size
  evictOverBudget()
  enqueueNotify(assetId)
}

function enqueueNotify(assetId: string): void {
  // Unmounted ids read the URL on mount; only mounted tiles need a notify.
  if (!assetListeners.has(assetId)) {
    return
  }
  pendingNotify.add(assetId)
  scheduleFlush()
}

function scheduleFlushAfterQuiet(delayMs: number): void {
  clearTimeout(quietFlushTimer)
  quietFlushTimer = setTimeout(
    () => {
      quietFlushTimer = undefined
      flushPending()
    },
    Math.max(0, delayMs),
  )
}

/**
 * Notify mounted tiles, scrollport first, within FLUSH_MAX_NOTIFIES /
 * FLUSH_MAX_MS. While the scroll-quiet window is open only scrollport ids
 * publish; the rest wait for quiet.
 */
function flushPending(): void {
  const started = performance.now()
  const quiet = isFilmstripScrollQuiet()
  const viewport = viewportIds()
  let published = 0
  // At least one notify per frame so a slow frame still makes progress.
  const withinBudget = (): boolean =>
    published === 0 ||
    (published < FLUSH_MAX_NOTIFIES &&
      performance.now() - started < FLUSH_MAX_MS)
  const publish = (assetId: string): void => {
    pendingNotify.delete(assetId)
    notifyAsset(assetId)
    published += 1
  }
  for (const assetId of pendingNotify) {
    if (!assetListeners.has(assetId)) {
      // Unmounted since the bytes arrived: bytes stay cached.
      pendingNotify.delete(assetId)
    } else if (viewport.has(assetId) && withinBudget()) {
      publish(assetId)
    }
  }
  if (!quiet) {
    for (const assetId of pendingNotify) {
      if (!withinBudget()) {
        break
      }
      publish(assetId)
    }
  }
  if (pendingNotify.size === 0) {
    return
  }
  const viewportLeft = [...pendingNotify].some((id) => viewport.has(id))
  if (quiet && !viewportLeft) {
    scheduleFlushAfterQuiet(filmstripScrollQuietRemainingMs())
    return
  }
  scheduleFlush()
}

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
    clearTimeout(flushWatchdogTimer)
    flushWatchdogTimer = undefined
    flushPending()
  }
  // Prefer rAF for LoAF pacing; watchdog still fires if rAF is frozen after
  // the page was backgrounded (parallel Playwright). Immediate publish was
  // used previously because rAF-only queues stalled without a watchdog.
  requestAnimationFrame(run)
  flushWatchdogTimer = setTimeout(run, FLUSH_RAF_WATCHDOG_MS)
}

/**
 * Call from filmstrip scroll so off-screen thumb publishes wait for a quiet
 * frame — avoids stacking React notifies on scroll-during-import LoAF windows.
 * In-flight flushes re-check quiet in `flushPending`; no reschedule needed.
 */
export function noteFilmstripScroll(): void {
  noteFilmstripScrollActivity()
  // Pause background decode drains for the same quiet window (scroll LoAF).
  noteDecodeScrollActivity()
}

/**
 * Filmstrip registers the asset ids inside its scrollport (read lazily at
 * flush / hydrate pick time). Returns the unregister function.
 */
export function setThumbViewportProvider(
  provider: () => readonly string[],
): () => void {
  viewportProvider = provider
  return () => {
    if (viewportProvider === provider) {
      viewportProvider = null
    }
  }
}

export function subscribeThumb(
  assetId: string,
  listener: () => void,
): () => void {
  const set = assetListeners.get(assetId) ?? new Set()
  set.add(listener)
  assetListeners.set(assetId, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) {
      assetListeners.delete(assetId)
    }
  }
}

/** Subscribe to any thumb publish/reset (stable useSyncExternalStore subscribe). */
export function subscribeThumbPublishes(listener: () => void): () => void {
  publishListeners.add(listener)
  return () => {
    publishListeners.delete(listener)
  }
}

export function getThumbPublishGeneration(): number {
  return publishGeneration
}

/** O(1) snapshot read: the URL exists from the moment the bytes arrive. */
export function getThumbUrl(assetId: string): string | undefined {
  return entries.get(assetId)?.url
}

/** True when this session holds thumb bytes for the asset. */
export function hasThumbData(assetId: string): boolean {
  return entries.has(assetId)
}

export function setThumbUrl(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
  cacheKey?: string,
): void {
  // Blob copies the bytes, so callers can reuse/detach the source buffer.
  const blob = new Blob([buffer], { type: mimeType })
  storeThumb(assetId, blob)
  if (cacheKey !== undefined && cacheKey.length > 0) {
    // Encode-after-identity path: put must be awaited by Save
    // (awaitPendingHashes), otherwise reload hydrates gray placeholders.
    void trackHashJob(putThumbForKey(cacheKey, blob))
  }
}

async function putThumbForKey(cacheKey: string, blob: Blob): Promise<void> {
  if (putCacheKeys.has(cacheKey)) {
    return
  }
  putCacheKeys.add(cacheKey)
  const [cache, bytes] = await Promise.all([
    getDerivedCache(),
    blob.arrayBuffer(),
  ])
  await cache.put(cacheKey, THUMB_PRESET_ID, {
    bytes,
    mimeType: blob.type,
  })
}

/** Put the hot thumb into DerivedCache once the identity cache key is known. */
export async function putCachedThumbForHash(
  assetId: string,
  cacheKey: string,
): Promise<void> {
  if (cacheKey.length === 0) {
    return
  }
  const entry = entries.get(assetId)
  if (entry === undefined) {
    return
  }
  await putThumbForKey(cacheKey, entry.blob)
}

/** Next queued read: scrollport first, else oldest; drops unmounted tiles. */
function nextHydrateRequest(): HydrateRequest | undefined {
  const viewport = viewportIds()
  let oldest: HydrateRequest | undefined
  for (const request of hydrateQueue.values()) {
    if (request.mounted && !assetListeners.has(request.assetId)) {
      hydrateQueue.delete(request.assetId)
      continue
    }
    if (viewport.has(request.assetId)) {
      oldest = request
      break
    }
    oldest ??= request
  }
  if (oldest !== undefined) {
    hydrateQueue.delete(oldest.assetId)
  }
  return oldest
}

function pumpHydrate(): void {
  while (hydrateRunning.size < HYDRATE_CONCURRENCY) {
    const request = nextHydrateRequest()
    if (request === undefined) {
      return
    }
    hydrateRunning.add(request)
    hydrateInflight.set(request.assetId, request.controller)
    void runHydrate(request)
  }
}

function releaseHydrateSlot(request: HydrateRequest): void {
  if (hydrateRunning.delete(request)) {
    pumpHydrate()
  }
}

/** DerivedCache read; true on a miss that still needs a decode. */
async function readCachedThumb(request: HydrateRequest): Promise<boolean> {
  const { assetId, cacheKey, controller } = request
  // Reset clears `hydrateInflight`, so a stale read no longer owns the id.
  const stale = (): boolean => hydrateInflight.get(assetId) !== controller
  const cache = await getDerivedCache()
  if (stale()) {
    return false
  }
  const got = await cache.get(cacheKey, THUMB_PRESET_ID)
  if (stale()) {
    return false
  }
  if (!got.ok) {
    return true
  }
  if (!entries.has(assetId)) {
    storeCachedThumb(assetId, got.value)
  }
  return false
}

/** Hot-store DerivedCache bytes; aspect from them when dims are unknown. */
function storeCachedThumb(assetId: string, entry: DerivedCacheEntry): void {
  const { bytes, mimeType } = entry
  restoreAspectFromPreview(assetId, bytes, mimeType)
  storeThumb(assetId, new Blob([bytes], { type: mimeType }))
}

async function runHydrate(request: HydrateRequest): Promise<void> {
  const { assetId, cacheKey, controller } = request
  try {
    const missed = await readCachedThumb(request)
    // The miss decode has its own queue; free the read slot first.
    releaseHydrateSlot(request)
    if (missed) {
      // Reset aborts `controller`, so a non-null result is still current.
      const decoded = await decodeThumbOnCacheMiss(assetId, controller.signal)
      if (decoded !== null) {
        setThumbUrl(assetId, decoded.buffer, decoded.mimeType, cacheKey)
      }
    }
  } finally {
    releaseHydrateSlot(request)
    if (hydrateInflight.get(assetId) === controller) {
      hydrateInflight.delete(assetId)
    }
  }
}

/** Tile mount: touch a hot entry, else queue a DerivedCache read. */
export function ensureThumb(assetId: string, cacheKey?: string): void {
  const entry = entries.get(assetId)
  if (entry !== undefined) {
    entries.delete(assetId)
    entries.set(assetId, entry)
    return
  }
  if (hydrateInflight.has(assetId) || hydrateQueue.has(assetId)) {
    return
  }
  if (cacheKey === undefined || cacheKey.length === 0) {
    return
  }
  hydrateQueue.set(assetId, {
    assetId,
    cacheKey,
    controller: new AbortController(),
    mounted: assetListeners.has(assetId),
  })
  pumpHydrate()
}

/**
 * Gallery index range of the filmstrip scrollport. None in view: -1 / -1,
 * so the outward walk starts at the gallery head.
 */
function filmstripWindow(gallery: readonly string[]): {
  lo: number
  hi: number
} {
  const viewport = viewportIds()
  const inView = (assetId: string): boolean => viewport.has(assetId)
  return { lo: gallery.findIndex(inView), hi: gallery.findLastIndex(inView) }
}

/**
 * Where the bulk walk stands: ids it passed, and the window start and scroll
 * direction at its last pick.
 */
interface BulkWalk {
  visited: Set<string>
  lo: number
  direction: -1 | 0 | 1
}

/**
 * Next `limit` bulk reads: the window first, then, while the strip scrolls,
 * everything ahead of it (the trail end was just on screen), then
 * alternating right / left outward. Every id it passes is `visited`; hot,
 * mount-read and keyless ids are skipped.
 */
function nextBulkBatch(
  walk: BulkWalk,
  limit: number,
): { assetId: string; cacheKey: string }[] {
  const batch: { assetId: string; cacheKey: string }[] = []
  const room = (): boolean => batch.length < limit
  const gallery = getGalleryIdsSnapshot()
  const { lo, hi } = filmstripWindow(gallery)
  if (!isFilmstripScrollQuiet()) {
    walk.direction = 0
  } else if (lo !== walk.lo) {
    walk.direction = lo > walk.lo ? 1 : -1
  }
  walk.lo = lo
  const { visited, direction } = walk
  const take = (index: number): void => {
    const assetId = gallery[index]
    if (assetId === undefined || visited.has(assetId)) {
      return
    }
    visited.add(assetId)
    const cacheKey = getAssetCacheKey(assetId)
    // A started mount read always stores; a queued one drops on unmount.
    if (
      cacheKey !== undefined &&
      !entries.has(assetId) &&
      !hydrateInflight.has(assetId)
    ) {
      batch.push({ assetId, cacheKey })
    }
  }
  for (let index = lo; index <= hi && room(); index += 1) {
    take(index)
  }
  // The window is visited by now, so walking from `lo` passes it.
  if (direction !== 0) {
    for (let step = 1; step <= gallery.length && room(); step += 1) {
      take(lo + direction * step)
    }
  }
  for (let step = 1; step <= gallery.length && room(); step += 1) {
    take(hi + step)
    if (room()) {
      take(lo - step)
    }
  }
  return batch
}

interface BulkRead {
  assetId: string
  got: DerivedCacheResult<DerivedCacheEntry>
}

/**
 * Store one finished bulk read into the hot cache. False at the byte budget:
 * the pass stops there and never evicts.
 */
function storeBulkRead(inflight: Set<string>, read: BulkRead): boolean {
  const { assetId, got } = read
  // Removed mid-read: drop the bytes.
  if (!inflight.delete(assetId)) {
    return true
  }
  if (!got.ok) {
    bulkStats.missed += 1
  } else if (!entries.has(assetId)) {
    if (totalBytes + got.value.bytes.byteLength > byteBudget) {
      return false
    }
    storeCachedThumb(assetId, got.value)
    bulkStats.hydrated += 1
  }
  return true
}

/** Next store slice: the next frame while the strip scrolls, else the next task. */
function nextSlice(): Promise<void> {
  if (!isFilmstripScrollQuiet()) {
    return yieldForPaint()
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve()
    })
  })
}

/**
 * Restore: read every gallery thumb from DerivedCache into the hot cache in
 * the background, nearest the filmstrip window first, so tiles mounted later
 * need no placeholder. Stops at the byte budget (never evicts); misses stay
 * with the mount path. Stores run in FLUSH_MAX_MS slices, only at the start
 * of a frame while the strip scrolls. A new pass or reset cancels this one.
 */
export async function hydrateGalleryThumbs(): Promise<void> {
  bulkGeneration += 1
  const generation = bulkGeneration
  const current = (): boolean => generation === bulkGeneration
  const inflight = new Set<string>()
  bulkInflight = inflight
  bulkStats = { ...idleBulkStats(), state: 'running' }
  const started = performance.now()
  const ready: BulkRead[] = []
  let reading = 0
  // Set by a failed read (in `fill`) or the end of the pass.
  let stopped = false as boolean
  // Resolves the loop's wait for a finished read.
  let wake = (): void => undefined
  try {
    const cache = await getDerivedCache()
    const walk: BulkWalk = {
      visited: new Set(),
      lo: filmstripWindow(getGalleryIdsSnapshot()).lo,
      direction: 0,
    }
    // No batch barrier: each finished read starts the next one, so reads
    // stay in flight while the stores wait for their slice.
    const fill = (): void => {
      if (stopped || !current() || ready.length >= BULK_HYDRATE_CONCURRENCY) {
        return
      }
      const picks = nextBulkBatch(walk, BULK_HYDRATE_CONCURRENCY - reading)
      for (const { assetId, cacheKey } of picks) {
        inflight.add(assetId)
        reading += 1
        void cache.get(cacheKey, THUMB_PRESET_ID).then(
          (got) => {
            reading -= 1
            ready.push({ assetId, got })
            fill()
            wake()
          },
          () => {
            // DerivedCache unavailable: misses stay with the mount path.
            stopped = true
            wake()
          },
        )
      }
    }
    fill()
    let slice = performance.now()
    for (;;) {
      if (!current()) {
        return
      }
      const read = stopped ? undefined : ready.shift()
      if (read === undefined) {
        if (stopped || reading === 0) {
          break
        }
        // A stale `wake` resolves a settled promise: a no-op.
        await new Promise<void>((resolve) => {
          wake = resolve
        })
        // While the strip scrolls, stores run only at the start of a frame.
        if (isFilmstripScrollQuiet()) {
          await nextSlice()
        }
        slice = performance.now()
        continue
      }
      if (!storeBulkRead(inflight, read)) {
        break
      }
      fill()
      if (performance.now() - slice >= FLUSH_MAX_MS) {
        await nextSlice()
        slice = performance.now()
      }
    }
  } catch {
    // DerivedCache unavailable: misses stay with the mount path.
  } finally {
    stopped = true
    // Ids left by the byte-budget stop or a failed read; nothing reads them now.
    inflight.clear()
    if (current()) {
      bulkStats.state = 'done'
      bulkStats.ms = performance.now() - started
    }
  }
}

/** Test seam: progress of the last restore bulk pass. */
export function getThumbBulkHydrateStatsForTests(): ThumbBulkHydrateStats {
  return { ...bulkStats }
}

/** Test seam: shrink the byte budget (undefined restores the default). */
export function setThumbCacheByteBudgetForTests(bytes?: number): void {
  byteBudget = bytes ?? DEFAULT_BYTE_BUDGET
  evictOverBudget()
}

/** Test seam: hot entries, their bytes, and queued notifies / reads. */
export function getThumbCacheStatsForTests(): {
  entries: number
  bytes: number
  pending: number
} {
  return {
    entries: entries.size,
    bytes: totalBytes,
    pending: pendingNotify.size + hydrateQueue.size + hydrateInflight.size,
  }
}

export function resetThumbCache(): void {
  bulkGeneration += 1
  bulkStats = idleBulkStats()
  putCacheKeys.clear()
  pendingNotify.clear()
  flushScheduled = false
  clearTimeout(flushWatchdogTimer)
  flushWatchdogTimer = undefined
  clearTimeout(quietFlushTimer)
  quietFlushTimer = undefined
  for (const controller of hydrateInflight.values()) {
    controller.abort()
  }
  hydrateQueue.clear()
  hydrateRunning.clear()
  hydrateInflight.clear()
  for (const [assetId, entry] of entries) {
    removeEntry(assetId, entry)
  }
  publishGeneration += 1
  for (const set of assetListeners.values()) {
    for (const listener of set) {
      listener()
    }
  }
  for (const listener of publishListeners) {
    listener()
  }
}
