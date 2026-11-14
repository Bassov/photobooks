/*
 * Swipe back (Designer D25; touch and pen on phones): a rightward swipe that
 * starts outside the book follows the finger once dx > 10 and dx > 1.5·|dy|
 * (abandoned if |dy| > 10 or dx < −10 comes first); a release past 0.25·w or
 * faster than 0.5 px/ms (over the last 80 ms) slides the room out in 200 ms
 * and closes it, else it springs back.
 */

/** A touch / pen press that may become a swipe back. */
export interface Swipe {
  id: number
  x0: number
  y0: number
  /** following the finger */
  active: boolean
  /** how far the room follows (≥ 0) */
  dx: number
  /** [time, dx] of the moves within the velocity window */
  trail: readonly (readonly [number, number])[]
}

/** The release velocity window. */
const WINDOW_MS = 80
/** The slide out / spring back. */
export const SWIPE_MS = 200

export const swipeStart = (id: number, x: number, y: number): Swipe => ({
  id,
  x0: x,
  y0: y,
  active: false,
  dx: 0,
  trail: [],
})

/** The press after a move to (x, y) at time t; null when it is no swipe back. */
export function swipeMove(
  g: Swipe,
  x: number,
  y: number,
  t: number,
): Swipe | null {
  const dx = x - g.x0
  const dy = Math.abs(y - g.y0)
  if (!g.active) {
    if (dy > 10 || dx < -10) return null
    if (dx <= 10 || dx <= 1.5 * dy) return g
  }
  const follow = Math.max(0, dx)
  return {
    ...g,
    active: true,
    dx: follow,
    trail: [...g.trail.filter(([tt]) => t - tt <= WINDOW_MS), [t, follow]],
  }
}

/** A release at time t of a room w wide: true when it closes the room. */
export function swipeShuts(g: Swipe, t: number, w: number): boolean {
  if (g.dx > 0.25 * w) return true
  const was = g.trail.find(([tt]) => t - tt <= WINDOW_MS)
  if (was === undefined || t <= was[0]) return false
  return (g.dx - was[1]) / (t - was[0]) > 0.5
}

/** The room following the finger by `dx`, or sliding there in `ms`. */
export function paintSwipe(el: HTMLElement, dx: number, ms: number) {
  // data-swipe: "move" while the room follows the finger or slides (tests wait on it)
  el.dataset.swipe = dx || ms ? 'move' : ''
  el.style.transition = ms
    ? `transform ${String(ms)}ms var(--ease-out), box-shadow ${String(ms)}ms var(--ease-out)`
    : 'none'
  el.style.transform = dx ? `translate3d(${String(dx)}px,0,0)` : ''
  el.style.boxShadow = dx ? '-16px 0 32px rgb(0 0 0 / .5)' : ''
}
