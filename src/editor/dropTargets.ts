import { getSinglePageSide, type RectMm } from '../core'
import { frameBox } from '../render/frameBox'
import { slotPageLeftPx } from './pasteboardView'

export const ASSET_DRAG_MIME = 'application/x-photobooks-asset'

export const FRAME_DRAG_MIME = 'application/x-photobooks-frame'

/** Newline-joined asset ids when a multi-selection is dragged. */
export const ASSET_MULTI_MIME = 'application/x-photobooks-assets'

/** Minimum height of the "new spread" zone under each spread. */
const GAP_ZONE_MIN_PX = 16

export function encodeAssetIds(ids: readonly string[]): string {
  return ids.join('\n')
}

export function decodeAssetIds(payload: string): string[] {
  return payload.split('\n').filter((id) => id !== '')
}

export interface FrameDragSource {
  spreadId: string
  frameId: string
}

export type FrameActivation =
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

/** A mouse / pen / touch click reports `detail ≥ 1`; Enter / Space report 0. */
export function isPointerActivation(event?: { detail: number }): boolean {
  return event !== undefined && event.detail > 0
}

export function resolveFrameActivation(input: {
  source: FrameDragSource | null
  target: FrameDragSource & { filled: boolean }
  /** False when the selected source is an empty frame (nothing to move). */
  sourceFilled?: boolean
  /** Pointer click: the selected frame stays selected (kit canvas). */
  pointer?: boolean
}): FrameActivation {
  const source = input.source
  if (source === null) {
    return { type: 'select-source' }
  }
  if (
    source.spreadId === input.target.spreadId &&
    source.frameId === input.target.frameId
  ) {
    // Keyboard keeps the aria-pressed toggle ("Cancel move").
    return input.pointer === true ? { type: 'noop' } : { type: 'clear-source' }
  }
  if (input.sourceFilled === false) {
    return { type: 'select-source' }
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
  /** Painted spread height; the "new spread" zone starts there (default: stride). */
  spreadHeightPx?: number
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

/** Vertical band under spread `insertIndex - 1` where a new spread is inserted. */
interface GapZone {
  top: number
  bottom: number
  insertIndex: number
}

export interface DropIndex {
  readonly frames: readonly IndexedFrame[]
  readonly gaps: readonly GapZone[]
}

export function buildDropIndex(input: DropIndexInput): DropIndex {
  const frames: IndexedFrame[] = []
  const gaps: GapZone[] = []
  const pxPerMm = input.pxPerMm
  const stride = input.stridePx
  if (!Number.isFinite(pxPerMm) || !Number.isFinite(stride) || stride <= 0) {
    return { frames, gaps }
  }
  const zoneTop = Math.min(
    input.spreadHeightPx ?? stride,
    stride - GAP_ZONE_MIN_PX,
  )
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
    const offsetX = slotPageLeftPx({
      worldWidthPx: worldWidth,
      paperWidthPx: spreadWidth,
      side: getSinglePageSide(index, input.spreads.length),
    })
    const originY = index * stride
    gaps.push({
      top: originY + zoneTop,
      bottom: originY + stride,
      insertIndex: index + 1,
    })
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
  return { frames, gaps }
}

/** Insert index of the "new spread" zone under `y` (NaN never hits). Allocates nothing. */
export function hitTestGap(index: DropIndex, y: number): number | undefined {
  for (const gap of index.gaps) {
    if (y >= gap.top && y < gap.bottom) {
      return gap.insertIndex
    }
  }
  return undefined
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
