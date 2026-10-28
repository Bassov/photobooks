import { isSpacePanCode } from './editorChromePanels'
import { EDITOR_TOOL_KEYS, setEditorTool } from './editorToolStore'
import { isTypingTarget } from './isTypingTarget'

/** V / F / T / H pick a tool; ignored while typing, with modifiers or Space held. */
export function installEditorToolKeys(): () => void {
  let spaceDown = false

  // Capture phase: chrome Space-pan stops propagation at window capture.
  const onSpace = (e: KeyboardEvent) => {
    if (isSpacePanCode(e.code)) spaceDown = e.type === 'keydown'
  }
  const onKey = (e: KeyboardEvent) => {
    if (spaceDown || e.repeat || isSpacePanCode(e.code)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (isTypingTarget(e.target)) return
    const next = EDITOR_TOOL_KEYS[e.key.toLowerCase()]
    if (!next) return
    e.preventDefault()
    setEditorTool(next)
  }
  const clear = () => {
    spaceDown = false
  }
  window.addEventListener('keydown', onSpace, true)
  window.addEventListener('keyup', onSpace, true)
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', clear)
  return () => {
    window.removeEventListener('keydown', onSpace, true)
    window.removeEventListener('keyup', onSpace, true)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('blur', clear)
  }
}
