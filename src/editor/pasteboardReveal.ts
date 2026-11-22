export const REVEAL_TRY_CEILING = 64

export type RevealAttemptPlan =
  | { kind: 'retry' }
  | { kind: 'exhaust' }
  | { kind: 'confirm-paint' }
  | { kind: 'complete' }

export function revealTryBudget(atMaxScroll: boolean): number {
  return atMaxScroll ? REVEAL_TRY_CEILING * 2 : REVEAL_TRY_CEILING
}

export function isScrollNearMax(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): boolean {
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  return scrollTop >= maxScroll - 1
}

/** Decide the next reveal step after a nudge attempt (tries already incremented). */
export function planRevealAttempt(input: {
  revealed: boolean
  atMaxScroll: boolean
  tries: number
  paintConfirmed: boolean
  containedAfterPaint: boolean
}): RevealAttemptPlan {
  if (!input.revealed) {
    return input.tries < revealTryBudget(input.atMaxScroll)
      ? { kind: 'retry' }
      : { kind: 'exhaust' }
  }
  if (!input.paintConfirmed) {
    return { kind: 'confirm-paint' }
  }
  if (!input.containedAfterPaint) {
    return input.tries < REVEAL_TRY_CEILING * 2
      ? { kind: 'retry' }
      : { kind: 'exhaust' }
  }
  return { kind: 'complete' }
}

export function spreadBoxContained(port: DOMRect, box: DOMRect): boolean {
  return (
    box.width >= 1 &&
    box.height >= 1 &&
    box.top >= port.top - 1 &&
    box.bottom <= port.bottom + 1 &&
    box.left >= port.left - 1 &&
    box.right <= port.right + 1
  )
}

/** One axis of `spreadBoxRevealed`: inside when it fits, else covering. */
function axisRevealed(a0: number, a1: number, lo: number, hi: number): boolean {
  if (a1 - a0 <= hi - lo + 1) {
    return a0 >= lo - 1 && a1 <= hi + 1
  }
  return a0 <= lo + 1 && a1 >= hi - 1
}

/**
 * Per axis: a box that fits the port is inside it, a larger box covers it
 * (all `nudgeBoxIntoPort` can do). A spread wider or taller than the port is
 * never contained, so checking containment alone flip-flopped the reveal
 * between its two edges until the try budget ran out (M145).
 */
export function spreadBoxRevealed(port: DOMRect, box: DOMRect): boolean {
  return (
    box.width >= 1 &&
    box.height >= 1 &&
    axisRevealed(box.left, box.right, port.left, port.right) &&
    axisRevealed(box.top, box.bottom, port.top, port.bottom)
  )
}

export function nudgeBoxIntoPort(scroll: HTMLElement, box: DOMRect): void {
  const port = scroll.getBoundingClientRect()
  const contentTop = scroll.scrollTop + (box.top - port.top)
  const contentLeft = scroll.scrollLeft + (box.left - port.left)
  let top = scroll.scrollTop
  let left = scroll.scrollLeft
  if (box.height <= port.height + 1) {
    if (box.top < port.top - 1 || box.bottom > port.bottom + 1) {
      top = contentTop - Math.max(0, (port.height - box.height) / 2)
    }
  } else if (box.top < port.top - 1) {
    top -= port.top - box.top
  } else if (box.bottom > port.bottom + 1) {
    top += box.bottom - port.bottom
  }
  if (box.width <= port.width + 1) {
    if (box.left < port.left - 1 || box.right > port.right + 1) {
      left = contentLeft - Math.max(0, (port.width - box.width) / 2)
    }
  } else if (box.left < port.left - 1) {
    left -= port.left - box.left
  } else if (box.right > port.right + 1) {
    left += box.right - port.right
  }
  scroll.scrollTop = Math.max(0, top)
  scroll.scrollLeft = Math.max(0, left)
}

/**
 * Scroll delta on one axis for the box span [a0, a1] in the port [lo, hi]:
 * when the box fits the port inset by `inset`, the least shift that puts it
 * inside the inset band (0 when it already is); else centre it in the port.
 */
