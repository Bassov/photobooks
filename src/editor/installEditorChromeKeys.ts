import {
  isPanelToggleChord,
  isSpacePanCode,
  panelHotkeyAction,
  toggleAllEditorPanels,
  toggleEditorPanel,
  type EditorPanels,
} from './editorChromePanels'
import { isTypingTarget, shouldDeferChromeSpacePan } from './isTypingTarget'

export function installEditorChromeKeys(options: {
  getPanels: () => EditorPanels
  setPanels: (next: EditorPanels) => void
  setSpaceDown: (down: boolean) => void
}): () => void {
  const { getPanels, setPanels, setSpaceDown } = options
  let spaceDown = false

  const onSpace = (e: KeyboardEvent) => {
    if (!isSpacePanCode(e.code) || shouldDeferChromeSpacePan(e.target)) return
    if (e.type === 'keydown') {
      e.preventDefault()
      e.stopPropagation()
      spaceDown = true
      setSpaceDown(true)
    } else {
      spaceDown = false
      setSpaceDown(false)
    }
  }

  const clearSpace = () => {
    spaceDown = false
    setSpaceDown(false)
  }

  const onPanelKey = (e: KeyboardEvent) => {
    if (spaceDown || isSpacePanCode(e.code)) return
    const el = e.target instanceof HTMLElement ? e.target : null
    if (isTypingTarget(e.target)) return
    const mod = e.metaKey || e.ctrlKey
    if (isPanelToggleChord(mod, e.key)) {
      e.preventDefault()
      setPanels(toggleAllEditorPanels(getPanels()))
      return
    }
    if (mod || e.altKey) return
    if (el?.closest('input')) return
    const action = panelHotkeyAction(e.key, {
      left: true,
      bottom: true,
      right: true,
    })
    if (action.kind === 'toggle') {
      e.preventDefault()
      setPanels(toggleEditorPanel(getPanels(), action.key))
    }
  }

  window.addEventListener('keydown', onSpace, true)
  window.addEventListener('keyup', onSpace, true)
  window.addEventListener('blur', clearSpace)
  window.addEventListener('keydown', onPanelKey)
  return () => {
    window.removeEventListener('keydown', onSpace, true)
    window.removeEventListener('keyup', onSpace, true)
    window.removeEventListener('blur', clearSpace)
    window.removeEventListener('keydown', onPanelKey)
  }
}
