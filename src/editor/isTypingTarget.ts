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
