import {
  COVER_CROP,
  clampCrop,
  shownCropRect,
  type Frame,
  type RectMm,
} from '../core'
import {
  dispatchBookOp,
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
} from './bookStore'
import type { CropTarget } from './cropMode'

type Crop = NonNullable<Frame['crop']>

export const STRAIGHTEN_LIMIT_DEG = 45

/** Quarter turn: zoom and pan reset (the turned photo recovers); angle stays. */
export function turnedCrop(
  rect: RectMm,
  crop: Crop,
  aspect: number,
  fit: Frame['fit'],
  direction: 1 | -1,
): Crop {
  const quarterTurns = ((((crop.quarterTurns ?? 0) + direction) % 4) + 4) % 4
  return clampCrop(rect, { ...crop, ...COVER_CROP, quarterTurns }, aspect, fit)
}

/** Straighten angle: cover recomputed, so the center is pulled inside the image. */
export function straightenedCrop(
  rect: RectMm,
  crop: Crop,
  aspect: number,
  fit: Frame['fit'],
  straightenDeg: number,
): Crop {
  const limited = Math.min(
    STRAIGHTEN_LIMIT_DEG,
    Math.max(-STRAIGHTEN_LIMIT_DEG, straightenDeg),
  )
  return clampCrop(rect, { ...crop, straightenDeg: limited }, aspect, fit)
}

export interface PreviewFrame {
  rect: RectMm
  aspect: number
  fit: Frame['fit']
  framePx: { width: number; height: number }
}

/**
 * CSS transform (origin: frame center) that takes the photo drawn for `from`
 * to the one drawn for `to`: a straighten drag previews on the compositor and
 * commits one crop at the end.
 */
export function straightenPreviewTransform(
  frame: PreviewFrame,
  from: Crop,
  to: Crop,
): string {
  const a = shownCropRect(frame.rect, from, frame.aspect, frame.fit)
  const b = shownCropRect(frame.rect, to, frame.aspect, frame.fit)
  const widthA = frame.framePx.width / a.width
  const widthB = frame.framePx.width / b.width
  const heightB = frame.framePx.height / b.height
  const scale = widthB / widthA
  const delta = (to.straightenDeg ?? 0) - (from.straightenDeg ?? 0)
  const angle = ((to.straightenDeg ?? 0) * Math.PI) / 180
  const dx = (a.x + a.width / 2 - (b.x + b.width / 2)) * widthB
  const dy = (a.y + a.height / 2 - (b.y + b.height / 2)) * heightB
  const tx = dx * Math.cos(angle) - dy * Math.sin(angle)
  const ty = dx * Math.sin(angle) + dy * Math.cos(angle)
  return `translate(${String(tx)}px, ${String(ty)}px) rotate(${String(delta)}deg) scale(${String(scale)})`
}

function findFrame(target: CropTarget): Frame | undefined {
  return getBookStoreSnapshot()
    .book.spreads.find((spread) => spread.id === target.spreadId)
    ?.frames.find((item) => item.id === target.frameId)
}

/** Turn the frame's photo a quarter; no-op for empty frames. */
export function turnPhoto(target: CropTarget, direction: 1 | -1): void {
  const frame = findFrame(target)
  if (frame?.assetId === undefined) {
    return
  }
  dispatchBookOp({
    type: 'setCrop',
    spreadId: target.spreadId,
    frameId: target.frameId,
    crop: turnedCrop(
      frame.rect,
      frame.crop ?? COVER_CROP,
      getAssetAspectSnapshot(frame.assetId),
      frame.fit,
      direction,
    ),
  })
}

/** Toggle the mirror of the frame's photo (kit Flip H / Flip V). */
export function flipPhoto(target: CropTarget, axis: 'h' | 'v'): void {
  const frame = findFrame(target)
  if (frame?.assetId === undefined) {
    return
  }
  const crop = frame.crop ?? COVER_CROP
  dispatchBookOp({
    type: 'setCrop',
    spreadId: target.spreadId,
    frameId: target.frameId,
    crop:
      axis === 'h'
        ? { ...crop, flipH: crop.flipH !== true }
        : { ...crop, flipV: crop.flipV !== true },
  })
}

/** Commit the straighten angle of the frame's photo. */
export function straightenPhoto(target: CropTarget, deg: number): void {
  const frame = findFrame(target)
  if (frame?.assetId === undefined) {
    return
  }
  dispatchBookOp({
    type: 'setCrop',
    spreadId: target.spreadId,
    frameId: target.frameId,
    crop: straightenedCrop(
      frame.rect,
      frame.crop ?? COVER_CROP,
      getAssetAspectSnapshot(frame.assetId),
      frame.fit,
      deg,
    ),
  })
}
