import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID, tierPresetId } from '../assets/derivedCache/presets'
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

/** Last encoded tier bytes per cache key for put-after-hash. */
const lastTier = new Map<string, { buffer: ArrayBuffer; mimeType: string }>()

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

export function requestTier(
  assetId: string,
  tier: number,
  contentHash?: string,
): void {
  const key = tierCacheKey(assetId, tier)
  if (lru.has(key) || inflight.has(key)) {
    return
  }
  const controller = new AbortController()
  inflight.set(key, { controller })

  void (async () => {
    try {
      if (contentHash !== undefined && contentHash.length > 0) {
        const cache = await getDerivedCache()
        if (inflight.get(key)?.controller !== controller) {
          return
        }
        const got = await cache.get(contentHash, tierPresetId(tier))
        if (inflight.get(key)?.controller !== controller) {
          return
        }
        if (got.ok) {
          const bytes = got.value.bytes.slice(0)
          lastTier.set(key, { buffer: bytes, mimeType: got.value.mimeType })
          pending.push({
            key,
            buffer: bytes,
            mimeType: got.value.mimeType,
          })
          scheduleFlush()
          return
        }
      }

      const file = getAssetSource(assetId)
      if (file === undefined) {
        if (contentHash !== undefined && contentHash.length > 0) {
          const cache = await getDerivedCache()
          if (inflight.get(key)?.controller !== controller) {
            return
          }
          const thumb = await cache.get(contentHash, THUMB_PRESET_ID)
          if (inflight.get(key)?.controller !== controller || !thumb.ok) {
            return
          }
          const bytes = thumb.value.bytes.slice(0)
          lastTier.set(key, { buffer: bytes, mimeType: thumb.value.mimeType })
          pending.push({
            key,
            buffer: bytes,
            mimeType: thumb.value.mimeType,
          })
          scheduleFlush()
        }
        return
      }
      const cover = assetSourceCovers(assetId)
      try {
        const result = await processAsset({
          assetId,
          file,
          priority: 'zoom',
          maxEdge: tier,
          signal: controller.signal,
          cover,
        })
        if (inflight.get(key)?.controller !== controller) {
          return
        }
        const retained = result.previewBuffer.slice(0)
        lastTier.set(key, {
          buffer: retained,
          mimeType: result.previewMimeType,
        })
        if (contentHash !== undefined && contentHash.length > 0) {
          const cache = await getDerivedCache()
          await cache.put(contentHash, tierPresetId(tier), {
            bytes: retained.slice(0),
            mimeType: result.previewMimeType,
          })
        }
        if (inflight.get(key)?.controller !== controller) {
          return
        }
        pending.push({
          key,
          buffer: retained,
          mimeType: result.previewMimeType,
        })
        scheduleFlush()
      } catch {
        // Aborted and failed tier jobs stay uncached; the caller can request again.
      }
    } finally {
      if (inflight.get(key)?.controller === controller) {
        inflight.delete(key)
      }
    }
  })()
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

/** Put last hot tier buffers for an asset into DerivedCache once hash is known. */
export async function putCachedTierForHash(
  assetId: string,
  contentHash: string,
): Promise<void> {
  if (contentHash.length === 0) {
    return
  }
  const prefix = `${assetId}:`
  const cache = await getDerivedCache()
  const puts: Promise<unknown>[] = []
  for (const [key, entry] of lastTier) {
    if (!key.startsWith(prefix)) {
      continue
    }
    const tierPart = key.slice(prefix.length)
    const tier = Number(tierPart)
    if (!Number.isFinite(tier)) {
      continue
    }
    puts.push(
      cache.put(contentHash, tierPresetId(tier), {
        bytes: entry.buffer.slice(0),
        mimeType: entry.mimeType,
      }),
    )
  }
  await Promise.all(puts)
}

export function resetTierCache(): void {
  pending.length = 0
  flushScheduled = false
  lastTier.clear()
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
