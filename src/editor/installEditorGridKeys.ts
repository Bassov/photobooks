import { isTypingTarget } from './isTypingTarget'
import { toggleGridVisible, toggleSnapOn } from './gridView'
import { toggleRulersVisible } from './rulersView'

/** Ctrl/⌘+' shows / hides the layout grid; Shift+S turns snapping on / off; Shift+R shows / hides rulers. */
export function installEditorGridKeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.altKey || isTypingTarget(e.target)) return
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "'") {
      e.preventDefault()
      toggleGridVisible()
      return
    }
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        toggleSnapOn()
      } else if (key === 'r') {
        e.preventDefault()
        toggleRulersVisible()
      }
    }
  }
  window.addEventListener('keydown', onKey)
  return () => {
    window.removeEventListener('keydown', onKey)
  }
}
