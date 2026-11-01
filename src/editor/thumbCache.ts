import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'
import { noteDecodeScrollActivity } from '../photo/decodeScrollQuiet'
import { subscribeAssetRemovals } from './bookStore'
import {
  filmstripScrollQuietRemainingMs,
  isFilmstripScrollQuiet,
  noteFilmstripScrollActivity,
} from './filmstripScrollQuiet'
import { trackHashJob } from './pendingHashes'
import { restoreAspectFromPreview } from './previewAspect'
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

subscribeAssetRemovals((assetIds) => {
  for (const assetId of assetIds) {
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
    const { bytes, mimeType } = got.value
    restoreAspectFromPreview(assetId, bytes, mimeType)
    storeThumb(assetId, new Blob([bytes], { type: mimeType }))
  }
  return false
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
