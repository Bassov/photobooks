import { updateSpread } from '../update'
import type { Book, Frame } from '../schema'
import { MIN_FRAME_EDGE_MM, detached } from './frames'

type Rect = Frame['rect']

export type AlignEdge =
  'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY'

export type DistributeAxis = 'horizontal' | 'vertical'

/** Locked frames are skipped: every op below returns the book unchanged for them. */
function transformFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  next: (frames: Frame[]) => Map<string, Frame>,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const wanted = new Set(frameIds)
    const targets = spread.frames.filter(
      (frame) => wanted.has(frame.id) && frame.locked !== true,
    )
    const changed = next(targets)
    if (changed.size === 0) {
      return spread
    }
    return detached(
      spread,
      spread.frames.map((frame) => changed.get(frame.id) ?? frame),
    )
  })
}

function sameRect(a: Rect, b: Rect): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  )
}

function finiteRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height)
  )
}

/** Translate one frame by (dx, dy) mm. Non-finite or zero delta, locked → unchanged. */
export function moveFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  dx: number,
  dy: number,
): Book {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
    return book
  }
  return transformFrames(
    book,
    spreadId,
    [frameId],
    (frames) =>
      new Map(
        frames.map((frame) => [
          frame.id,
          {
            ...frame,
            rect: { ...frame.rect, x: frame.rect.x + dx, y: frame.rect.y + dy },
          },
        ]),
      ),
  )
}

/**
 * Set one frame's rect (resize, with the origin free to move for edge handles).
 * An edge under `MIN_FRAME_EDGE_MM`, a non-finite value, an identical rect or a
 * locked frame → unchanged.
 */
export function resizeFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  rect: Rect,
): Book {
  if (
    !finiteRect(rect) ||
    rect.width < MIN_FRAME_EDGE_MM ||
    rect.height < MIN_FRAME_EDGE_MM
  ) {
    return book
  }
  return transformFrames(book, spreadId, [frameId], (frames) => {
    const changed = new Map<string, Frame>()
    const frame = frames[0]
    if (frame !== undefined && !sameRect(frame.rect, rect)) {
      changed.set(frame.id, { ...frame, rect })
    }
    return changed
  })
}

/** Normalise to [0, 360). */
function normaliseDeg(deg: number): number {
  const wrapped = deg % 360
  return wrapped < 0 ? wrapped + 360 : wrapped + 0
}

/** Set one frame's rotation (degrees, stored in [0, 360)). Non-finite, same, locked → unchanged. */
export function rotateFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  rotationDeg: number,
): Book {
  if (!Number.isFinite(rotationDeg)) {
    return book
  }
  const target = normaliseDeg(rotationDeg)
  return transformFrames(book, spreadId, [frameId], (frames) => {
    const changed = new Map<string, Frame>()
    const frame = frames[0]
    if (frame !== undefined && (frame.rotationDeg ?? 0) !== target) {
      changed.set(frame.id, { ...frame, rotationDeg: target })
    }
    return changed
  })
}

/**
 * Align unlocked frames to the bounding box of the unlocked frames (unrotated
 * rects). Fewer than two unlocked targets → unchanged.
 */
export function alignFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  edge: AlignEdge,
): Book {
  return transformFrames(book, spreadId, frameIds, (frames) => {
    const changed = new Map<string, Frame>()
    if (frames.length < 2) {
      return changed
    }
    const left = Math.min(...frames.map((f) => f.rect.x))
    const right = Math.max(...frames.map((f) => f.rect.x + f.rect.width))
    const top = Math.min(...frames.map((f) => f.rect.y))
    const bottom = Math.max(...frames.map((f) => f.rect.y + f.rect.height))
    for (const frame of frames) {
      const { x, y, width, height } = frame.rect
      const moved: Rect = { x, y, width, height }
      if (edge === 'left') moved.x = left
      else if (edge === 'right') moved.x = right - width
      else if (edge === 'centerX') moved.x = (left + right) / 2 - width / 2
      else if (edge === 'top') moved.y = top
      else if (edge === 'bottom') moved.y = bottom - height
      else moved.y = (top + bottom) / 2 - height / 2
      if (!sameRect(frame.rect, moved)) {
        changed.set(frame.id, { ...frame, rect: moved })
      }
    }
    return changed
  })
}

/**
 * Even out the gaps between unlocked frames along an axis; the outermost two
 * stay put. Fewer than three unlocked targets → unchanged.
 */
export function distributeFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  axis: DistributeAxis,
): Book {
  return transformFrames(book, spreadId, frameIds, (frames) => {
    const changed = new Map<string, Frame>()
    if (frames.length < 3) {
      return changed
    }
    const horizontal = axis === 'horizontal'
    const start = (f: Frame) => (horizontal ? f.rect.x : f.rect.y)
    const size = (f: Frame) => (horizontal ? f.rect.width : f.rect.height)
    const sorted = [...frames].sort((a, b) => start(a) - start(b))
    // Seedless reduce yields a typed Frame (length >= 3 is guaranteed above).
    const first = sorted.reduce((head) => head)
    const last = sorted.reduce((_, f) => f)
    const span = start(last) + size(last) - start(first)
    const gap =
      (span - sorted.reduce((sum, f) => sum + size(f), 0)) / (sorted.length - 1)
    let cursor = start(first)
    for (const frame of sorted) {
      if (start(frame) !== cursor) {
        const rect = horizontal
          ? { ...frame.rect, x: cursor }
          : { ...frame.rect, y: cursor }
        changed.set(frame.id, { ...frame, rect })
      }
      cursor += size(frame) + gap
    }
    return changed
  })
}
