import { parentAsSpread, updateParentSpread } from './parentSpreads'
import type { Book, Frame, ParentSpread, Spread } from './schema'

/**
 * A parent id edits the parent through its spread view: items, guides and the
 * partial grid are written back, anything else a spread op changes is not.
 */
function updateParent(
  book: Book,
  parentId: string,
  updater: (spread: Spread) => Spread,
): Book {
  return updateParentSpread(book, parentId, (current) => {
    const view = parentAsSpread(current)
    const next = updater(view)
    const guides = next.guides ?? []
    if (
      next.frames === view.frames &&
      guides === view.guides &&
      next.layoutGrid === view.layoutGrid
    ) {
      return current
    }
    const parent: ParentSpread = { ...current, frames: next.frames, guides }
    if (next.layoutGrid === undefined) {
      delete parent.layoutGrid
    } else {
      parent.layoutGrid = next.layoutGrid
    }
    return parent
  })
}

export function updateSpread(
  book: Book,
  spreadId: string,
  updater: (spread: Spread) => Spread,
): Book {
  const index = book.spreads.findIndex((spread) => spread.id === spreadId)
  if (index < 0) {
    return updateParent(book, spreadId, updater)
  }
  const current = book.spreads[index]
  if (current === undefined) {
    return book
  }
  const next = updater(current)
  if (next === current) {
    return book
  }
  const spreads = book.spreads.slice()
  spreads[index] = next
  return { ...book, spreads }
}

export function updateFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  updater: (frame: Frame) => Frame,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const index = spread.frames.findIndex((frame) => frame.id === frameId)
    if (index < 0) {
      return spread
    }
    const current = spread.frames[index]
    if (current === undefined) {
      return spread
    }
    const next = updater(current)
    if (next === current) {
      return spread
    }
    const frames = spread.frames.slice()
    frames[index] = next
    return { ...spread, frames }
  })
}
