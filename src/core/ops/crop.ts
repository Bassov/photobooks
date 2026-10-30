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

/** The photo-rotation fields of a crop; zero turns / angle stay absent. */
function rotationOf(
  crop: Pick<NonNullable<Frame['crop']>, 'quarterTurns' | 'straightenDeg'>,
): Pick<NonNullable<Frame['crop']>, 'quarterTurns' | 'straightenDeg'> {
  const quarterTurns = (((crop.quarterTurns ?? 0) % 4) + 4) % 4
  const straightenDeg = Math.min(45, Math.max(-45, crop.straightenDeg ?? 0))
  return {
    ...(quarterTurns === 0 ? {} : { quarterTurns }),
    ...(straightenDeg === 0 ? {} : { straightenDeg }),
  }
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
    const next: NonNullable<Frame['crop']> = {
      zoom: Math.min(MAX_CROP_ZOOM, Math.max(1, crop.zoom)),
      center: { x: unit(crop.center.x), y: unit(crop.center.y) },
      ...rotationOf(crop),
    }
    const prev = frame.crop
    if (
      prev?.zoom === next.zoom &&
      prev.center.x === next.center.x &&
      prev.center.y === next.center.y &&
      prev.quarterTurns === next.quarterTurns &&
      prev.straightenDeg === next.straightenDeg
    ) {
      return frame
    }
    return { ...frame, crop: next }
  })
}

/** Set fill / fit of a filled frame; zoom and pan reset to centered. */
export function setFit(
  book: Book,
  spreadId: string,
  frameId: string,
  fit: NonNullable<Frame['fit']>,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) => {
    if (frame.assetId === undefined) {
      return frame
    }
    const { crop, fit: prevFit, ...rest } = frame
    if (crop === undefined && (prevFit ?? 'fill') === fit) {
      return frame
    }
    // Zoom and pan reset; the photo's rotation survives a fill / fit switch.
    const turned = crop === undefined ? {} : rotationOf(crop)
    const kept =
      Object.keys(turned).length === 0
        ? rest
        : { ...rest, crop: { ...COVER_CROP, ...turned } }
    return fit === 'fit' ? { ...kept, fit } : kept
  })
}

/** Reset to cover: zoom 1, centered; the photo keeps its rotation. */
export function resetCrop(book: Book, spreadId: string, frameId: string): Book {
  const frame = book.spreads
    .find((spread) => spread.id === spreadId)
    ?.frames.find((item) => item.id === frameId)
  return setCrop(book, spreadId, frameId, {
    ...COVER_CROP,
    ...(frame?.crop === undefined ? {} : rotationOf(frame.crop)),
  })
}
