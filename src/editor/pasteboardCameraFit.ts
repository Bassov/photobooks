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
  nextZoom: number | null,
  committedZoom: number,
): boolean {
  return following && nextZoom !== null && nextZoom < committedZoom - 1e-9
}

export interface DelayedFitFollow {
  following: boolean
  rafId: number
}

export function createDelayedFitFollow(): DelayedFitFollow {
  return { following: false, rafId: 0 }
}

export function beginDelayedFitFollow(state: DelayedFitFollow): void {
  state.following = true
}

export function stopDelayedFitFollow(
  state: DelayedFitFollow,
  cancelRaf: (id: number) => void,
): void {
  state.following = false
  if (state.rafId !== 0) {
    cancelRaf(state.rafId)
    state.rafId = 0
  }
}

/**
 * Schedule a double-rAF delayed fit. Returns whether the second frame should
 * apply zoom-out (caller supplies zooms). Cancels any prior scheduled frame.
 */
export function scheduleDelayedFitDoubleRaf(
  state: DelayedFitFollow,
  scheduleRaf: (cb: FrameRequestCallback) => number,
  cancelRaf: (id: number) => void,
  onSecondFrame: () => void,
): void {
  if (state.rafId !== 0) {
    cancelRaf(state.rafId)
    state.rafId = 0
  }
  state.rafId = scheduleRaf(() => {
    state.rafId = scheduleRaf(() => {
      state.rafId = 0
      onSecondFrame()
    })
  })
}

/** Run on the second delayed-fit frame; clears following and reports apply. */
export function resolveDelayedFitFrame(
  state: DelayedFitFollow,
  nextZoom: number | null,
  committedZoom: number,
): { apply: boolean; zoom: number | null } {
  const apply = shouldApplyDelayedFitZoom(
    state.following,
    nextZoom,
    committedZoom,
  )
  state.following = false
  return { apply, zoom: apply ? nextZoom : null }
}
