/*
 * Reveal pasted / duplicated frames (Designer frame-copy-paste Keys): when
 * less than half of their box is in the pasteboard viewport, scroll by the
 * least amount that shows the whole box (centred on an axis where it is
 * bigger than the viewport). The zoom never changes.
 */
import { requestSpreadReveal } from './photoRootSession'

export interface ClientBox {
  left: number
  top: number
  right: number
  bottom: number
}

/** The least shift on one axis putting [a0, a1] inside [lo, hi]; centred when larger. */
function axisDelta(a0: number, a1: number, lo: number, hi: number): number {
  if (a1 - a0 > hi - lo) {
    return (a0 + a1) / 2 - (lo + hi) / 2
  }
  if (a0 < lo) {
    return a0 - lo
  }
  return a1 > hi ? a1 - hi : 0
}

const overlap = (a0: number, a1: number, lo: number, hi: number): number =>
  Math.max(0, Math.min(a1, hi) - Math.max(a0, lo))

/** Scroll delta (px) revealing `box` in `view`; zero when ≥ 50 % of it shows. */
export function revealDelta(
  box: ClientBox,
  view: ClientBox,
): { dx: number; dy: number } {
  const area = (box.right - box.left) * (box.bottom - box.top)
  const shown =
    overlap(box.left, box.right, view.left, view.right) *
    overlap(box.top, box.bottom, view.top, view.bottom)
  if (shown * 2 >= area) {
    return { dx: 0, dy: 0 }
  }
  return {
    dx: axisDelta(box.left, box.right, view.left, view.right),
    dy: axisDelta(box.top, box.bottom, view.top, view.bottom),
  }
}

/** The union of the frames' painted boxes on the pasteboard, else null. */
function framesBox(
  port: Element,
  spreadId: string,
  frameIds: readonly string[],
): ClientBox | null {
  const spread = port.querySelector(
    `[data-spread-id="${CSS.escape(spreadId)}"]`,
  )
  const rects = frameIds.flatMap((id) => {
    const el = spread?.querySelector(
      `button.spread-frame[data-frame-id="${CSS.escape(id)}"]`,
    )
    return el ? [el.getBoundingClientRect()] : []
  })
  if (rects.length === 0) {
    return null
  }
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  }
}

/**
 * After the next paint, scroll `.pasteboard-scroll` so the frames show; a
 * spread the pasteboard has not mounted is revealed whole instead.
 */
export function revealFrames(
  spreadId: string,
  frameIds: readonly string[],
): void {
  requestAnimationFrame(() => {
    const port = document.querySelector('.pasteboard-scroll')
    if (port === null) {
      return
    }
    const box = framesBox(port, spreadId, frameIds)
    if (box === null) {
      requestSpreadReveal(spreadId)
      return
    }
    const { dx, dy } = revealDelta(box, port.getBoundingClientRect())
    if (dx !== 0 || dy !== 0) {
      port.scrollBy({ left: dx, top: dy, behavior: 'instant' })
    }
  })
}
