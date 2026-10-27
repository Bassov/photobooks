import { MAX_CROP_ZOOM } from '../geometry/cropRect'
import type { Book, Frame } from '../schema'
import { updateFrame } from '../update'

export const COVER_CROP: NonNullable<Frame['crop']> = {
  zoom: 1,
  center: { x: 0.5, y: 0.5 },
}

function unit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Set the crop of a filled frame; zoom and center are clamped to valid ranges. */
export function setCrop(
  book: Book,
  spreadId: string,
  frameId: string,
  crop: NonNullable<Frame['crop']>,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) => {
    if (frame.assetId === undefined) {
      return frame
    }
    const next = {
      zoom: Math.min(MAX_CROP_ZOOM, Math.max(1, crop.zoom)),
      center: { x: unit(crop.center.x), y: unit(crop.center.y) },
    }
    const prev = frame.crop
    if (
      prev?.zoom === next.zoom &&
      prev.center.x === next.center.x &&
      prev.center.y === next.center.y
    ) {
      return frame
    }
    return { ...frame, crop: next }
  })
}

/** Reset to cover: zoom 1, centered. */
export function resetCrop(book: Book, spreadId: string, frameId: string): Book {
  return setCrop(book, spreadId, frameId, COVER_CROP)
}
