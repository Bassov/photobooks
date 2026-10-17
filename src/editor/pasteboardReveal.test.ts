import { describe, expect, it } from 'vitest'
import {
  isScrollNearMax,
  nudgeBoxIntoPort,
  planRevealAttempt,
  REVEAL_TRY_CEILING,
  revealLaidOutSpread,
  revealTryBudget,
  spreadBoxContained,
} from './pasteboardReveal'

const PORT = { top: 100, left: 40, width: 500, height: 400 }

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return new DOMRect(left, top, width, height)
}

function mockScroll(init?: {
  scrollTop?: number
  scrollLeft?: number
  scrollHeight?: number
  scrollWidth?: number
}): HTMLElement {
  const state = {
    scrollTop: init?.scrollTop ?? 0,
    scrollLeft: init?.scrollLeft ?? 0,
    scrollHeight: init?.scrollHeight ?? 2000,
    scrollWidth: init?.scrollWidth ?? 800,
  }
  return {
    get scrollTop() {
      return state.scrollTop
    },
    set scrollTop(value: number) {
      const max = Math.max(0, state.scrollHeight - PORT.height)
      state.scrollTop = Math.min(max, Math.max(0, value))
    },
    get scrollLeft() {
      return state.scrollLeft
    },
    set scrollLeft(value: number) {
      const max = Math.max(0, state.scrollWidth - PORT.width)
      state.scrollLeft = Math.min(max, Math.max(0, value))
    },
    get scrollHeight() {
      return state.scrollHeight
    },
    get scrollWidth() {
      return state.scrollWidth
    },
    get clientHeight() {
      return PORT.height
    },
    get clientWidth() {
      return PORT.width
    },
    getBoundingClientRect: () =>
      rect(PORT.left, PORT.top, PORT.width, PORT.height),
  } as HTMLElement
}

function mockSlot(getBox: () => DOMRect): HTMLElement {
  const slot = document.createElement('div')
  const view = document.createElement('div')
  view.dataset.testid = 'spread-view'
  view.getBoundingClientRect = getBox
  slot.append(view)
  return slot
}

describe('revealTryBudget / planRevealAttempt', () => {
  it('doubles the ceiling while clamped at max scroll', () => {
    expect(revealTryBudget(false)).toBe(REVEAL_TRY_CEILING)
    expect(revealTryBudget(true)).toBe(REVEAL_TRY_CEILING * 2)
  })

  it('treats scrollTop at max-1 as near max', () => {
    expect(isScrollNearMax(99, 500, 400)).toBe(true)
    expect(isScrollNearMax(98, 500, 400)).toBe(false)
  })

  it('retries until budget then exhausts when not revealed', () => {
    expect(
      planRevealAttempt({
        revealed: false,
        atMaxScroll: false,
        tries: REVEAL_TRY_CEILING - 1,
        paintConfirmed: false,
        containedAfterPaint: false,
      }),
    ).toEqual({ kind: 'retry' })
    expect(
      planRevealAttempt({
        revealed: false,
        atMaxScroll: false,
        tries: REVEAL_TRY_CEILING,
        paintConfirmed: false,
        containedAfterPaint: false,
      }),
    ).toEqual({ kind: 'exhaust' })
  })

  it('asks for paint confirm then completes when contained', () => {
    expect(
      planRevealAttempt({
        revealed: true,
        atMaxScroll: false,
        tries: 1,
        paintConfirmed: false,
        containedAfterPaint: false,
      }),
    ).toEqual({ kind: 'confirm-paint' })
    expect(
      planRevealAttempt({
        revealed: true,
        atMaxScroll: false,
        tries: 1,
        paintConfirmed: true,
        containedAfterPaint: true,
      }),
    ).toEqual({ kind: 'complete' })
  })

  it('retries after paint when still overflowing until double ceiling', () => {
    expect(
      planRevealAttempt({
        revealed: true,
        atMaxScroll: true,
        tries: REVEAL_TRY_CEILING * 2 - 1,
        paintConfirmed: true,
        containedAfterPaint: false,
      }),
    ).toEqual({ kind: 'retry' })
    expect(
      planRevealAttempt({
        revealed: true,
        atMaxScroll: true,
        tries: REVEAL_TRY_CEILING * 2,
        paintConfirmed: true,
        containedAfterPaint: false,
      }),
    ).toEqual({ kind: 'exhaust' })
  })
})

