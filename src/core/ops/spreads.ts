import type { Book, Spread } from '../schema'
import { applyTemplate } from '../templates/apply'

export function addSpread(
  book: Book,
  options: { index?: number; id?: string } = {},
): Book {
  const id = options.id ?? nextSpreadId(book)
  const insertAt =
    options.index === undefined
      ? book.spreads.length
      : Math.max(0, Math.min(options.index, book.spreads.length))

  const empty: Spread = { id, frames: [] }
  const spreads = book.spreads.slice()
  spreads.splice(insertAt, 0, empty)
  const withSpread: Book = { ...book, spreads }
  return applyTemplate(withSpread, id, 'one-per-page')
}

export function removeSpread(book: Book, spreadId: string): Book {
  if (book.spreads.length <= 1) {
    return book
  }
  const spreads = book.spreads.filter((spread) => spread.id !== spreadId)
  if (spreads.length === book.spreads.length) {
    return book
  }
  return { ...book, spreads }
}

export function moveSpread(
  book: Book,
  spreadId: string,
  toIndex: number,
): Book {
  const fromIndex = book.spreads.findIndex((spread) => spread.id === spreadId)
  if (fromIndex < 0) {
    return book
  }
  const clamped = Math.max(0, Math.min(toIndex, book.spreads.length - 1))
  if (clamped === fromIndex) {
    return book
  }
  const spreads = book.spreads.slice()
  const [removed] = spreads.splice(fromIndex, 1)
  if (removed === undefined) {
    return book
  }
  spreads.splice(clamped, 0, removed)
  return { ...book, spreads }
}

function nextSpreadId(book: Book): string {
  let n = book.spreads.length + 1
  let id = `spread-${String(n)}`
  const existing = new Set(book.spreads.map((spread) => spread.id))
  while (existing.has(id)) {
    n += 1
    id = `spread-${String(n)}`
  }
  return id
}
