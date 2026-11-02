import { omitKey } from '../omitKey'
import { spreadParent } from '../parentSpreads'
import type { Book } from '../schema'
import { updateSpread } from '../update'

/** Kit Background: the spread's own color; `undefined` → the page default. */
export function setSpreadBackground(
  book: Book,
  spreadId: string,
  color: string | undefined,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    if (spread.backgroundColor === color) {
      return spread
    }
    const rest = omitKey(spread, 'backgroundColor')
    return color === undefined ? rest : { ...rest, backgroundColor: color }
  })
}

/**
 * Kit Master & spacing: apply a parent (`null` → None). `parentId` is stored
 * only when it differs from what an absent field resolves to (the book
 * default, else None); an unknown id or the current parent is a no-op.
 */
export function setSpreadParent(
  book: Book,
  spreadId: string,
  parentId: string | null,
): Book {
  if (
    parentId !== null &&
    book.parents?.some((parent) => parent.id === parentId) !== true
  ) {
    return book
  }
  return updateSpread(book, spreadId, (spread) => {
    if ((spreadParent(book, spread)?.id ?? null) === parentId) {
      return spread
    }
    const rest = omitKey(spread, 'parentId')
    const inherited = spreadParent(book, rest)?.id ?? null
    return inherited === parentId ? rest : { ...rest, parentId }
  })
}