describe('spreadBoxContained', () => {
  it('accepts a box fully inside the port with 1px tolerance', () => {
    const port = rect(PORT.left, PORT.top, PORT.width, PORT.height)
    expect(spreadBoxContained(port, rect(PORT.left, PORT.top, 200, 180))).toBe(
      true,
    )
    expect(
      spreadBoxContained(port, rect(PORT.left - 1, PORT.top - 1, 200, 180)),
    ).toBe(true)
  })

  it('accepts exactly 1px size and edges on the +1px tolerance', () => {
    const port = rect(PORT.left, PORT.top, PORT.width, PORT.height)
    expect(spreadBoxContained(port, rect(PORT.left, PORT.top, 1, 1))).toBe(true)
    expect(
      spreadBoxContained(
        port,
        rect(PORT.left, PORT.top, PORT.width, PORT.height),
      ),
    ).toBe(true)
    expect(
      spreadBoxContained(
        port,
        rect(PORT.left, PORT.top, PORT.width + 1, PORT.height + 1),
      ),
    ).toBe(true)
  })

  it('rejects a box that overflows any edge past tolerance', () => {
    const port = rect(PORT.left, PORT.top, PORT.width, PORT.height)
    expect(
      spreadBoxContained(port, rect(PORT.left, PORT.top - 2, 200, 180)),
    ).toBe(false)
    expect(
      spreadBoxContained(port, rect(PORT.left - 2, PORT.top, 200, 180)),
    ).toBe(false)
    expect(
      spreadBoxContained(port, rect(PORT.left, PORT.top, PORT.width + 2, 180)),
    ).toBe(false)
    expect(
      spreadBoxContained(port, rect(PORT.left, PORT.top, 200, PORT.height + 2)),
    ).toBe(false)
    expect(spreadBoxContained(port, rect(PORT.left, PORT.top, 0, 180))).toBe(
      false,
    )
    expect(spreadBoxContained(port, rect(PORT.left, PORT.top, 200, 0))).toBe(
      false,
    )
  })
})

describe('nudgeBoxIntoPort', () => {
  it('centers a short box that sits below the port', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    nudgeBoxIntoPort(scroll, rect(PORT.left, PORT.top + 250, 200, 180))
    expect(scroll.scrollTop).toBe(190)
    expect(scroll.scrollLeft).toBe(40)
  })

  it('pulls a tall box down when its top is above the port', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    nudgeBoxIntoPort(scroll, rect(PORT.left, PORT.top - 30, 200, 420))
    expect(scroll.scrollTop).toBe(20)
    expect(scroll.scrollLeft).toBe(40)
  })

  it('pushes a tall box up when its bottom is below the port', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    nudgeBoxIntoPort(scroll, rect(PORT.left, PORT.top, 200, 420))
    expect(scroll.scrollTop).toBe(70)
    expect(scroll.scrollLeft).toBe(40)
  })

  it('pulls a wide box right when its left is outside the port', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    nudgeBoxIntoPort(scroll, rect(PORT.left - 30, PORT.top, 520, 180))
    expect(scroll.scrollTop).toBe(50)
    expect(scroll.scrollLeft).toBe(10)
  })

  it('pushes a wide box left when its right is outside the port', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    nudgeBoxIntoPort(scroll, rect(PORT.left, PORT.top, 520, 180))
    expect(scroll.scrollTop).toBe(50)
    expect(scroll.scrollLeft).toBe(60)
  })

  it('pulls a short box down when only its top is above the port', () => {
    const scroll = mockScroll({ scrollTop: 40, scrollLeft: 40 })
    nudgeBoxIntoPort(scroll, rect(PORT.left, PORT.top - 30, 200, 180))
    expect(scroll.scrollTop).toBe(0)
    expect(scroll.scrollLeft).toBe(40)
  })

  it('centers a short-wide box that sits to the right of the port', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    // left=350 → right=550 > port.right+1 (541)
    nudgeBoxIntoPort(scroll, rect(PORT.left + 310, PORT.top, 200, 180))
    expect(scroll.scrollTop).toBe(50)
    // contentLeft = 40 + 310 = 350; left = 350 - (500-200)/2 = 200
    expect(scroll.scrollLeft).toBe(200)
  })

  it('pulls a tall box by its top when both edges overflow', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    nudgeBoxIntoPort(scroll, rect(PORT.left, PORT.top - 10, 200, 420))
    expect(scroll.scrollTop).toBe(40)
  })

  it('treats height equal to port+1 as fitting short-box centering', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    nudgeBoxIntoPort(
      scroll,
      rect(PORT.left, PORT.top + 100, 200, PORT.height + 1),
    )
    expect(scroll.scrollTop).toBe(150)
  })

  it('treats width equal to port+1 as fitting short-box centering', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    nudgeBoxIntoPort(
      scroll,
      rect(PORT.left + 100, PORT.top, PORT.width + 1, 180),
    )
    expect(scroll.scrollLeft).toBe(140)
  })
})

