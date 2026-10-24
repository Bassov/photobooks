/**
 * Map a GridList selection change to a gallery asset id.
 * `undefined` means leave the current selection unchanged (`keys === 'all'`).
 */
export function filmstripSelectionAssetId(
  keys: 'all' | { values: () => Iterator<unknown> },
): string | null | undefined {
  if (keys === 'all') {
    return undefined
  }
  const next: unknown = keys.values().next().value
  return typeof next === 'string' ? next : null
}
