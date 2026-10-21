import { saveBookNow } from './projectSession'

/** Ctrl/Cmd+S → save when a library is open. */
export function installEditorSaveShortcut(libraryOpen: boolean): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') {
      return
    }
    if (!libraryOpen) {
      return
    }
    event.preventDefault()
    saveBookNow()
  }
  window.addEventListener('keydown', onKeyDown)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
  }
}
