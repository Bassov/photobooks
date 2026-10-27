import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'

export interface CropTarget {
  spreadId: string
  frameId: string
}

type Listener = () => void

let target: (CropTarget & { assetId: string }) | null = null
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function findAssetId(spreadId: string, frameId: string): string | undefined {
  const spread = getBookStoreSnapshot().book.spreads.find(
    (item) => item.id === spreadId,
  )
  return spread?.frames.find((frame) => frame.id === frameId)?.assetId
}

export function getCropTarget(): CropTarget | null {
  return target
}

/** Stable per-frame key (`spreadId/frameId`) or `''` outside crop mode. */
export function getCropTargetKey(): string {
  return target === null ? '' : `${target.spreadId}/${target.frameId}`
}

export function subscribeCropMode(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Enter crop mode on a filled frame; no-op for empty / unknown frames. */
export function enterCropMode(spreadId: string, frameId: string): void {
  const assetId = findAssetId(spreadId, frameId)
  if (assetId === undefined) {
    return
  }
  if (
    target?.spreadId === spreadId &&
    target.frameId === frameId &&
    target.assetId === assetId
  ) {
    return
  }
  target = { spreadId, frameId, assetId }
  emit()
}

export function exitCropMode(): void {
  if (target === null) {
    return
  }
  target = null
  emit()
}

subscribeBookStore(() => {
  if (target === null) {
    return
  }
  if (findAssetId(target.spreadId, target.frameId) !== target.assetId) {
    exitCropMode()
  }
})
