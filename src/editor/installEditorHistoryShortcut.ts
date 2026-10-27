import { redoBook, undoBook } from './bookStore'
import { isTypingTarget } from './isTypingTarget'

/** Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z and Ctrl+Y redo; text fields keep native undo. */
export function installEditorHistoryShortcut(): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return
    }
    if (isTypingTarget(event.target)) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) {
        redoBook()
      } else {
        undoBook()
      }
    } else if (key === 'y' && !event.shiftKey) {
      event.preventDefault()
      redoBook()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
  }
}