describe('revealLaidOutSpread', () => {
  it('returns false when the spread has no measurable size', () => {
    const scroll = mockScroll()
    expect(
      revealLaidOutSpread(
        scroll,
        mockSlot(() => rect(0, 0, 0, 0)),
      ),
    ).toBe(false)
  })

  it('returns false when the spread cannot fit in the port', () => {
    const scroll = mockScroll()
    expect(
      revealLaidOutSpread(
        scroll,
        mockSlot(() => rect(PORT.left, PORT.top, 200, 500)),
      ),
    ).toBe(false)
  })

  it('forces content-visibility visible while revealing', () => {
    const scroll = mockScroll({ scrollTop: 50 })
    const slot = mockSlot(() => rect(PORT.left + 10, PORT.top + 10, 200, 180))
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
    expect(slot.style.contentVisibility).toBe('visible')
  })

  it('returns true when the spread already lies in the port', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    expect(
      revealLaidOutSpread(
        scroll,
        mockSlot(() => rect(PORT.left + 10, PORT.top + 10, 200, 180)),
      ),
    ).toBe(true)
  })

  it('returns false when scroll is clamped at max and still overflows', () => {
    const scroll = mockScroll({
      scrollTop: 1600,
      scrollHeight: PORT.height + 1600,
    })
    // Fixed viewport box below the port: nudge cannot move it (stub ignores scroll).
    expect(
      revealLaidOutSpread(
        scroll,
        mockSlot(() => rect(PORT.left, PORT.top + 250, 200, 180)),
      ),
    ).toBe(false)
  })

  it('nudges then reports contained when the box tracks scroll', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    const slot = mockSlot(() =>
      rect(PORT.left, PORT.top + 250 - scroll.scrollTop + 50, 200, 180),
    )
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
    expect(scroll.scrollTop).toBe(190)
  })

  it('returns false for a zero-height measurable width', () => {
    const scroll = mockScroll()
    expect(
      revealLaidOutSpread(
        scroll,
        mockSlot(() => rect(0, 0, 20, 0)),
      ),
    ).toBe(false)
  })

  it('applies horizontal clamp correction when still overflowing right', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    let calls = 0
    const slot = mockSlot(() => {
      calls += 1
      // getBoundingClientRect: size check, after first nudge, after second nudge,
      // after clamp correction, final contain check.
      if (calls <= 2) {
        return rect(PORT.left + 320, PORT.top + 10, 200, 180)
      }
      if (calls === 3) {
        return rect(PORT.left + 40, PORT.top + 10, 200, 180)
      }
      return rect(PORT.left + 10, PORT.top + 10, 200, 180)
    })
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
    expect(scroll.scrollLeft).toBeGreaterThan(40)
  })

  it('applies left overflow correction after the second nudge', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 80 })
    let calls = 0
    const slot = mockSlot(() => {
      calls += 1
      if (calls <= 2) {
        return rect(PORT.left - 40, PORT.top + 10, 200, 180)
      }
      if (calls === 3) {
        return rect(PORT.left - 20, PORT.top + 10, 200, 180)
      }
      return rect(PORT.left + 10, PORT.top + 10, 200, 180)
    })
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
  })

  it('applies top overflow correction after the second nudge', () => {
    const scroll = mockScroll({ scrollTop: 80, scrollLeft: 40 })
    let calls = 0
    const slot = mockSlot(() => {
      calls += 1
      if (calls <= 2) {
        return rect(PORT.left + 10, PORT.top - 40, 200, 180)
      }
      if (calls === 3) {
        return rect(PORT.left + 10, PORT.top - 20, 200, 180)
      }
      return rect(PORT.left + 10, PORT.top + 10, 200, 180)
    })
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
  })
})
