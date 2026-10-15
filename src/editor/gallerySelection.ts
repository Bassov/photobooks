type Listener = () => void

let selected: string | null = null
const listeners = new Set<Listener>()

export function getSelectedAssetId(): string | null {
  return selected
}

export function setSelectedAssetId(assetId: string | null): void {
  if (selected === assetId) {
    return
  }
  selected = assetId
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
