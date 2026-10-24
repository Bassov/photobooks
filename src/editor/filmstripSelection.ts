import { setSelectedAssetId } from './gallerySelection'

type SelectionKeys = 'all' | { values: () => Iterator<unknown> }

/**
 * Apply a GridList selection change to the gallery selection store.
 * The `'all'` sentinel is ignored (leave the current selection unchanged).
 */
export function applyFilmstripSelectionChange(
  keys: SelectionKeys,
  setSelected: (assetId: string | null) => void,
): void {
  if (keys === 'all') {
    return
  }
  const next: unknown = keys.values().next().value
  setSelected(typeof next === 'string' ? next : null)
}

/** Stable GridList `onSelectionChange` handler for the filmstrip track. */
export function onFilmstripGridSelectionChange(keys: SelectionKeys): void {
  applyFilmstripSelectionChange(keys, setSelectedAssetId)
}
