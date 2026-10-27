import { getPlacementCountSnapshot, removeAssetFromGallery } from './bookStore'
import { getSelectedAssetId, setSelectedAssetId } from './gallerySelection'
import { setEditorStatus } from './editorStatus'

type Listener = () => void

let pending: string | null = null
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function getPendingGalleryRemoveId(): string | null {
  return pending
}

export function subscribePendingGalleryRemove(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function cancelGalleryRemove(): void {
  if (pending !== null) {
    pending = null
    emit()
  }
}

function removeNow(assetId: string, name: string): void {
  if (getSelectedAssetId() === assetId) {
    setSelectedAssetId(null)
  }
  removeAssetFromGallery(assetId)
  setEditorStatus(`${name} removed from the gallery — the file stays on disk`)
}

/** Remove now when unplaced; otherwise ask first (placed frames will empty). */
export function requestGalleryRemove(assetId: string, name: string): void {
  if (getPlacementCountSnapshot(assetId) > 0) {
    pending = assetId
    emit()
    return
  }
  removeNow(assetId, name)
}

export function confirmGalleryRemove(name: string): void {
  const assetId = pending
  pending = null
  emit()
  if (assetId !== null) {
    removeNow(assetId, name)
  }
}
