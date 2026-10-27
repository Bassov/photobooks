import type { Selection } from 'react-aria-components'
import { getSelectedAssetIds, setSelectedAssetIds } from './gallerySelection'

type SelectionKeys = 'all' | { values: () => Iterator<unknown> }

/**
 * Apply a GridList selection change to the gallery selection store.
 * `'all'` selects `allIds` (Ctrl/Cmd+A). The primary is the key that was not
 * selected before (the one just picked), else the last key.
 */
export function applyFilmstripSelectionChange(
  keys: SelectionKeys,
  setSelected: (ids: readonly string[], primary: string | null) => void,
  allIds: readonly string[],
  previous: readonly string[],
): void {
  if (keys === 'all') {
    setSelected(allIds, allIds[allIds.length - 1] ?? null)
    return
  }
  const next: string[] = []
  const iterator = keys.values()
  for (let step = iterator.next(); step.done !== true; step = iterator.next()) {
    if (typeof step.value === 'string') {
      next.push(step.value)
    }
  }
  const added = next.filter((id) => !previous.includes(id))
  setSelected(next, added[added.length - 1] ?? next[next.length - 1] ?? null)
}

/**
 * GridList `onSelectionChange` handler for the current view ids. `remember`
 * receives the raw selection so its Shift-range anchor can be handed back.
 */
export function filmstripSelectionHandler(
  allIds: readonly string[],
  remember: (keys: Selection) => void,
): (keys: Selection) => void {
  return (keys) => {
    remember(keys)
    applyFilmstripSelectionChange(
      keys,
      setSelectedAssetIds,
      allIds,
      getSelectedAssetIds(),
    )
  }
}

/**
 * react-aria keeps the Shift-range anchor on its own Selection object: hand
 * that object back (not a plain array) while it still matches the store.
 */
export function matchingSelection(
  last: Selection | null,
  ids: readonly string[],
): Selection | readonly string[] {
  if (
    last !== null &&
    last !== 'all' &&
    last.size === ids.length &&
    ids.every((id) => last.has(id))
  ) {
    return last
  }
  return ids
}