export function insetAxisDelta(
  a0: number,
  a1: number,
  lo: number,
  hi: number,
  inset: number,
): number {
  // Shifts d with a0 - d ≥ lo + inset and a1 - d ≤ hi - inset: [least, most].
  // Clamping 0 into it is the least scroll; when the box is larger the range
  // is empty and the clamp collapses to its midpoint, i.e. centring.
  const least = a1 - (hi - inset)
  const most = a0 - (lo + inset)
  const mid = (least + most) / 2
  return Math.min(Math.max(0, Math.min(least, mid)), Math.max(most, mid))
}

/**
 * Designer placed-badge B4 (M145): per axis, scroll the least that puts the
 * box inside the port inset by `inset`, or centre it when it is larger. The
 * port is the scroll element's rect (it starts at the spread list's right edge).
 */
export function nudgeBoxIntoInsetPort(
  scroll: HTMLElement,
  box: DOMRect,
  inset: number,
): void {
  const port = scroll.getBoundingClientRect()
  // The scroller clamps; writing an unchanged value fires no scroll event.
  scroll.scrollLeft += insetAxisDelta(
    box.left,
    box.right,
    port.left,
    port.right,
    inset,
  )
  scroll.scrollTop += insetAxisDelta(
    box.top,
    box.bottom,
    port.top,
    port.bottom,
    inset,
  )
}

/** Placed-badge jumps keep the frame this far inside the port edges (M145). */
export const PORT_INSET_PX = 24

/** `scroll + delta` clamped to the scroller's range on one axis. */
function clampedScroll(at: number, delta: number, max: number): number {
  return Math.min(Math.max(0, at + delta), Math.max(0, max))
}

/**
 * True when `nudgeBoxIntoInsetPort` would move the scroll by at most half a
 * pixel per axis (the B4 rule holds, or the scroller is clamped at its end).
 */
export function insetPortSettled(
  scroll: HTMLElement,
  box: DOMRect,
  inset: number,
): boolean {
  if (box.width < 1 || box.height < 1) {
    return false
  }
  const port = scroll.getBoundingClientRect()
  const { scrollLeft, scrollTop } = scroll
  const left = clampedScroll(
    scrollLeft,
    insetAxisDelta(box.left, box.right, port.left, port.right, inset),
    scroll.scrollWidth - scroll.clientWidth,
  )
  const top = clampedScroll(
    scrollTop,
    insetAxisDelta(box.top, box.bottom, port.top, port.bottom, inset),
    scroll.scrollHeight - scroll.clientHeight,
  )
  return Math.abs(left - scrollLeft) <= 0.5 && Math.abs(top - scrollTop) <= 0.5
}

/** The frame a frame-targeted reveal scrolls to (first match in the slot). */
function revealFrame(slot: HTMLElement, frameId: string): Element | null {
  return slot.querySelector(`[data-frame-id="${CSS.escape(frameId)}"]`)
}

/**
 * One axis of a frame jump: the spread centred in the port (clamped), then
 * the B4 inset rule on the frame as it sits at that scroll (clamped).
 */
function frameJumpAxis(
  at: number,
  max: number,
  spread: readonly [number, number],
  frame: readonly [number, number],
  port: readonly [number, number],
  inset: number,
): number {
  const centre = (spread[0] + spread[1] - port[0] - port[1]) / 2
  const target = clampedScroll(at, centre, max)
  const shift = target - at
  return clampedScroll(
    target,
    insetAxisDelta(frame[0] - shift, frame[1] - shift, port[0], port[1], inset),
    max,
  )
}

/**
 * Designer placed-badge B4 (M145): "spread reveal, then the frame rect
 * nudged" (the kit centres the target spread), folded into one scroll write
 * per axis: the frame is placed where it sits once its spread is centred and
 * the inset rule applied there, so no axis scrolls to the spread and back.
 */
