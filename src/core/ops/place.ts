import type { Book, Frame } from '../schema'
import { updateFrame } from '../update'

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
    if (frame.assetId !== undefined) {
      return frame
    }
    return {
      ...frame,
      assetId,
      crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
    }
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
    if (frame.assetId === assetId) {
      return frame
    }
    return {
      ...frame,
      assetId,
      crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
    }
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
    return {
      id: frame.id,
      rect: frame.rect,
      z: frame.z,
    }
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
    const next: Frame = {
      id: frame.id,
      rect: frame.rect,
      z: frame.z,
    }
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
