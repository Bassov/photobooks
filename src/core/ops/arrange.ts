import { updateSpread } from '../update'
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
    const from = order.findIndex((frame) => frame.id === frameId)
    if (from < 0) {
      return spread
    }
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
    const [moved] = order.splice(from, 1)
    if (moved === undefined) {
      return spread
    }
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

/** Lock or unlock one frame (`locked` is dropped when false). Same state → unchanged. */
export function setFrameLocked(
  book: Book,
  spreadId: string,
  frameId: string,
  locked: boolean,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const current = spread.frames.find((frame) => frame.id === frameId)
    if (current === undefined || (current.locked === true) === locked) {
      return spread
    }
    return {
      ...spread,
      frames: spread.frames.map((frame) => {
        if (frame.id !== frameId) {
          return frame
        }
        if (locked) {
          return { ...frame, locked: true }
        }
        const open = { ...frame }
        delete open.locked
        return open
      }),
    }
  })
}