function jumpScrollToFrame(
  scroll: HTMLElement,
  spread: DOMRect,
  frame: DOMRect,
  inset: number,
): void {
  const port = scroll.getBoundingClientRect()
  scroll.scrollLeft = frameJumpAxis(
    scroll.scrollLeft,
    scroll.scrollWidth - scroll.clientWidth,
    [spread.left, spread.right],
    [frame.left, frame.right],
    [port.left, port.right],
    inset,
  )
  scroll.scrollTop = frameJumpAxis(
    scroll.scrollTop,
    scroll.scrollHeight - scroll.clientHeight,
    [spread.top, spread.bottom],
    [frame.top, frame.bottom],
    [port.top, port.bottom],
    inset,
  )
}

/**
 * Frame-targeted reveal (placed-badge jump, M145): a frame already inside the
 * inset port scrolls nothing (a mounted frame need not be in view); else one
 * `jumpScrollToFrame`.
 */
function revealLaidOutFrame(
  scroll: HTMLElement,
  slot: HTMLElement,
  frameId: string,
): boolean {
  const frame = revealFrame(slot, frameId)
  const box = frame?.getBoundingClientRect()
  if (frame === null || box === undefined || box.width < 1 || box.height < 1) {
    return false
  }
  if (insetPortSettled(scroll, box, PORT_INSET_PX)) {
    return true
  }
  const view = slot.querySelector('[data-testid="spread-view"]')
  const spread = (
    view instanceof HTMLElement ? view : slot
  ).getBoundingClientRect()
  jumpScrollToFrame(scroll, spread, box, PORT_INSET_PX)
  return insetPortSettled(scroll, frame.getBoundingClientRect(), PORT_INSET_PX)
}

/** Post-paint check: the reveal target still where the reveal put it. */
function revealHolds(
  scroll: HTMLElement,
  slot: HTMLElement,
  frameId: string | null,
): boolean {
  if (frameId !== null) {
    const frame = revealFrame(slot, frameId)
    return (
      frame !== null &&
      insetPortSettled(scroll, frame.getBoundingClientRect(), PORT_INSET_PX)
    )
  }
  const view = slot.querySelector('[data-testid="spread-view"]')
  const target = view instanceof HTMLElement ? view : slot
  return spreadBoxRevealed(
    scroll.getBoundingClientRect(),
    target.getBoundingClientRect(),
  )
}

export function revealLaidOutSpread(
  scroll: HTMLElement,
  slot: HTMLElement,
  frameId: string | null = null,
): boolean {
  // Keep content-visibility forced for the whole pending reveal; restoring
  // mid-check shifts layout and can clear while the box still overflows.
  slot.style.contentVisibility = 'visible'
  if (frameId !== null) {
    return revealLaidOutFrame(scroll, slot, frameId)
  }
  const view = slot.querySelector('[data-testid="spread-view"]')
  const target = view instanceof HTMLElement ? view : slot
  const box = target.getBoundingClientRect()
  if (box.width < 1 || box.height < 1) {
    return false
  }
  nudgeBoxIntoPort(scroll, box)
  const port = scroll.getBoundingClientRect()
  const after = target.getBoundingClientRect()
  const heightFits = after.height <= port.height + 1
  const widthFits = after.width <= port.width + 1
  // Secondary nudges when at least one axis still fits — an AND gate skipped
  // horizontal correction for height-fit / width-overflow (and the tall twin).
  if (!spreadBoxRevealed(port, after) && (heightFits || widthFits)) {
    const beforeTop = scroll.scrollTop
    nudgeBoxIntoPort(scroll, after)
    const afterSecond = target.getBoundingClientRect()
    if (!spreadBoxRevealed(scroll.getBoundingClientRect(), afterSecond)) {
      nudgeBoxIntoPort(scroll, afterSecond)
    }
    if (
      scroll.scrollTop <= beforeTop + 0.5 &&
      isScrollNearMax(
        scroll.scrollTop,
        scroll.scrollHeight,
        scroll.clientHeight,
      ) &&
      !spreadBoxRevealed(
        scroll.getBoundingClientRect(),
        target.getBoundingClientRect(),
      )
    ) {
      return false
    }
  }
  return spreadBoxRevealed(
    scroll.getBoundingClientRect(),
    target.getBoundingClientRect(),
  )
}

