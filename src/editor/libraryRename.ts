/** Skip rename persistence when the normalized title is unchanged. */
export function shouldSkipLibraryRename(
  currentTitle: string | undefined,
  nextNormalized: string,
): boolean {
  return currentTitle === nextNormalized
}

/**
 * Ref for the inline rename field. The book menu popover restores focus to its
 * trigger as it closes, so `autoFocus` loses; focus on the next frame instead
 * (kit `#/demo` step 43 keeps focus in the field).
 */
export function focusRenameInput(
  input: HTMLInputElement | null,
): (() => void) | undefined {
  if (!input) {
    return undefined
  }
  const frame = requestAnimationFrame(() => {
    input.focus()
  })
  return () => {
    cancelAnimationFrame(frame)
  }
}
