import { updateFrame, updateSpread } from '../update'
import type { Book, Frame, Spread } from '../schema'
import { detached } from './frames'

export type ZMove = 'front' | 'back' | 'forward' | 'backward'

/** Frames bottom → top: by `z`, ties by array order. */
function stacked(spread: Spread): Frame[] {
  return spread.frames
    .map((frame, index) => ({ frame, index }))
    .sort((a, b) => a.frame.z - b.frame.z || a.index - b.index)
    .map((entry) => entry.frame)
}

/** 1-based layer of a frame (1 = bottom) and the layer count; null when absent. */
export function layerOf(
  spread: Spread,
  frameId: string,
): { layer: number; count: number } | null {
  const at = stacked(spread).findIndex((frame) => frame.id === frameId)
  return at < 0 ? null : { layer: at + 1, count: spread.frames.length }
}

/**
 * Move one frame in the stacking order and renumber `z` as 1..n. Already at
 * that end, or an unknown frame → unchanged. The spread leaves its template.
 */
export function reorderFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  move: ZMove,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const order = stacked(spread)
    const moved = order.find((frame) => frame.id === frameId)
    if (moved === undefined) {
      return spread
    }
    const from = order.indexOf(moved)
    const to =
      move === 'front'
        ? order.length - 1
        : move === 'back'
          ? 0
          : Math.min(
              order.length - 1,
              Math.max(0, from + (move === 'forward' ? 1 : -1)),
            )
    if (to === from) {
      return spread
    }
    order.splice(from, 1)
    order.splice(to, 0, moved)
    const z = new Map(order.map((frame, index) => [frame.id, index + 1]))
    return detached(
      spread,
      spread.frames.map((frame) => ({
        ...frame,
        z: z.get(frame.id) ?? frame.z,
      })),
    )
  })
}

/**
 * One step towards the start: walking from the start, each picked frame
 * swaps with the unpicked frame just before it, so a block steps past one
 * unpicked frame and keeps its order.
 */
function stepBack(
  order: readonly Frame[],
  isPicked: (frame: Frame) => boolean,
): Frame[] {
  const next: Frame[] = []
  for (const frame of order) {
    const before = next.at(-1)
    if (before !== undefined && isPicked(frame) && !isPicked(before)) {
      next.splice(-1, 0, frame)
    } else {
      next.push(frame)
    }
  }
  return next
}

/** Bottom → top order after a z move of a set. */
function setOrder(order: Frame[], picked: Set<string>, move: ZMove): Frame[] {
  const isPicked = (frame: Frame) => picked.has(frame.id)
  if (move === 'backward') {
    return stepBack(order, isPicked)
  }
  if (move === 'forward') {
    return stepBack(order.slice().reverse(), isPicked).reverse()
  }
  const block = order.filter(isPicked)
  const rest = order.filter((frame) => !isPicked(frame))
  return move === 'front' ? [...rest, ...block] : [...block, ...rest]
}

/**
 * Move a set of frames in the stacking order (`z` renumbered 1..n). Front /
 * back move the set as one block in its stacking order; forward / backward
 * move each frame one step past the next unselected frame. Unknown ids are
 * ignored; no change → unchanged. The spread leaves its template.
 */
export function reorderFrames(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  move: ZMove,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const order = stacked(spread)
    const next = setOrder(order, new Set(frameIds), move)
    if (next.every((frame, index) => frame === order[index])) {
      return spread
    }
    const z = new Map(next.map((frame, index) => [frame.id, index + 1]))
    return detached(
      spread,
      spread.frames.map((frame) => ({
        ...frame,
        z: z.get(frame.id) ?? frame.z,
      })),
    )
  })
}

/** Lock or unlock a set of frames in one step; same state for all → unchanged. */
export function setFramesLocked(
  book: Book,
  spreadId: string,
  frameIds: readonly string[],
  locked: boolean,
): Book {
  return frameIds.reduce(
    (next, frameId) => setFrameLocked(next, spreadId, frameId, locked),
    book,
  )
}

/** Lock or unlock one frame (`locked` is dropped when false). Same state → unchanged. */
export function setFrameLocked(
  book: Book,
  spreadId: string,
  frameId: string,
  locked: boolean,
): Book {
  return updateFrame(book, spreadId, frameId, (frame) => {
    if ((frame.locked === true) === locked) {
      return frame
    }
    if (locked) {
      return { ...frame, locked: true }
    }
    const open = { ...frame }
    delete open.locked
    return open
  })
}
