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
    if (rest.length === 0) {
      return undefined
    }
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
    if (rest.length === 0) {
      return undefined
    }
    const sep = rest.indexOf(':')
    if (sep < 0) {
      return undefined
    }
    const tier = Number(rest.slice(0, sep))
    return Number.isFinite(tier) ? tier : undefined
  }
  return undefined
}
