const notes = new Map<string, ReadonlyMap<string, number>>()
const desired = new Map<string, number>()
const shown = new Map<string, { url: string; tier: number }>()
const queued = new Set<string>()

interface TierDisplaySnapshot {
  version: number
  urls: ReadonlyMap<string, { url: string; tier: number }>
}

let version = 0
let snapshot: TierDisplaySnapshot = { version: 0, urls: new Map() }
const listeners = new Set<() => void>()

interface SwapJob {
  assetId: string
  tier: number
  url: string
}

const decodeQueue: SwapJob[] = []
let pumping = false

export function getTierDisplaySnapshot(): TierDisplaySnapshot {
  return snapshot
}

export function subscribeTierDisplay(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDisplayedPreview(assetId: string): string | undefined {
  return shown.get(assetId)?.url
}

export function maxDesiredTier(assetId: string): number | undefined {
  return desired.get(assetId)
}

export function setSpreadTiers(
  spreadId: string,
  tiers: ReadonlyMap<string, number>,
): void {
  notes.set(spreadId, tiers)
  recomputeDesired()
}

export function clearSpreadTiers(spreadId: string): void {
  if (!notes.delete(spreadId)) {
    return
  }
  recomputeDesired()
}

export function queueTierSwap(
  assetId: string,
  tier: number,
  url: string,
): void {
  if (desired.get(assetId) !== tier) {
    return
  }
  if (shown.get(assetId)?.url === url) {
    return
  }
  const key = swapKey(assetId, tier, url)
  if (queued.has(key)) {
    return
  }
  queued.add(key)
  decodeQueue.push({ assetId, tier, url })
  if (!pumping) {
    pumping = true
    void pumpSwaps()
  }
}

export function resetTierDisplay(): void {
  notes.clear()
  desired.clear()
  shown.clear()
  queued.clear()
  decodeQueue.length = 0
  pumping = false
  emit()
}

function recomputeDesired(): void {
  desired.clear()
  for (const spread of notes.values()) {
    for (const [assetId, tier] of spread) {
      const prev = desired.get(assetId)
      if (prev === undefined || tier > prev) {
        desired.set(assetId, tier)
      }
    }
  }
}

async function pumpSwaps(): Promise<void> {
  while (decodeQueue.length > 0) {
    const job = decodeQueue.shift()
    if (job === undefined) {
      break
    }
    const key = swapKey(job.assetId, job.tier, job.url)
    if (desired.get(job.assetId) !== job.tier) {
      queued.delete(key)
      continue
    }
    const image = new Image()
    image.decoding = 'async'
    image.src = job.url
    try {
      await image.decode()
    } catch {
      queued.delete(key)
      continue
    }
    if (desired.get(job.assetId) !== job.tier) {
      queued.delete(key)
      continue
    }
    queued.delete(key)
    shown.set(job.assetId, { url: job.url, tier: job.tier })
    emit()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  }
  pumping = false
}

function swapKey(assetId: string, tier: number, url: string): string {
  return `${assetId}:${String(tier)}:${url}`
}

function emit(): void {
  version += 1
  snapshot = { version, urls: new Map(shown) }
  for (const listener of listeners) {
    listener()
  }
}
