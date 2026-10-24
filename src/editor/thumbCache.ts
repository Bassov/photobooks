import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'
import { ObjectUrlLru } from '../photo/objectUrlLru'
import {
  filmstripScrollQuietRemainingMs,
  isFilmstripScrollQuiet,
  noteFilmstripScrollActivity,
} from './filmstripScrollQuiet'
import { trackHashJob } from './pendingHashes'
import { restoreAspectFromPreview } from './previewAspect'

const DEFAULT_CAPACITY = 256
/** Cap React notifies per frame so bulk import+scroll stays within LoAF. */
const FLUSH_PER_FRAME = 1
/** Matches bookStore gallery flush: progress if rAF freezes (background tab). */
const FLUSH_RAF_WATCHDOG_MS = 32

const lru = new ObjectUrlLru({ capacity: DEFAULT_CAPACITY })
const assetListeners = new Map<string, Set<() => void>>()
const publishListeners = new Set<() => void>()
let publishGeneration = 0

const hydrateInflight = new Map<string, AbortController>()

/** Last encoded thumb bytes per asset for put-after-hash. */
const lastThumb = new Map<string, { buffer: ArrayBuffer; mimeType: string }>()

/** Identity digests already written to DerivedCache this session (skip re-puts). */
const putCacheKeys = new Set<string>()

interface PendingThumb {
  assetId: string
  buffer: ArrayBuffer
  mimeType: string
}

const pendingById = new Map<string, PendingThumb>()
let flushScheduled = false
let flushWatchdogTimer: ReturnType<typeof setTimeout> | undefined

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

function publishThumbNow(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
): void {
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  lru.set(assetId, url)
  notifyAsset(assetId)
}

function flushPending(): void {
  if (isFilmstripScrollQuiet()) {
    scheduleFlushAfter(filmstripScrollQuietRemainingMs())
    return
  }
  let published = 0
  for (const [id, item] of pendingById) {
    if (published >= FLUSH_PER_FRAME) {
      break
    }
    pendingById.delete(id)
    publishThumbNow(item.assetId, item.buffer, item.mimeType)
    published += 1
  }
  if (pendingById.size > 0) {
    scheduleFlush()
  }
}

function scheduleFlushAfter(delayMs: number): void {
  if (flushScheduled) {
    return
  }
  flushScheduled = true
  flushWatchdogTimer = setTimeout(
    () => {
      flushScheduled = false
      flushWatchdogTimer = undefined
      flushPending()
    },
    Math.max(0, delayMs),
  )
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
 * Call from filmstrip scroll so thumb publishes wait for a quiet frame —
 * avoids stacking React notifies on scroll-during-import LoAF windows.
 * In-flight flushes re-check quiet in `flushPending`; no reschedule needed.
 */
export function noteFilmstripScroll(): void {
  noteFilmstripScrollActivity()
}

function enqueuePublish(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
): void {
  pendingById.set(assetId, { assetId, buffer, mimeType })
  scheduleFlush()
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

export function getThumbUrl(assetId: string): string | undefined {
  return lru.get(assetId)
}

/** True when a hot or pending-in-session thumb exists (incl. before rAF publish). */
export function hasThumbData(assetId: string): boolean {
  return lru.has(assetId) || lastThumb.has(assetId)
}

export function setThumbUrl(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
  cacheKey?: string,
): void {
  // Retain a copy so callers can reuse/detach the source buffer safely.
  const retained = buffer.slice(0)
  lastThumb.set(assetId, { buffer: retained, mimeType })
  enqueuePublish(assetId, retained, mimeType)
  if (cacheKey !== undefined && cacheKey.length > 0) {
    // Encode-after-identity path: put must be awaited by Save
    // (awaitPendingHashes), otherwise reload hydrates gray placeholders.
    void trackHashJob(putThumbForKey(cacheKey, retained, mimeType))
  }
}

async function putThumbForKey(
  cacheKey: string,
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<void> {
  if (putCacheKeys.has(cacheKey)) {
    return
  }
  putCacheKeys.add(cacheKey)
  const cache = await getDerivedCache()
  // `buffer` is already a retained copy from setThumbUrl / lastThumb.
  await cache.put(cacheKey, THUMB_PRESET_ID, {
    bytes: buffer,
    mimeType,
  })
}

/** Put the last hot thumb into DerivedCache once the identity cache key is known. */
export async function putCachedThumbForHash(
  assetId: string,
  cacheKey: string,
): Promise<void> {
  if (cacheKey.length === 0) {
    return
  }
  const last = lastThumb.get(assetId)
  if (last === undefined) {
    return
  }
  await putThumbForKey(cacheKey, last.buffer, last.mimeType)
}

export function ensureThumb(assetId: string, cacheKey?: string): void {
  if (lru.has(assetId) || hydrateInflight.has(assetId)) {
    return
  }
  // Remount after LRU eviction during import: republish in-session bytes
  // before identity / DerivedCache are available.
  const hot = lastThumb.get(assetId)
  if (hot !== undefined) {
    enqueuePublish(assetId, hot.buffer, hot.mimeType)
    return
  }
  if (cacheKey === undefined || cacheKey.length === 0) {
    return
  }
  const controller = new AbortController()
  hydrateInflight.set(assetId, controller)
  void (async () => {
    try {
      const cache = await getDerivedCache()
      if (hydrateInflight.get(assetId) !== controller) {
        return
      }
      const got = await cache.get(cacheKey, THUMB_PRESET_ID)
      if (hydrateInflight.get(assetId) !== controller || !got.ok) {
        return
      }
      if (lru.has(assetId)) {
        return
      }
      const bytes = got.value.bytes.slice(0)
      lastThumb.set(assetId, {
        buffer: bytes,
        mimeType: got.value.mimeType,
      })
      restoreAspectFromPreview(assetId, bytes, got.value.mimeType)
      enqueuePublish(assetId, bytes, got.value.mimeType)
    } finally {
      if (hydrateInflight.get(assetId) === controller) {
        hydrateInflight.delete(assetId)
      }
    }
  })()
}

/**
 * Test seam: revoke the hot object URL while keeping lastThumb bytes so
 * remount-after-eviction (ensureThumb without cacheKey) can be asserted.
 */
export function dropHotThumbUrlForTests(assetId: string): void {
  lru.delete(assetId)
}

export function resetThumbCache(): void {
  lastThumb.clear()
  putCacheKeys.clear()
  pendingById.clear()
  flushScheduled = false
  clearTimeout(flushWatchdogTimer)
  flushWatchdogTimer = undefined
  for (const controller of hydrateInflight.values()) {
    controller.abort()
  }
  hydrateInflight.clear()
  lru.clear()
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