/** Clear pending-reveal slot styling; always drop forced content-visibility. */
export function restoreRevealSlotVisibility(slot: HTMLElement | null): void {
  if (slot !== null) {
    slot.style.contentVisibility = ''
  }
}

export type PostPaintRevealAction = 'retry' | 'exhaust' | 'complete'

/** After paint confirm: retry, give up, or finish (caller restores visibility). */
export function actionAfterPaintConfirm(input: {
  containedAfterPaint: boolean
  tries: number
  atMaxScroll: boolean
}): PostPaintRevealAction {
  if (input.containedAfterPaint) {
    return 'complete'
  }
  const plan = planRevealAttempt({
    revealed: true,
    atMaxScroll: input.atMaxScroll,
    tries: input.tries,
    paintConfirmed: true,
    containedAfterPaint: false,
  })
  return plan.kind === 'retry' ? 'retry' : 'exhaust'
}

export type PendingRevealTurn =
  | { kind: 'await-slot'; top: number }
  | { kind: 'retry' }
  | { kind: 'clear' }
  | {
      kind: 'paint-confirm'
      scrollLeft: number
      scrollTop: number
    }
  | { kind: 'post-paint'; action: PostPaintRevealAction }

export interface PendingRevealState {
  tries: number
  paintConfirmed: boolean
}

/** Pure turn for one pending-reveal layout pass (mutated; hook only applies). */
export function turnPendingReveal(input: {
  slot: HTMLElement | null
  scroll: HTMLElement
  spreadCount: number
  stride: number
  state: PendingRevealState
  /** Index of the spread being revealed; defaults to the last (add-spread). */
  index?: number
  /** Scroll straight to this frame of the spread (B4 inset rule), not the spread. */
  frameId?: string | null
}): { turn: PendingRevealTurn; state: PendingRevealState } {
  const state = { ...input.state }
  if (input.slot === null) {
    const index = input.index ?? input.spreadCount - 1
    return {
      turn: {
        kind: 'await-slot',
        top: Math.max(0, index * input.stride),
      },
      state,
    }
  }
  if (!state.paintConfirmed) {
    const revealed = revealLaidOutSpread(
      input.scroll,
      input.slot,
      input.frameId ?? null,
    )
    if (!revealed) {
      state.tries += 1
      // Budget depends on clamp after the nudge, not the pre-reveal scroll.
      const atMaxScroll = isScrollNearMax(
        input.scroll.scrollTop,
        input.scroll.scrollHeight,
        input.scroll.clientHeight,
      )
      const plan = planRevealAttempt({
        revealed: false,
        atMaxScroll,
        tries: state.tries,
        paintConfirmed: false,
        containedAfterPaint: false,
      })
      return {
        turn: plan.kind === 'retry' ? { kind: 'retry' } : { kind: 'clear' },
        state,
      }
    }
    state.paintConfirmed = true
    return {
      turn: {
        kind: 'paint-confirm',
        scrollLeft: input.scroll.scrollLeft,
        scrollTop: input.scroll.scrollTop,
      },
      state,
    }
  }
  const containedAfterPaint = revealHolds(
    input.scroll,
    input.slot,
    input.frameId ?? null,
  )
  if (!containedAfterPaint) {
    state.paintConfirmed = false
    state.tries += 1
  }
  const atMaxScroll = isScrollNearMax(
    input.scroll.scrollTop,
    input.scroll.scrollHeight,
    input.scroll.clientHeight,
  )
  return {
    turn: {
      kind: 'post-paint',
      action: actionAfterPaintConfirm({
        containedAfterPaint,
        tries: state.tries,
        atMaxScroll,
      }),
    },
    state,
  }
}
