import type { Book, ParentSpread, Spread } from './schema'

/**
 * The spread's parent: `parentId` when set, else the book default; `null`
 * (None) or an id with no parent resolves to none.
 */
export function spreadParent(
  book: Book,
  spread: Spread,
): ParentSpread | undefined {
  const id =
    spread.parentId === undefined ? book.defaultParentId : spread.parentId
  return book.parents?.find((parent) => parent.id === id)
}
