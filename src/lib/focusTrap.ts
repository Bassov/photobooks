const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Index Tab (Shift+Tab when `back`) moves to among `count` tabbables,
 * wrapping at both ends; from outside them (`current` -1) it enters at the
 * first (last). -1 when there is nothing to focus.
 */
export function nextTrapIndex(
  current: number,
  count: number,
  back: boolean,
): number {
  if (count <= 0) {
    return -1
  }
  if (current < 0) {
    return back ? count - 1 : 0
  }
  return (current + (back ? count - 1 : 1)) % count
}

/** Tabbable elements inside `root` in DOM order, skipping inert subtrees. */
export function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.closest('[inert]') === null,
  )
}

/**
 * Tab inside a modal: focus the next (previous) tabbable in `root`, or
 * `root` itself when it has none, so focus never leaves it.
 */
export function trapTab(root: HTMLElement | null, back: boolean): void {
  if (root === null) {
    return
  }
  const list = tabbablesIn(root)
  const active = document.activeElement
  const current = list.findIndex((el) => el === active)
  const next = list[nextTrapIndex(current, list.length, back)] ?? root
  next.focus()
}

/**
 * Modal open: focus `root` and return the close step, which hands focus
 * back to the element focused before if it is still in the document.
 */
export function takeFocus(root: HTMLElement | null): () => void {
  const opener = document.activeElement
  root?.focus()
  return () => {
    if (opener instanceof HTMLElement && opener.isConnected) {
      opener.focus()
    }
  }
}
