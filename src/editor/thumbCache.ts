import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'
import { ObjectUrlLru } from '../photo/objectUrlLru'
import { trackHashJob } from './pendingHashes'
import { restoreAspectFromPreview } from './previewAspect'

const DEFAULT_CAPACITY = 256
/** Cap React notifies per frame so bulk import+scroll stays within LoAF. */
const FLUSH_PER_FRAME = 4
/** Matches bookStore gallery flush: progress if rAF freezes (background tab). */
const FLUSH_RAF_WATCHDOG_MS = 32

const lru = new ObjectUrlLru({ capacity: DEFAULT_CAPACITY })
const assetListeners = new Map<string, Set<() => void>>()
const publishListeners = new Set<() => void>()
let publishGeneration = 0

const hydrateInflight = new Map<string, AbortController>()

/** Last encoded thumb bytes per asset for put-after-hash. */
const lastThumb = new Map<string, { buffer: ArrayBuffer; mimeType: string }>()

/** contentHashes already written to DerivedCache this session (skip re-puts). */
const putContentHashes = new Set<string>()

interface PendingThumb {
  assetId: string
  buffer: ArrayBuffer
  mimeType: string
}

const pendingById = new Map<string, PendingThumb>()
const pendingOrder: string[] = []
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
  const batchIds = pendingOrder.splice(0, FLUSH_PER_FRAME)
  for (const id of batchIds) {
    const item = pendingById.get(id)
    pendingById.delete(id)
    if (item === undefined) {
      continue
    }
    publishThumbNow(item.assetId, item.buffer, item.mimeType)
  }
  if (pendingOrder.length > 0) {
    scheduleFlush()
  }
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
    if (flushWatchdogTimer !== undefined) {
      clearTimeout(flushWatchdogTimer)
      flushWatchdogTimer = undefined
    }
    flushPending()
  }
  // Prefer rAF for LoAF pacing; watchdog still fires if rAF is frozen after
  // the page was backgrounded (parallel Playwright). Immediate publish was
  // used previously because rAF-only queues stalled without a watchdog.
  requestAnimationFrame(run)
  flushWatchdogTimer = setTimeout(run, FLUSH_RAF_WATCHDOG_MS)
}

function enqueuePublish(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
): void {
  if (!pendingById.has(assetId)) {
    pendingOrder.push(assetId)
  }
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

export function setThumbUrl(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
  contentHash?: string,
): void {
  const retained = buffer.slice(0)
  lastThumb.set(assetId, { buffer: retained, mimeType })
  enqueuePublish(assetId, retained, mimeType)
  if (contentHash !== undefined && contentHash.length > 0) {
    // Encode-after-hash path: put must be awaited by Save (awaitPendingHashes),
    // otherwise reload hydrates gray placeholders for late gallery assets.
    void trackHashJob(putThumbForHash(contentHash, retained, mimeType))
  }
}

async function putThumbForHash(
  contentHash: string,
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<void> {
  if (putContentHashes.has(contentHash)) {
    return
  }
  putContentHashes.add(contentHash)
  const cache = await getDerivedCache()
  // `buffer` is already a retained copy from setThumbUrl / lastThumb.
  await cache.put(contentHash, THUMB_PRESET_ID, {
    bytes: buffer,
    mimeType,
  })
}

/** Put the last hot thumb into DerivedCache once contentHash is known. */
export async function putCachedThumbForHash(
  assetId: string,
  contentHash: string,
): Promise<void> {
  if (contentHash.length === 0) {
    return
  }
  const last = lastThumb.get(assetId)
  if (last === undefined) {
    return
  }
  await putThumbForHash(contentHash, last.buffer, last.mimeType)
}

export function ensureThumb(assetId: string, contentHash?: string): void {
  if (lru.has(assetId) || hydrateInflight.has(assetId)) {
    return
  }
  if (contentHash === undefined || contentHash.length === 0) {
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
      const got = await cache.get(contentHash, THUMB_PRESET_ID)
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

export function resetThumbCache(): void {
  lastThumb.clear()
  putContentHashes.clear()
  pendingById.clear()
  pendingOrder.length = 0
  flushScheduled = false
  if (flushWatchdogTimer !== undefined) {
    clearTimeout(flushWatchdogTimer)
    flushWatchdogTimer = undefined
  }
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
