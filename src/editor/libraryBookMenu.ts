import { displayBookTitle } from '../project'

export type LibraryBookMenuEffect =
  | { type: 'open' }
  | { type: 'rename' }
  | { type: 'duplicate' }
  | { type: 'remove'; title: string }
  | { type: 'none' }

/** Map a book-card menu key to a library effect (pure). */
export function libraryBookMenuEffect(
  key: string,
  summaryTitle: string | undefined,
): LibraryBookMenuEffect {
  if (key === 'open') {
    return { type: 'open' }
  }
  if (key === 'rename') {
    return { type: 'rename' }
  }
  if (key === 'dup') {
    return { type: 'duplicate' }
  }
  if (key === 'rm' && summaryTitle !== undefined) {
    return { type: 'remove', title: displayBookTitle(summaryTitle) }
  }
  return { type: 'none' }
}
