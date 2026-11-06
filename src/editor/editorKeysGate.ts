let suspended = 0

/**
 * A layer over the editor (site preview) owns the keyboard: the editor's own
 * capture-phase key listeners, which run before the layer's, step aside.
 * Returns the resume step.
 */
export function suspendEditorKeys(): () => void {
  suspended += 1
  let resumed = false
  return () => {
    if (resumed) return
    resumed = true
    suspended -= 1
  }
}

export function editorKeysSuspended(): boolean {
  return suspended > 0
}
