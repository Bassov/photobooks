import { setFrameSource, withSelectionSync } from './frameSelection'

type Listener = () => void

let selected: string | null = null
const listeners = new Set<Listener>()

export function getSelectedAssetId(): string | null {
  return selected
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
  if (selected === assetId) {
    return
  }
  selected = assetId
  emit()
  if (assetId !== null) {
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
