import { omitKey } from '../omitKey'
import { keepOverridesAsOwn, spreadParent } from '../parentSpreads'
import type { Book } from '../schema'
import { updateSpread } from '../update'
import { realign } from './grid'

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
  const next = updateSpread(book, spreadId, (spread) => {
    if ((spreadParent(book, spread)?.id ?? null) === parentId) {
      return spread
    }
    // The work on the old parent's items stays as the spread's own.
    const rest = keepOverridesAsOwn(omitKey(spread, 'parentId'))
    const inherited = spreadParent(book, rest)?.id ?? null
    return inherited === parentId ? rest : { ...rest, parentId }
  })
  // The new parent's grid applies: re-align the spread's template to it.
  return next === book ? book : realign(next, [spreadId])
}
