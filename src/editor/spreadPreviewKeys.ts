/**
 * Per-spread thumb/tier keys encode entries as `id:…` joined by `|`.
 * Asset ids must not contain `:` or `|` — `mintAssetId` sanitizes to
 * `asset-<n>-<safe>` (`[^\w.-]` → `_`), so prefix parse stays unambiguous.
 */

/** Asset ids placed on a resolved spread (stable order, deduped). */
export function assetIdsOnSpread(
  items: readonly { assetId?: string }[],
): readonly string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const assetId = item.assetId
    if (assetId === undefined || seen.has(assetId)) {
      continue
    }
    seen.add(assetId)
    ids.push(assetId)
  }
  return ids
}

export function thumbSnapshotFor(
  assetIds: readonly string[],
  getUrl: (assetId: string) => string | undefined,
): string {
  if (assetIds.length === 0) {
    return ''
  }
  return assetIds.map((id) => `${id}:${getUrl(id) ?? ''}`).join('|')
}

/** Thumb URL for an asset encoded in `thumbSnapshotFor` (empty → undefined). */
export function thumbUrlFromSnapshot(
  snapshot: string,
  assetId: string,
): string | undefined {
  const prefix = `${assetId}:`
  for (const part of snapshot.split('|')) {
    if (!part.startsWith(prefix)) {
      continue
    }
    const url = part.slice(prefix.length)
    return url.length > 0 ? url : undefined
  }
  return undefined
}

/**
 * Subscribe to each asset id; empty list is a no-op. Unsubscribe runs every
 * per-asset teardown (order matches subscribe).
 */
export function subscribeAssetIds(
  assetIds: readonly string[],
  subscribeOne: (assetId: string, listener: () => void) => () => void,
  listener: () => void,
): () => void {
  if (assetIds.length === 0) {
    return () => undefined
  }
  const unsubs = assetIds.map((assetId) => subscribeOne(assetId, listener))
  return () => {
    for (const unsub of unsubs) {
      unsub()
    }
  }
}

/** Longest edge in CSS px for tier selection (width vs height). */
export function frameEdgePx(
  rectMm: { width: number; height: number },
  pxPerMm: number,
): number {
  return Math.max(rectMm.width, rectMm.height) * pxPerMm
}

/** `devicePixelRatio` when finite and positive; otherwise 1. */
export function positiveDevicePixelRatio(
  ratio: number | undefined = globalThis.devicePixelRatio,
): number {
  return typeof ratio === 'number' && ratio > 0 ? ratio : 1
}

/** Max desired decode tier per asset on a spread at the given zoom. */
export function desiredTiersForItems(
  items: readonly {
    assetId?: string
    rectMm: { width: number; height: number }
  }[],
  zoom: number,
  dpr: number,
  pxPerMm: number,
  selectTier: (cssPx: number, dpr: number) => number,
): Map<string, number> {
  const tiers = new Map<string, number>()
  for (const item of items) {
    const assetId = item.assetId
    if (assetId === undefined) {
      continue
    }
    const tier = selectTier(frameEdgePx(item.rectMm, pxPerMm) * zoom, dpr)
    const prev = tiers.get(assetId)
    if (prev === undefined || tier > prev) {
      tiers.set(assetId, tier)
    }
  }
  return tiers
}

/** Whether this frame is the pressed move-source on this spread. */
export function isFramePressed(
  frameSourceKey: string | null,
  frameId: string,
): boolean {
  return (
    frameSourceKey !== null &&
    frameSourceKey !== '' &&
    frameSourceKey === frameId
  )
}

/** Covering tier URL, book preview, then filmstrip thumb from the snapshot. */
export function resolveSpreadPreviewUrl(
  assetId: string,
  tierDisplayKey: string,
  thumbSnapshot: string,
  bookPreviewUrl: string | undefined,
): string | undefined {
  const covering = tierUrlFromKey(tierDisplayKey, assetId) ?? bookPreviewUrl
  if (covering !== undefined) {
    return covering
  }
  return thumbUrlFromSnapshot(thumbSnapshot, assetId)
}

/** Prefer global max desired tier; fall back to this spread's note. */
export function resolveMaxDesiredTier(
  assetId: string,
  spreadTier: number,
  maxDesired: (id: string) => number | undefined,
): number {
  return maxDesired(assetId) ?? spreadTier
}

/** Queue a display swap when the tier URL is already cached. */
export function queueReadyTierIfCached(
  assetId: string,
  tier: number,
  getUrl: (assetId: string, tier: number) => string | undefined,
  queue: (assetId: string, tier: number, url: string) => void,
): void {
  const ready = getUrl(assetId, tier)
  if (ready !== undefined) {
    queue(assetId, tier, ready)
  }
}

/**
 * Queue every already-cached ladder step up to the desired covering tier so a
 * lower hot URL can show while the covering encode/decode is still pending.
 */
export function queueCachedLadderTiers(
  assetId: string,
  desiredTier: number,
  ladder: readonly number[],
  getUrl: (assetId: string, tier: number) => string | undefined,
  queue: (assetId: string, tier: number, url: string) => void,
): void {
  for (const step of ladder) {
    if (step > desiredTier) {
      break
    }
    queueReadyTierIfCached(assetId, step, getUrl, queue)
  }
}

/** Stable key so unrelated tier swaps do not re-render this spread. */
export function tierDisplayKeyFor(
  assetIds: readonly string[],
  urls: ReadonlyMap<string, { url: string; tier: number }>,
): string {
  if (assetIds.length === 0) {
    return ''
  }
  return assetIds
    .map((id) => {
      const shown = urls.get(id)
      return shown === undefined
        ? `${id}:`
        : `${id}:${String(shown.tier)}:${shown.url}`
    })
    .join('|')
}

export function tierUrlFromKey(
  key: string,
  assetId: string,
): string | undefined {
  const prefix = `${assetId}:`
  for (const part of key.split('|')) {
    if (!part.startsWith(prefix)) {
      continue
    }
    const rest = part.slice(prefix.length)
    const sep = rest.indexOf(':')
    if (sep < 0) {
      return undefined
    }
    const url = rest.slice(sep + 1)
    return url.length > 0 ? url : undefined
  }
  return undefined
}

export function tierNumberFromKey(
  key: string,
  assetId: string,
): number | undefined {
  const prefix = `${assetId}:`
  for (const part of key.split('|')) {
    if (!part.startsWith(prefix)) {
      continue
    }
    const rest = part.slice(prefix.length)
    const sep = rest.indexOf(':')
    if (sep < 0) {
      return undefined
    }
    const tierPart = rest.slice(0, sep)
    if (tierPart.length === 0) {
      return undefined
    }
    const tier = Number(tierPart)
    return Number.isFinite(tier) ? tier : undefined
  }
  return undefined
}
