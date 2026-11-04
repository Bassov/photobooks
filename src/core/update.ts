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

/** The spread's own frame `frameId`, else its local copy of a parent item with that id. */
export function findSpreadFrame(
  spread: Spread,
  frameId: string,
): Frame | undefined {
  return (
    spread.frames.find((frame) => frame.id === frameId) ??
    spread.parentOverrides?.frames?.find((frame) => frame.id === frameId)
  )
}

/** Own frame or local copy `frameId` on book spread `spreadId`. */
export function findBookFrame(
  book: Book,
  spreadId: string,
  frameId: string,
): Frame | undefined {
  const spread = book.spreads.find((candidate) => candidate.id === spreadId)
  return spread === undefined ? spread : findSpreadFrame(spread, frameId)
}

/** The spread's own frames, then its local copies of parent items. */
export function spreadFrames(spread: Spread): readonly Frame[] {
  const copies = spread.parentOverrides?.frames
  return copies === undefined ? spread.frames : [...spread.frames, ...copies]
}

/**
 * Local copies replaced by their `changed` entry (each keeps its
 * `overridesId`); no copy in `changed` → the same spread.
 */
export function withChangedCopies(
  spread: Spread,
  changed: ReadonlyMap<string, Frame>,
): Spread {
  const overrides = spread.parentOverrides
  const copies = overrides?.frames
  if (copies?.some((copy) => changed.has(copy.id)) !== true) {
    return spread
  }
  return {
    ...spread,
    parentOverrides: {
      ...overrides,
      frames: copies.map((copy) => {
        const next = changed.get(copy.id)
        return next === undefined
          ? copy
          : { ...next, overridesId: copy.overridesId }
      }),
    },
  }
}

/** Edit one own frame or local copy; a copy edit leaves the template. */
export function updateFrame(
  book: Book,
  spreadId: string,
  frameId: string,
  updater: (frame: Frame) => Frame,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const index = spread.frames.findIndex((frame) => frame.id === frameId)
    if (index < 0) {
      const copy = spread.parentOverrides?.frames?.find(
        (frame) => frame.id === frameId,
      )
      if (copy === undefined) {
        return spread
      }
      const next = updater(copy)
      return next === copy
        ? spread
        : withChangedCopies(spread, new Map([[frameId, next]]))
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
