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

function notifyAsset(assetId: string): void {
  const set = assetListeners.get(assetId)
  if (set) {
    for (const listener of set) {
      listener()
    }
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
): void {
  pending.push({ assetId, buffer, mimeType })
  if (!flushScheduled) {
    flushScheduled = true
    requestAnimationFrame(flushPending)
  }
}

export function resetThumbCache(): void {
  pending.length = 0
  flushScheduled = false
  lru.clear()
  for (const set of assetListeners.values()) {
    for (const listener of set) {
      listener()
    }
  }
}
