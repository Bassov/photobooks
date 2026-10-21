import { getBookStoreSnapshot } from './bookStore'
import { editorHasContent } from './editorHasContent'
import { promptBookTitle } from './promptBookTitle'

export function renameActiveBook(
  activeBookId: string | null,
  rename: (bookId: string, title: string) => void,
): void {
  if (activeBookId === null) {
    return
  }
  const entered = promptBookTitle(
    'Rename book',
    getBookStoreSnapshot().book.title ?? '',
  )
  if (entered === null) {
    return
  }
  rename(activeBookId, entered)
}

export function createBookWithPrompt(create: (title: string) => void): void {
  if (editorHasContent()) {
    const ok = window.confirm(
      'Create a new empty book? Current gallery and layout will be replaced.',
    )
    if (!ok) {
      return
    }
  }
  const entered = promptBookTitle('Book title', '')
  if (entered === null) {
    return
  }
  create(entered)
}
