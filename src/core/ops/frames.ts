import { updateSpread } from '../update'
import type { Book, Frame, Spread } from '../schema'

type Rect = Frame['rect']

/** Smallest edge (mm) a drawn frame may commit with. */
export const MIN_FRAME_EDGE_MM = 5

export function detached(spread: Spread, frames: Frame[]): Spread {
  const next: Spread = { ...spread, frames }
  delete next.templateId
  return next
}

/** First `frame-<n>` not used on the spread. */
export function nextFrameId(spread: Spread): string {
  const existing = new Set(spread.frames.map((frame) => frame.id))
  let n = spread.frames.length + 1
  while (existing.has(`frame-${String(n)}`)) {
    n += 1
  }
  return `frame-${String(n)}`
}

/** Append an empty image frame on top; the spread leaves its template. */
export function addFrame(
  book: Book,
  spreadId: string,
  rect: Rect,
  id?: string,
): Book {
  if (rect.width < MIN_FRAME_EDGE_MM || rect.height < MIN_FRAME_EDGE_MM) {
    return book
  }
  return updateSpread(book, spreadId, (spread) => {
    if (id !== undefined && spread.frames.some((frame) => frame.id === id)) {
      return spread
    }
    const top = spread.frames.reduce((max, frame) => Math.max(max, frame.z), 0)
    const frame: Frame = {
      id: id ?? nextFrameId(spread),
      rect,
      z: top + 1,
    }
    return detached(spread, [...spread.frames, frame])
  })
}

/** Remove frames (filled ones drop their placement); the spread leaves its template. */
export function removeFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const gone = new Set(frameIds)
    const frames = spread.frames.filter((frame) => !gone.has(frame.id))
    if (frames.length === spread.frames.length) {
      return spread
    }
    return detached(spread, frames)
  })
}

/** Move / resize one frame; the spread leaves its template. */
export function setFrameRect(
  book: Book,
  spreadId: string,
  frameId: string,
  rect: Rect,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const current = spread.frames.find((frame) => frame.id === frameId)
    if (
      current === undefined ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      (current.rect.x === rect.x &&
        current.rect.y === rect.y &&
        current.rect.width === rect.width &&
        current.rect.height === rect.height)
    ) {
      return spread
    }
    return detached(
      spread,
      spread.frames.map((frame) =>
        frame.id === frameId ? { ...frame, rect } : frame,
      ),
    )
  })
}
