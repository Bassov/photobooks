import type { Book, Frame, Spread } from './schema'

export function updateSpread(
  book: Book,
  spreadId: string,
  updater: (spread: Spread) => Spread,
): Book {
  const index = book.spreads.findIndex((spread) => spread.id === spreadId)
  if (index < 0) {
    return book
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
