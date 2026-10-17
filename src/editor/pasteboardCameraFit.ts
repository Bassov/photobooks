export const FIT_VIEWPORT_INSET_PX = 24

export function fitViewportSize(
  clientWidth: number,
  clientHeight: number,
  insetPx: number = FIT_VIEWPORT_INSET_PX,
): { viewportWidth: number; viewportHeight: number } {
  return {
    viewportWidth: Math.max(1, clientWidth - insetPx),
    viewportHeight: Math.max(1, clientHeight - insetPx),
  }
}

export function shouldHoldCameraScroll(
  holdScrollRef: { current: boolean } | null | undefined,
): boolean {
  return holdScrollRef?.current === true
}

/** Delayed fit may only zoom out — never pull zoom up after a transient tall port. */
export function shouldApplyDelayedFitZoom(
  following: boolean,
  nextZoom: number,
  committedZoom: number,
): boolean {
  return following && nextZoom < committedZoom - 1e-9
}
