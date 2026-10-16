import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'
import { ObjectUrlLru } from '../photo/objectUrlLru'

const DEFAULT_CAPACITY = 256
const FLUSH_PER_FRAME = 1

const lru = new ObjectUrlLru({ capacity: DEFAULT_CAPACITY })
const assetListeners = new Map<string, Set<() => void>>()

interface PendingThumb {
  assetId: string
  buffer: ArrayBuffer
  mimeType: string
}

const pending: PendingThumb[] = []
let flushScheduled = false

const hydrateInflight = new Map<string, AbortController>()

function notifyAsset(assetId: string): void {
  const set = assetListeners.get(assetId)
  if (set) {
    for (const listener of set) {
      listener()
    }
  }
}

function enqueuePending(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
): void {
  pending.push({ assetId, buffer, mimeType })
  if (!flushScheduled) {
    flushScheduled = true
    requestAnimationFrame(flushPending)
  }
}

function flushPending(): void {
  flushScheduled = false
  const batch = pending.splice(0, FLUSH_PER_FRAME)
  for (const item of batch) {
    const blob = new Blob([item.buffer], { type: item.mimeType })
    const url = URL.createObjectURL(blob)
    lru.set(item.assetId, url)
    notifyAsset(item.assetId)
  }
  if (pending.length > 0) {
    flushScheduled = true
    requestAnimationFrame(flushPending)
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

export function getThumbUrl(assetId: string): string | undefined {
  return lru.get(assetId)
}

export function setThumbUrl(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
  contentHash?: string,
): void {
  enqueuePending(assetId, buffer, mimeType)
  if (contentHash !== undefined && contentHash.length > 0) {
    void getDerivedCache().then((cache) =>
      cache.put(contentHash, THUMB_PRESET_ID, { bytes: buffer, mimeType }),
    )
  }
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
      enqueuePending(assetId, got.value.bytes, got.value.mimeType)
    } finally {
      if (hydrateInflight.get(assetId) === controller) {
        hydrateInflight.delete(assetId)
      }
    }
  })()
}

export function resetThumbCache(): void {
  pending.length = 0
  flushScheduled = false
  for (const controller of hydrateInflight.values()) {
    controller.abort()
  }
  hydrateInflight.clear()
  lru.clear()
  for (const set of assetListeners.values()) {
    for (const listener of set) {
      listener()
    }
  }
}
