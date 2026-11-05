/**
 * A selected local copy paints in the parent layer, under own frames, so
 * SpreadView draws its ring and handles on a peer above every frame
 * (`[data-selection-for]`, Designer PO3). Live gesture writes on the copy's
 * button go to the peer too, so the chrome follows the drag.
 */
const SPREAD_SELECTOR = '[data-testid="spread-view"]'
const PEER_SELECTOR = '[data-selection-for]'

function byAttr(
  scope: Element | null | undefined,
  selector: string,
  attr: string,
  value: string | null | undefined,
): HTMLElement | null {
  return (
    Array.from(scope?.querySelectorAll<HTMLElement>(selector) ?? []).find(
      (el) => el.getAttribute(attr) === value,
    ) ?? null
  )
}

/** The frame button a handle belongs to: its own, or the copy behind a peer. */
export function handleOwner(handleEl: Element): HTMLElement | null {
  const button = handleEl.closest<HTMLElement>('button.spread-frame')
  if (button !== null) {
    return button
  }
  const peer = handleEl.closest(PEER_SELECTOR)
  return byAttr(
    peer?.closest(SPREAD_SELECTOR),
    'button.spread-frame',
    'data-frame-id',
    peer?.getAttribute('data-selection-for'),
  )
}

/** A frame button and, for a selected copy, its selection peer. */
export function paintedOf(button: HTMLElement): HTMLElement[] {
  const peer = byAttr(
    button.closest(SPREAD_SELECTOR),
    PEER_SELECTOR,
    'data-selection-for',
    button.getAttribute('data-frame-id'),
  )
  return peer === null ? [button] : [button, peer]
}
