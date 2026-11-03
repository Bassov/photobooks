import { updateFrame, updateSpread } from '../update'
import type { Book, Frame, Spread, TextStyleId } from '../schema'

type Rect = Frame['rect']
type TextAlign = NonNullable<Frame['align']>

/** Smallest edge (mm) a drawn frame may commit with. */
export const MIN_FRAME_EDGE_MM = 5

/** Smallest text box (mm): 10 wide, one caption line high. */
export const MIN_TEXT_FRAME_MM = { width: 10, height: 4.5 } as const

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

/**
 * Append an empty caption text frame on top. Layouts lay out image frames
 * only, so the spread keeps its template.
 */
export function addTextFrame(
  book: Book,
  spreadId: string,
  rect: Rect,
  id?: string,
): Book {
  if (
    rect.width < MIN_TEXT_FRAME_MM.width ||
    rect.height < MIN_TEXT_FRAME_MM.height
  ) {
    return book
  }
  return updateSpread(book, spreadId, (spread) => {
    // Ids are non-empty, so an absent `id` never matches.
    if (spread.frames.some((frame) => frame.id === id)) {
      return spread
    }
    const top = spread.frames.reduce((max, frame) => Math.max(max, frame.z), 0)
    const frame: Frame = {
      id: id ?? nextFrameId(spread),
      rect,
      z: top + 1,
      kind: 'text',
      styleId: 'caption',
      align: 'left',
      content: { type: 'static', text: '' },
    }
    return { ...spread, frames: [...spread.frames, frame] }
  })
}

/**
 * Set a text frame's static text. `fitHeightMm` (whole lines the text needs,
 * measured by the editor) grows the box down, never past the paper bottom;
 * the box never shrinks.
 */
export function editText(
  book: Book,
  spreadId: string,
  frameId: string,
  text: string,
  fitHeightMm?: number,
): Book {
  const paperBottom = book.settings.trim.heightMm
  return updateFrame(book, spreadId, frameId, (frame) => {
    if (frame.kind !== 'text') {
      return frame
    }
    const { rect } = frame
    const height =
      fitHeightMm === undefined
        ? rect.height
        : Math.max(rect.height, Math.min(fitHeightMm, paperBottom - rect.y))
    const same = frame.content?.type === 'static' && frame.content.text === text
    if (same && height === rect.height) {
      return frame
    }
    return {
      ...frame,
      content: same ? frame.content : { type: 'static', text },
      rect: height === rect.height ? rect : { ...rect, height },
    }
  })
}

/** Restyle a text frame; its box stays put. */
export function setTextStyle(
  book: Book,
  spreadId: string,
  frameId: string,
  styleId: TextStyleId,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) =>
    frame.kind !== 'text' || (frame.styleId ?? 'caption') === styleId
      ? frame
      : { ...frame, styleId },
  )
}

/** Re-align a text frame; its box stays put. */
export function setTextAlign(
  book: Book,
  spreadId: string,
  frameId: string,
  align: TextAlign,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) =>
    frame.kind !== 'text' || (frame.align ?? 'left') === align
      ? frame
      : { ...frame, align },
  )
}
