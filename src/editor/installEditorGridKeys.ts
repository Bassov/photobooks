import { isTypingTarget } from './isTypingTarget'
import { toggleGridVisible, toggleSnapOn } from './gridView'

/** Ctrl/⌘+' shows / hides the layout grid; Shift+S turns snapping on / off. */
export function installEditorGridKeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.altKey || isTypingTarget(e.target)) return
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "'") {
      e.preventDefault()
      toggleGridVisible()
      return
    }
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      toggleSnapOn()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => {
    window.removeEventListener('keydown', onKey)
  }
}
