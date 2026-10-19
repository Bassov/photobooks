import { useSyncExternalStore } from 'react'
import { displayBookTitle } from '../project'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'

function getBookTitle(): string | undefined {
  return getBookStoreSnapshot().book.title
}

/** Notify only when document title changes (not on gallery/placement churn). */
function subscribeBookTitle(onStoreChange: () => void): () => void {
  let last = getBookTitle()
  return subscribeBookStore(() => {
    const next = getBookTitle()
    if (next !== last) {
      last = next
      onStoreChange()
    }
  })
}

/** Subscribes only for chrome title; keeps EditorShell off the book-store bus. */
export function BookTitleChrome() {
  const title = useSyncExternalStore(
    subscribeBookTitle,
    getBookTitle,
    getBookTitle,
  )
  const label = displayBookTitle(title)
  return (
    <p className="book-title" data-testid="book-title" title={label}>
      {label}
    </p>
  )
}
