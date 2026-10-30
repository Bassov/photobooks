import { getCropTarget } from './cropMode'
import { getFrameSource } from './frameSelection'
import { isTypingTarget } from './isTypingTarget'
import { turnPhoto } from './photoRotate'

/** `,` turns the selected frame's photo 90° left, `.` 90° right. */
export function installEditorRotateKeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (e.key !== ',' && e.key !== '.') return
    if (isTypingTarget(e.target)) return
    const target = getCropTarget() ?? getFrameSource()
    if (target === null) return
    e.preventDefault()
    turnPhoto(target, e.key === '.' ? 1 : -1)
  }
  window.addEventListener('keydown', onKey)
  return () => {
    window.removeEventListener('keydown', onKey)
  }
}
