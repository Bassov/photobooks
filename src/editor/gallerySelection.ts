import { setFrameSource, withSelectionSync } from './frameSelection'

type Listener = () => void

const NONE: readonly string[] = []

/** Primary = the most recently picked photo; `ids` = the whole selection. */
let selected: string | null = null
let ids: readonly string[] = NONE
const listeners = new Set<Listener>()

export function getSelectedAssetId(): string | null {
  return selected
}

/** Stable snapshot: identity changes only when the selection changes. */
export function getSelectedAssetIds(): readonly string[] {
  return ids
}

export function getGalleryPhotoSelected(): boolean {
  return selected !== null
}

export function subscribeGalleryPhotoSelected(listener: Listener): () => void {
  let current = getGalleryPhotoSelected()
  return subscribeGallerySelection(() => {
    const next = getGalleryPhotoSelected()
    if (next === current) {
      return
    }
    current = next
    listener()
  })
}

export function setSelectedAssetId(assetId: string | null): void {
  setSelectedAssetIds(assetId === null ? NONE : [assetId], assetId)
}

/** Replace the selection; `primary` defaults to the last id. */
export function setSelectedAssetIds(
  next: readonly string[],
  primary: string | null = next[next.length - 1] ?? null,
): void {
  const unique = [...new Set(next)]
  const nextPrimary = unique.length === 0 ? null : primary
  const same =
    nextPrimary === selected &&
    unique.length === ids.length &&
    unique.every((id, index) => id === ids[index])
  if (same) {
    return
  }
  selected = nextPrimary
  ids = unique.length === 0 ? NONE : unique
  emit()
  if (nextPrimary !== null) {
    withSelectionSync(() => {
      setFrameSource(null)
    })
  }
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeGallerySelection(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetGallerySelection(): void {
  setSelectedAssetId(null)
}
