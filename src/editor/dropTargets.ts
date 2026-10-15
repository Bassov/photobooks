import type { RectMm } from '../core'
import { frameBox } from '../render/frameBox'

export const ASSET_DRAG_MIME = 'application/x-photobooks-asset'

export const FRAME_DRAG_MIME = 'application/x-photobooks-frame'

export interface FrameDragSource {
  spreadId: string
  frameId: string
}

export type FrameActivation =
  | { type: 'place'; assetId: string }
  | { type: 'replace'; assetId: string }
  | { type: 'select-source' }
  | { type: 'clear-source' }
  | { type: 'swap'; source: FrameDragSource }
  | { type: 'noop' }

export function encodeFrameDrag(source: FrameDragSource): string {
  return `${source.spreadId}\n${source.frameId}`
}

export function decodeFrameDrag(payload: string): FrameDragSource | null {
  const split = payload.indexOf('\n')
  if (
    split <= 0 ||
    split !== payload.lastIndexOf('\n') ||
    split >= payload.length - 1
  ) {
    return null
  }
  return {
    spreadId: payload.slice(0, split),
    frameId: payload.slice(split + 1),
  }
}

export function resolveFrameActivation(input: {
  galleryAssetId: string | null
  source: FrameDragSource | null
  target: FrameDragSource & { filled: boolean }
}): FrameActivation {
  const galleryAssetId = input.galleryAssetId
  if (galleryAssetId !== null && galleryAssetId !== '') {
    return input.target.filled
      ? { type: 'replace', assetId: galleryAssetId }
      : { type: 'place', assetId: galleryAssetId }
  }
  const source = input.source
  if (source === null) {
    return input.target.filled ? { type: 'select-source' } : { type: 'noop' }
  }
  if (
    source.spreadId === input.target.spreadId &&
    source.frameId === input.target.frameId
  ) {
    return { type: 'clear-source' }
  }
  return { type: 'swap', source }
}

export interface DropFrameInput {
  frameId: string
  z: number
  filled: boolean
  rectMm: RectMm
}

export interface DropSpreadInput {
  spreadId: string
  spreadWidthPx: number
  items: readonly DropFrameInput[]
}

export interface DropIndexInput {
  spreads: readonly DropSpreadInput[]
  pxPerMm: number
  stridePx: number
  worldWidthPx: number
}

export interface DropTarget {
  spreadId: string
  frameId: string
  filled: boolean
}

interface IndexedFrame extends DropTarget {
  left: number
  top: number
  right: number
  bottom: number
  z: number
}

export interface DropIndex {
  readonly frames: readonly IndexedFrame[]
}

export function buildDropIndex(input: DropIndexInput): DropIndex {
  const frames: IndexedFrame[] = []
  const pxPerMm = input.pxPerMm
  const stride = input.stridePx
  if (!Number.isFinite(pxPerMm) || !Number.isFinite(stride) || stride <= 0) {
    return { frames }
  }
  const worldWidth = Number.isFinite(input.worldWidthPx)
    ? input.worldWidthPx
    : 0
  for (let index = 0; index < input.spreads.length; index += 1) {
    const spread = input.spreads[index]
    if (spread === undefined) {
      continue
    }
    const spreadWidth = Number.isFinite(spread.spreadWidthPx)
      ? spread.spreadWidthPx
      : 0
    const offsetX = (worldWidth - spreadWidth) / 2
    const originY = index * stride
    for (const item of spread.items) {
      const box = frameBox(item.rectMm, pxPerMm)
      if (!(box.width > 0) || !(box.height > 0)) {
        continue
      }
      frames.push({
        spreadId: spread.spreadId,
        frameId: item.frameId,
        filled: item.filled,
        z: item.z,
        left: offsetX + box.left,
        top: originY + box.top,
        right: offsetX + box.left + box.width,
        bottom: originY + box.top + box.height,
      })
    }
  }
  return { frames }
}

/** Point-in-rect scan. Returns the stored target; allocates nothing. */
export function hitTestDrop(
  index: DropIndex,
  x: number,
  y: number,
): DropTarget | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined
  }
  let best: IndexedFrame | undefined
  for (const frame of index.frames) {
    if (
      x < frame.left ||
      x >= frame.right ||
      y < frame.top ||
      y >= frame.bottom
    ) {
      continue
    }
    if (best === undefined || frame.z >= best.z) {
      best = frame
    }
  }
  return best
}

export function isAssetDrag(
  dataTransfer: DataTransfer | null | undefined,
): boolean {
  return dragTypeIncludes(dataTransfer, ASSET_DRAG_MIME)
}

export function isFrameDrag(
  dataTransfer: DataTransfer | null | undefined,
): boolean {
  return dragTypeIncludes(dataTransfer, FRAME_DRAG_MIME)
}

function dragTypeIncludes(
  dataTransfer: DataTransfer | null | undefined,
  mime: string,
): boolean {
  if (dataTransfer == null) {
    return false
  }
  for (const type of dataTransfer.types) {
    if (type === mime) {
      return true
    }
  }
  return false
}
