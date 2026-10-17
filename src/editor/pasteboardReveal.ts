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
  // mid-check shifts layout and clears reveal while the box still overflows.
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
  const fits = after.height <= port.height + 1 && after.width <= port.width + 1
  if (!spreadBoxContained(port, after) && fits) {
    const beforeTop = scroll.scrollTop
    nudgeBoxIntoPort(scroll, after)
    const port2 = scroll.getBoundingClientRect()
    const after2 = target.getBoundingClientRect()
    if (!spreadBoxContained(port2, after2)) {
      let top = scroll.scrollTop
      let left = scroll.scrollLeft
      if (after2.bottom > port2.bottom + 1) {
        top += after2.bottom - port2.bottom
      } else if (after2.top < port2.top - 1) {
        top -= port2.top - after2.top
      }
      if (after2.right > port2.right + 1) {
        left += after2.right - port2.right
      } else if (after2.left < port2.left - 1) {
        left -= port2.left - after2.left
      }
      scroll.scrollTop = Math.max(0, top)
      scroll.scrollLeft = Math.max(0, left)
    }
    if (
      scroll.scrollTop <= beforeTop + 0.5 &&
      scroll.scrollTop >=
        Math.max(0, scroll.scrollHeight - scroll.clientHeight) - 1 &&
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
