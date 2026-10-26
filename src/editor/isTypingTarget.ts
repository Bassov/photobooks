/** True when Space should type into the focused control instead of arming pan. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el.isContentEditable) return true
  if (!(el instanceof HTMLInputElement)) return false
  return ![
    'file',
    'checkbox',
    'radio',
    'range',
    'button',
    'submit',
    'color',
  ].includes(el.type)
}

/**
 * Space must not be stolen for chrome pan while filmstrip place/selection or
 * other activatable controls need it (product pasteboard already gates pan by
 * pointer-over-pasteboard).
 */
export function shouldDeferChromeSpacePan(el: EventTarget | null): boolean {
  if (isTypingTarget(el)) return true
  if (!(el instanceof HTMLElement)) return false
  if (
    el.closest(
      '[data-testid="filmstrip"], [data-testid="dock"], [data-testid="panel-b"], [data-testid="film-panel"]',
    )
  ) {
    return true
  }
  return Boolean(
    el.closest(
      'button, [role="button"], [role="option"], [role="gridcell"], [role="menuitem"], [role="radio"], a, select, textarea',
    ),
  )
}
