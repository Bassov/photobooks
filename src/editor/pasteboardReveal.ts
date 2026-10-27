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

export function revealLaidOutSpread(
  scroll: HTMLElement,
  slot: HTMLElement,
): boolean {
  // Keep content-visibility forced for the whole pending reveal; restoring
  // mid-check shifts layout and can clear while the box still overflows.
  slot.style.contentVisibility = 'visible'
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
  if (!spreadBoxContained(port, after) && (heightFits || widthFits)) {
    const beforeTop = scroll.scrollTop
    nudgeBoxIntoPort(scroll, after)
    const afterSecond = target.getBoundingClientRect()
    if (!spreadBoxContained(scroll.getBoundingClientRect(), afterSecond)) {
      nudgeBoxIntoPort(scroll, afterSecond)
    }
    if (
      scroll.scrollTop <= beforeTop + 0.5 &&
      isScrollNearMax(
        scroll.scrollTop,
        scroll.scrollHeight,
        scroll.clientHeight,
      ) &&
      !spreadBoxContained(
        scroll.getBoundingClientRect(),
        target.getBoundingClientRect(),
      )
    ) {
      return false
    }
  }
  return spreadBoxContained(
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
    const revealed = revealLaidOutSpread(input.scroll, input.slot)
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
  const view = input.slot.querySelector('[data-testid="spread-view"]')
  const target = view instanceof HTMLElement ? view : input.slot
  const containedAfterPaint = spreadBoxContained(
    input.scroll.getBoundingClientRect(),
    target.getBoundingClientRect(),
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
