import type { Book, Frame } from '../schema'
import { updateFrame } from '../update'

/**
 * Put a new photo in a frame: cover crop (zoom 1, centered) and fill. A `fit`
 * left over from the previous photo is dropped so Fit stays opt-in.
 */
export function withPlacedAsset(frame: Frame, assetId: string): Frame {
  const next: Frame = {
    ...frame,
    assetId,
    crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
  }
  delete next.fit
  return next
}

/**
 * The frame without its photo (`assetId`, `crop`, `fit`); everything else,
 * `locked` and rotation included, stays.
 */
export function withoutPlacement(frame: Frame): Frame {
  const next: Frame = { ...frame }
  delete next.assetId
  delete next.crop
  delete next.fit
  return next
}

/** A frame that can take or give a photo: an unlocked image frame. */
export function takesPhoto(frame: Frame): boolean {
  return frame.kind !== 'text' && frame.locked !== true
}

export function placeAsset(
  book: Book,
  spreadId: string,
  frameId: string,
  assetId: string,
): Book {
  if (!book.gallery.includes(assetId) || !(assetId in book.assets)) {
    return book
  }
  return updateFrame(book, spreadId, frameId, (frame) => {
    if (frame.assetId !== undefined || !takesPhoto(frame)) {
      return frame
    }
    return withPlacedAsset(frame, assetId)
  })
}

export function replaceAsset(
  book: Book,
  spreadId: string,
  frameId: string,
  assetId: string,
): Book {
  if (!book.gallery.includes(assetId) || !(assetId in book.assets)) {
    return book
  }
  return updateFrame(book, spreadId, frameId, (frame) => {
    if (frame.assetId === assetId || !takesPhoto(frame)) {
      return frame
    }
    return withPlacedAsset(frame, assetId)
  })
}

export function unplaceAsset(
  book: Book,
  spreadId: string,
  frameId: string,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) => {
    if (frame.assetId === undefined) {
      return frame
    }
    return withoutPlacement(frame)
  })
}

export function swapFrames(
  book: Book,
  spreadIdA: string,
  frameIdA: string,
  spreadIdB: string,
  frameIdB: string,
): Book {
  const frameA = findFrame(book, spreadIdA, frameIdA)
  const frameB = findFrame(book, spreadIdB, frameIdB)
  if (frameA === undefined || frameB === undefined) {
    return book
  }
  if (spreadIdA === spreadIdB && frameIdA === frameIdB) {
    return book
  }
  // A locked frame keeps its photo and a text frame has none: neither gives
  // nor takes one.
  if (!takesPhoto(frameA) || !takesPhoto(frameB)) {
    return book
  }

  const placementA = placementOf(frameA)
  const placementB = placementOf(frameB)

  let next = setPlacement(book, spreadIdA, frameIdA, placementB)
  next = setPlacement(next, spreadIdB, frameIdB, placementA)
  return next
}

interface Placement {
  assetId?: string
  crop?: Frame['crop']
}

function placementOf(frame: Frame): Placement {
  const placement: Placement = {}
  if (frame.assetId !== undefined) {
    placement.assetId = frame.assetId
  }
  if (frame.crop !== undefined) {
    placement.crop = frame.crop
  }
  return placement
}

function setPlacement(
  book: Book,
  spreadId: string,
  frameId: string,
  placement: Placement,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) => {
    const next = withoutPlacement(frame)
    if (placement.assetId !== undefined) {
      next.assetId = placement.assetId
    }
    if (placement.crop !== undefined) {
      next.crop = placement.crop
    }
    if (
      next.assetId === frame.assetId &&
      JSON.stringify(next.crop) === JSON.stringify(frame.crop)
    ) {
      return frame
    }
    return next
  })
}

function findFrame(
  book: Book,
  spreadId: string,
  frameId: string,
): Frame | undefined {
  const spread = book.spreads.find((candidate) => candidate.id === spreadId)
  return spread?.frames.find((frame) => frame.id === frameId)
}
