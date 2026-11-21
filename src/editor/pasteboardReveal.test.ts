import { describe, expect, it } from 'vitest'
import {
  actionAfterPaintConfirm,
  insetAxisDelta,
  isScrollNearMax,
  nudgeBoxIntoInsetPort,
  nudgeBoxIntoPort,
  planRevealAttempt,
  REVEAL_TRY_CEILING,
  restoreRevealSlotVisibility,
  revealLaidOutSpread,
  revealTryBudget,
  spreadBoxContained,
  spreadBoxRevealed,
  turnPendingReveal,
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

describe('actionAfterPaintConfirm', () => {
  it('completes when contained after paint', () => {
    expect(
      actionAfterPaintConfirm({
        containedAfterPaint: true,
        tries: 2,
        atMaxScroll: false,
      }),
    ).toBe('complete')
  })

  it('retries or exhausts when still overflowing', () => {
    expect(
      actionAfterPaintConfirm({
        containedAfterPaint: false,
        tries: 1,
        atMaxScroll: false,
      }),
    ).toBe('retry')
    expect(
      actionAfterPaintConfirm({
        containedAfterPaint: false,
        tries: REVEAL_TRY_CEILING * 2,
        atMaxScroll: true,
      }),
    ).toBe('exhaust')
  })

  it('retries at the single ceiling when not at max scroll after paint', () => {
    // Locks revealed:true in planRevealAttempt — flipping to false would exhaust
    // at tries=64 with atMaxScroll=false (budget 64) instead of retry (*2).
    expect(
      actionAfterPaintConfirm({
        containedAfterPaint: false,
        tries: REVEAL_TRY_CEILING,
        atMaxScroll: false,
      }),
    ).toBe('retry')
  })
})

describe('turnPendingReveal', () => {
  it('awaits a missing slot at the requested index', () => {
    const result = turnPendingReveal({
      slot: null,
      scroll: mockScroll(),
      spreadCount: 10,
      stride: 100,
      state: { tries: 0, paintConfirmed: false },
      index: 3,
    })
    expect(result.turn).toEqual({ kind: 'await-slot', top: 300 })
    const first = turnPendingReveal({
      slot: null,
      scroll: mockScroll(),
      spreadCount: 10,
      stride: 100,
      state: { tries: 0, paintConfirmed: false },
      index: 0,
    })
    expect(first.turn).toEqual({ kind: 'await-slot', top: 0 })
  })

  it('awaits a missing slot at the stack end', () => {
    const scroll = mockScroll()
    const result = turnPendingReveal({
      slot: null,
      scroll,
      spreadCount: 4,
      stride: 100,
      state: { tries: 0, paintConfirmed: false },
    })
    expect(result.turn).toEqual({ kind: 'await-slot', top: 300 })
  })

  it('retries then clears when layout never reveals', () => {
    // Fixed tall box below the port top never covers it; keep scrollHeight
    // huge so we stay off the max-scroll budget.
    const scroll = mockScroll({ scrollHeight: 100_000 })
    const slot = mockSlot(() => rect(PORT.left, PORT.top + 50, 200, 500))
    const first = turnPendingReveal({
      slot,
      scroll,
      spreadCount: 4,
      stride: 100,
      state: { tries: 0, paintConfirmed: false },
    })
    expect(first.turn.kind).toBe('retry')
    const last = turnPendingReveal({
      slot,
      scroll,
      spreadCount: 4,
      stride: 100,
      state: { tries: REVEAL_TRY_CEILING - 1, paintConfirmed: false },
    })
    expect(last.turn.kind).toBe('clear')
  })

  it('retries at tries=64 when the nudge reaches max scroll', () => {
    // Pre-reveal scroll is not at max; a far-below box clamps scroll to max.
    // Budget must use the post-nudge position (128), not the stale pre-reveal false.
    const scroll = mockScroll({
      scrollTop: 0,
      scrollHeight: PORT.height + 1600,
    })
    const slot = mockSlot(() => rect(PORT.left, PORT.top + 2000, 200, 180))
    expect(
      isScrollNearMax(scroll.scrollTop, scroll.scrollHeight, PORT.height),
    ).toBe(false)
    const result = turnPendingReveal({
      slot,
      scroll,
      spreadCount: 4,
      stride: 100,
      state: { tries: REVEAL_TRY_CEILING - 1, paintConfirmed: false },
    })
    expect(
      isScrollNearMax(scroll.scrollTop, scroll.scrollHeight, PORT.height),
    ).toBe(true)
    expect(result.state.tries).toBe(REVEAL_TRY_CEILING)
    expect(result.turn.kind).toBe('retry')
  })

  it('schedules paint confirm after a successful layout nudge', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    const slot = mockSlot(() => rect(PORT.left + 10, PORT.top + 10, 200, 180))
    const result = turnPendingReveal({
      slot,
      scroll,
      spreadCount: 4,
      stride: 100,
      state: { tries: 0, paintConfirmed: false },
    })
    expect(result.turn.kind).toBe('paint-confirm')
    expect(result.state.paintConfirmed).toBe(true)
  })

  it('completes after paint when still contained', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    const slot = mockSlot(() => rect(PORT.left + 10, PORT.top + 10, 200, 180))
    const result = turnPendingReveal({
      slot,
      scroll,
      spreadCount: 4,
      stride: 100,
      state: { tries: 0, paintConfirmed: true },
    })
    expect(result.turn).toEqual({
      kind: 'post-paint',
      action: 'complete',
    })
  })

  it('retries after paint when the box overflows', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    const slot = mockSlot(() => rect(PORT.left, PORT.top + 250, 200, 180))
    const result = turnPendingReveal({
      slot,
      scroll,
      spreadCount: 4,
      stride: 100,
      state: { tries: 1, paintConfirmed: true },
    })
    expect(result.turn).toEqual({ kind: 'post-paint', action: 'retry' })
    expect(result.state.paintConfirmed).toBe(false)
    expect(result.state.tries).toBe(2)
  })

  it('exhausts after paint when tries hit the double ceiling', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    const slot = mockSlot(() => rect(PORT.left, PORT.top + 250, 200, 180))
    const result = turnPendingReveal({
      slot,
      scroll,
      spreadCount: 4,
      stride: 100,
      state: { tries: REVEAL_TRY_CEILING * 2 - 1, paintConfirmed: true },
    })
    expect(result.turn).toEqual({ kind: 'post-paint', action: 'exhaust' })
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
    // Reject just past the +1px band on each edge.
    expect(
      spreadBoxContained(
        port,
        rect(PORT.left, PORT.top, PORT.width + 2, PORT.height),
      ),
    ).toBe(false)
    expect(
      spreadBoxContained(port, rect(PORT.left, PORT.top - 2, 200, 180)),
    ).toBe(false)
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

describe('insetAxisDelta / nudgeBoxIntoInsetPort (M145)', () => {
  // Designer par.json prod.reveal: port x 212–1140, frame x 133.7–556.3.
  it('moves a fitting frame under the spread list to the 24 px inset line', () => {
    expect(insetAxisDelta(133.7, 556.3, 212, 1140, 24)).toBeCloseTo(-102.3, 5)
    expect(133.7 - insetAxisDelta(133.7, 556.3, 212, 1140, 24)).toBeCloseTo(
      236,
      5,
    )
  })

  it('moves a fitting frame past the far edge back to the inset line', () => {
    expect(insetAxisDelta(900, 1130, 212, 1140, 24)).toBeCloseTo(14, 5)
  })

  it('leaves a fitting frame already inside the inset band', () => {
    expect(insetAxisDelta(236, 1116, 212, 1140, 24)).toBe(0)
  })

  it('centres a frame larger than the inset port: overflow split equally', () => {
    // 2×: frame 1007 tall, port 720 (48–768), top cut 371 → bottom 84 above.
    const top = 48 - 371
    const delta = insetAxisDelta(top, top + 1007, 48, 768, 24)
    const after = { top: top - delta, bottom: top + 1007 - delta }
    expect(Math.abs(48 - after.top - (after.bottom - 768))).toBeLessThanOrEqual(
      1,
    )
  })

  it('centres a frame that fits the port but not its inset band', () => {
    expect(insetAxisDelta(100, 980, 100, 1000, 24)).toBe(-10)
  })

  it('treats a box exactly the inset band wide as fitting (same as centred)', () => {
    expect(insetAxisDelta(0, 80, 0, 100, 10)).toBe(-10)
    expect(insetAxisDelta(20, 100, 0, 100, 10)).toBe(10)
  })

  it('scrolls each axis by its own rule, then leaves an inset box alone', () => {
    const scroll = mockScroll({
      scrollTop: 600,
      scrollLeft: 300,
      scrollWidth: 4000,
    })
    // Fits horizontally (left of the port); taller than the port vertically.
    nudgeBoxIntoInsetPort(
      scroll,
      rect(PORT.left - 50, PORT.top - 300, 200, 600),
      24,
    )
    expect(scroll.scrollLeft).toBe(300 - 74)
    expect(scroll.scrollTop).toBe(600 - 200)

    nudgeBoxIntoInsetPort(
      scroll,
      rect(PORT.left + 24, PORT.top + 24, 200, 200),
      24,
    )
    expect(scroll.scrollLeft).toBe(226)
    expect(scroll.scrollTop).toBe(400)

    // Right / bottom edges past the far inset line.
    nudgeBoxIntoInsetPort(
      scroll,
      rect(PORT.left + 400, PORT.top + 300, 100, 100),
      24,
    )
    expect(scroll.scrollLeft).toBe(226 + 24)
    expect(scroll.scrollTop).toBe(400 + 24)
  })
})

describe('spreadBoxRevealed', () => {
  const port = rect(PORT.left, PORT.top, PORT.width, PORT.height)

  it('wants a fitting box inside and a larger box covering the port', () => {
    expect(spreadBoxRevealed(port, rect(PORT.left, PORT.top, 200, 180))).toBe(
      true,
    )
    expect(
      spreadBoxRevealed(port, rect(PORT.left - 20, PORT.top, 200, 180)),
    ).toBe(false)
    expect(
      spreadBoxRevealed(port, rect(PORT.left - 20, PORT.top - 10, 600, 500)),
    ).toBe(true)
    expect(
      spreadBoxRevealed(port, rect(PORT.left + 20, PORT.top, 600, 180)),
    ).toBe(false)
    expect(
      spreadBoxRevealed(port, rect(PORT.left, PORT.top + 20, 200, 500)),
    ).toBe(false)
    expect(spreadBoxRevealed(port, rect(PORT.left, PORT.top, 0, 180))).toBe(
      false,
    )
    expect(spreadBoxRevealed(port, rect(PORT.left, PORT.top, 200, 0))).toBe(
      false,
    )
  })

  // PORT x 40–540 (500 wide), y 100–500 (400 tall); 1 px tolerance.
  it.each([
    ['fitting box on the left tolerance', rect(39, 100, 200, 180), true],
    ['fitting box past the left tolerance', rect(38.5, 100, 200, 180), false],
    ['fitting box on the right tolerance', rect(341, 100, 200, 180), true],
    ['fitting box past the right tolerance', rect(341.5, 100, 200, 180), false],
    ['fitting box on the top tolerance', rect(40, 99, 200, 180), true],
    ['fitting box on the bottom tolerance', rect(40, 321, 200, 180), true],
    ['501 wide still fits: must lie inside', rect(41, 100, 501, 180), false],
    ['501 wide inside the tolerance', rect(39.5, 100, 501, 180), true],
    ['wider box left edge on the tolerance', rect(41, 100, 600, 180), true],
    ['wider box left edge past it', rect(41.5, 100, 600, 180), false],
    ['wider box right edge on the tolerance', rect(-61, 100, 600, 180), true],
    ['wider box right edge short of it', rect(-61.5, 100, 600, 180), false],
    ['taller box top edge on the tolerance', rect(40, 101, 200, 500), true],
    ['taller box bottom edge on the tolerance', rect(40, -1, 200, 500), true],
    ['taller box bottom edge short of it', rect(40, -1.5, 200, 500), false],
  ])('%s', (_, box, revealed) => {
    expect(spreadBoxRevealed(port, box)).toBe(revealed)
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

  it('returns false when a spread taller than the port leaves part of it bare', () => {
    const scroll = mockScroll()
    expect(
      revealLaidOutSpread(
        scroll,
        mockSlot(() => rect(PORT.left, PORT.top + 50, 200, 500)),
      ),
    ).toBe(false)
  })

  it('returns true once a spread taller than the port covers it (no flip-flop)', () => {
    const scroll = mockScroll({ scrollTop: 50 })
    expect(
      revealLaidOutSpread(
        scroll,
        mockSlot(() => rect(PORT.left, PORT.top - 20, 200, 500)),
      ),
    ).toBe(true)
    // One edge nudge (top aligned), no second nudge to the far edge.
    expect(scroll.scrollTop).toBe(30)
  })

  /** Reads 1–3: box, after, afterSecond; later reads: `rest`. */
  function sequenceSlot(boxes: readonly DOMRect[], rest: DOMRect) {
    let read = 0
    return mockSlot(() => {
      read += 1
      return boxes[read - 1] ?? rest
    })
  }

  it('nudges a third time when the second nudge did not reveal', () => {
    const scroll = mockScroll({ scrollTop: 50 })
    const below = rect(PORT.left, PORT.top + 500, 200, 180)
    revealLaidOutSpread(
      scroll,
      sequenceSlot([below, below, below], rect(PORT.left, 200, 200, 180)),
    )
    // Each centring nudge adds 500 - (400 - 180) / 2 = 390.
    expect(scroll.scrollTop).toBe(50 + 3 * 390)
  })

  it('skips the third nudge once the second one revealed the spread', () => {
    const scroll = mockScroll({ scrollTop: 50 })
    const below = rect(PORT.left, PORT.top + 500, 200, 180)
    // A taller box covering the port: revealed, yet a nudge would move it.
    const covering = rect(PORT.left, PORT.top - 20, 200, 500)
    revealLaidOutSpread(
      scroll,
      sequenceSlot([below, below, covering], covering),
    )
    expect(scroll.scrollTop).toBe(50 + 2 * 390)
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

  it('accepts an exactly 1×1 laid-out box inside the port', () => {
    const scroll = mockScroll({ scrollTop: 50 })
    expect(
      revealLaidOutSpread(
        scroll,
        mockSlot(() => rect(PORT.left + 10, PORT.top + 10, 1, 1)),
      ),
    ).toBe(true)
  })

  it('third-nudge path recenters when the second pass still overflows', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    let calls = 0
    const slot = mockSlot(() => {
      calls += 1
      if (calls <= 2) {
        return rect(PORT.left + 320, PORT.top + 10, 200, 180)
      }
      if (calls <= 4) {
        return rect(PORT.left + 120, PORT.top + 10, 200, 180)
      }
      return rect(PORT.left + 10, PORT.top + 10, 200, 180)
    })
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
    expect(scroll.scrollLeft).toBeGreaterThan(40)
  })

  it('secondary-nudges horizontal when height does not fit yet but width does', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    let calls = 0
    const slot = mockSlot(() => {
      calls += 1
      // Size + after 1st nudge: tall (heightFits false) and shifted right.
      // Old AND gate skipped secondary; contain stayed false after settle.
      if (calls <= 2) {
        return rect(PORT.left + 200, PORT.top - 20, 200, PORT.height + 50)
      }
      if (calls <= 4) {
        return rect(PORT.left + 200, PORT.top + 10, 200, 180)
      }
      return rect(PORT.left + 10, PORT.top + 10, 200, 180)
    })
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
  })

  it('secondary-nudges when width does not fit yet but height does', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    let calls = 0
    const slot = mockSlot(() => {
      calls += 1
      // Size + after 1st nudge: widthFits false (wide) and shifted right so
      // horizontal correction is needed; after settle width fits but still
      // shifted until secondary moves scrollLeft (mirrors the tall twin).
      if (calls <= 2) {
        return rect(PORT.left + 200, PORT.top + 10, PORT.width + 40, 180)
      }
      if (calls <= 5) {
        return rect(PORT.left + 200, PORT.top + 10, 200, 180)
      }
      return rect(PORT.left + 10, PORT.top + 10, 200, 180)
    })
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
    expect(scroll.scrollLeft).toBeGreaterThan(40)
  })

  it('skips secondary nudge when neither axis fits the port', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    let rectReads = 0
    const slot = mockSlot(() => {
      rectReads += 1
      return rect(
        PORT.left + 20,
        PORT.top + 20,
        PORT.width + 80,
        PORT.height + 80,
      )
    })
    expect(revealLaidOutSpread(scroll, slot)).toBe(false)
    // size + after first nudge + final contain check (no secondary/third nudge).
    expect(rectReads).toBe(3)
  })

  it('nudges a third time when the second pass still overflows', () => {
    const scroll = mockScroll({ scrollTop: 50, scrollLeft: 40 })
    let calls = 0
    const slot = mockSlot(() => {
      calls += 1
      // size → after 1st nudge → after 2nd → after 3rd → final contain
      if (calls <= 2) {
        return rect(PORT.left + 320, PORT.top + 10, 200, 180)
      }
      if (calls === 3) {
        return rect(PORT.left + 80, PORT.top + 10, 200, 180)
      }
      return rect(PORT.left + 10, PORT.top + 10, 200, 180)
    })
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
    expect(scroll.scrollLeft).toBeGreaterThan(40)
  })

  it('falls back to the slot when spread-view is missing', () => {
    const scroll = mockScroll({ scrollTop: 50 })
    const slot = document.createElement('div')
    slot.getBoundingClientRect = () =>
      rect(PORT.left + 10, PORT.top + 10, 200, 180)
    expect(revealLaidOutSpread(scroll, slot)).toBe(true)
  })
})

describe('restoreRevealSlotVisibility', () => {
  it('clears forced content-visibility on a slot', () => {
    const slot = document.createElement('div')
    slot.style.contentVisibility = 'visible'
    restoreRevealSlotVisibility(slot)
    expect(slot.style.contentVisibility).toBe('')
  })

  it('ignores a null slot', () => {
    expect(() => {
      restoreRevealSlotVisibility(null)
    }).not.toThrow()
  })
})
