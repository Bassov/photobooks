import { processAsset } from './assetPool'
import { assetSourceCovers, getAssetSource } from './assetSources'
import { ObjectUrlLru } from './objectUrlLru'

export const TIER_CACHE_CAPACITY = 48

const lru = new ObjectUrlLru({ capacity: TIER_CACHE_CAPACITY })
const listeners = new Map<string, Set<() => void>>()

interface Inflight {
  controller: AbortController
}

const inflight = new Map<string, Inflight>()

interface PendingTier {
  key: string
  buffer: ArrayBuffer
  mimeType: string
}

const pending: PendingTier[] = []
let flushScheduled = false

function tierCacheKey(assetId: string, tier: number): string {
  return `${assetId}:${String(tier)}`
}

export function getTierUrl(assetId: string, tier: number): string | undefined {
  return lru.get(tierCacheKey(assetId, tier))
}

export function subscribeTier(
  assetId: string,
  tier: number,
  listener: () => void,
): () => void {
  const key = tierCacheKey(assetId, tier)
  const set = listeners.get(key) ?? new Set()
  set.add(listener)
  listeners.set(key, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) {
      listeners.delete(key)
      cancelTier(assetId, tier)
    }
  }
}

export function requestTier(assetId: string, tier: number): void {
  const key = tierCacheKey(assetId, tier)
  if (lru.has(key) || inflight.has(key)) {
    return
  }
  const file = getAssetSource(assetId)
  if (file === undefined) {
    return
  }
  const controller = new AbortController()
  inflight.set(key, { controller })
  const cover = assetSourceCovers(assetId)
  void processAsset({
    assetId,
    file,
    priority: 'zoom',
    maxEdge: tier,
    signal: controller.signal,
    cover,
  })
    .then((result) => {
      if (controller.signal.aborted) {
        return
      }
      pending.push({
        key,
        buffer: result.previewBuffer,
        mimeType: result.previewMimeType,
      })
      scheduleFlush()
    })
    .catch(() => {
      // Aborted and failed tier jobs stay uncached; the caller can request again.
    })
    .finally(() => {
      if (inflight.get(key)?.controller === controller) {
        inflight.delete(key)
      }
    })
}

export function cancelTier(assetId: string, tier: number): void {
  const key = tierCacheKey(assetId, tier)
  const job = inflight.get(key)
  if (job === undefined) {
    return
  }
  inflight.delete(key)
  job.controller.abort()
}

export function resetTierCache(): void {
  pending.length = 0
  flushScheduled = false
  for (const job of inflight.values()) {
    job.controller.abort()
  }
  inflight.clear()
  lru.clear()
  for (const set of listeners.values()) {
    for (const listener of set) {
      listener()
    }
  }
}

function scheduleFlush(): void {
  if (flushScheduled) {
    return
  }
  flushScheduled = true
  requestAnimationFrame(flushPending)
}

function flushPending(): void {
  flushScheduled = false
  const batch = pending.splice(0, 1)
  for (const item of batch) {
    const blob = new Blob([item.buffer], { type: item.mimeType })
    const url = URL.createObjectURL(blob)
    lru.set(item.key, url)
    const set = listeners.get(item.key)
    if (set) {
      for (const listener of set) {
        listener()
      }
    }
  }
  if (pending.length > 0) {
    flushScheduled = true
    requestAnimationFrame(flushPending)
  }
}
