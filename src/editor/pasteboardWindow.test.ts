import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import {
  PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
  STACK_GAP_RATIO,
  STACK_MIN_SPREAD_PX,
  applyForceMountIndex,
  clearForceMountIndex,
  pacePasteboardWindow,
  pasteboardGapPx,
  pasteboardOverscanPx,
  pasteboardStridePx,
  pasteboardWindow,
  pasteboardWindowsEqual,
  pickActiveSpread,
} from './pasteboardWindow'

describe('pasteboard stack gap', () => {
  it('is the kit 44 px under the 588 px #/demo Fit spread', () => {
    expect(pasteboardGapPx(588)).toBeCloseTo(44, 9)
    expect(pasteboardStridePx(588)).toBeCloseTo(632, 9)
  })

  it('scales with the spread: half the spread, half the gap', () => {
    expect(pasteboardGapPx(294)).toBeCloseTo(22, 9)
    expect(pasteboardStridePx(1176)).toBeCloseTo(1264, 9)
    expect(pasteboardStridePx(STACK_MIN_SPREAD_PX)).toBeCloseTo(
      16 + (16 * 44) / 588,
      9,
    )
  })

  test.prop([fc.double({ min: 1, max: 20_000, noNaN: true })])(
    'gap / spread is the same ratio at every spread height',
    (height) => {
      expect(pasteboardGapPx(height) / height).toBeCloseTo(STACK_GAP_RATIO, 12)
      expect(pasteboardStridePx(height)).toBeCloseTo(
        height + pasteboardGapPx(height),
        9,
      )
    },
  )

  it('has no gap and no stride without a usable spread height', () => {
    for (const height of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0]) {
      expect(pasteboardGapPx(height)).toBe(0)
      expect(pasteboardStridePx(height)).toBe(0)
    }
  })
})

describe('pasteboardOverscanPx', () => {
  it('overscans one stride above the zoom-out floor', () => {
    expect(pasteboardOverscanPx(40, 588)).toBeCloseTo(632, 9)
    expect(pasteboardOverscanPx(40, STACK_MIN_SPREAD_PX + 0.6)).toBe(
      pasteboardStridePx(STACK_MIN_SPREAD_PX + 0.6),
    )
  })

  it('covers the whole stack at the floor (whole-book overview)', () => {
    expect(pasteboardOverscanPx(40, STACK_MIN_SPREAD_PX)).toBe(
      40 * pasteboardStridePx(STACK_MIN_SPREAD_PX),
    )
    expect(pasteboardOverscanPx(40, STACK_MIN_SPREAD_PX + 0.5)).toBe(
      40 * pasteboardStridePx(STACK_MIN_SPREAD_PX + 0.5),
    )
    expect(pasteboardOverscanPx(3, 4)).toBe(3 * pasteboardStridePx(4))
    expect(pasteboardOverscanPx(-2, 4)).toBe(0)
  })

  it('is empty for an unusable spread height', () => {
    expect(pasteboardOverscanPx(40, 0)).toBe(0)
    expect(pasteboardOverscanPx(40, -5)).toBe(0)
    expect(pasteboardOverscanPx(40, Number.NaN)).toBe(0)
  })

  it('lets the window mount every spread at the floor', () => {
    const stride = pasteboardStridePx(STACK_MIN_SPREAD_PX)
    const window = pasteboardWindow({
      count: 40,
      stridePx: stride,
      scrollTop: 20 * stride,
      viewportPx: 700,
      overscanPx: pasteboardOverscanPx(40, STACK_MIN_SPREAD_PX),
    })
    expect(window).toEqual({ start: 0, end: 40, leadPx: 0, tailPx: 0 })
  })
})

describe('pasteboardWindow', () => {
  it('mounts nothing for an empty book', () => {
    expect(
      pasteboardWindow({
        count: 0,
        stridePx: 174,
        scrollTop: 0,
        viewportPx: 800,
        overscanPx: 174,
      }),
    ).toEqual({ start: 0, end: 0, leadPx: 0, tailPx: 0 })
  })

  it('mounts nothing when count or stride is non-finite or non-positive', () => {
    const empty = { start: 0, end: 0, leadPx: 0, tailPx: 0 }
    expect(
      pasteboardWindow({
        count: Number.NaN,
        stridePx: 174,
        scrollTop: 0,
        viewportPx: 800,
        overscanPx: 174,
      }),
    ).toEqual(empty)
    expect(
      pasteboardWindow({
        count: 10,
        stridePx: Number.NaN,
        scrollTop: 0,
        viewportPx: 800,
        overscanPx: 174,
      }),
    ).toEqual(empty)
    expect(
      pasteboardWindow({
        count: 10,
        stridePx: 0,
        scrollTop: 0,
        viewportPx: 800,
        overscanPx: 174,
      }),
    ).toEqual(empty)
    expect(
      pasteboardWindow({
        count: 10,
        stridePx: -5,
        scrollTop: 0,
        viewportPx: 800,
        overscanPx: 174,
      }),
    ).toEqual(empty)
  })

  it('mounts at least one spread when the viewport height is zero', () => {
    const window = pasteboardWindow({
      count: 40,
      stridePx: 174,
      scrollTop: 0,
      viewportPx: 0,
      overscanPx: 174,
    })

    expect(window.end - window.start).toBeGreaterThan(0)
    expect(window.end - window.start).toBeLessThan(40)
  })

  it('mounts exactly one spread for a zero-height viewport mid-stack', () => {
    const stride = 100
    const window = pasteboardWindow({
      count: 40,
      stridePx: stride,
      scrollTop: 15 * stride,
      viewportPx: 0,
      overscanPx: 0,
    })

    expect(window).toEqual({
      start: 15,
      end: 16,
      leadPx: 15 * stride,
      tailPx: 24 * stride,
    })
  })

  it('covers a tall viewport from the top of a 40-spread stack', () => {
    const stride = 174
    const window = pasteboardWindow({
      count: 40,
      stridePx: stride,
      scrollTop: 0,
      viewportPx: 800,
      overscanPx: stride,
    })

    expect(window.start).toBe(0)
    expect(window.end * stride).toBeGreaterThanOrEqual(800 + stride)
    expect(window.end).toBeLessThan(40)
    expect(window.leadPx).toBe(0)
    expect(
      window.leadPx + (window.end - window.start) * stride + window.tailPx,
    ).toBe(40 * stride)
  })
})

test.prop(
  [
    fc.integer({ min: 1, max: 80 }),
    fc.integer({ min: 1, max: 400 }),
    fc.integer({ min: 0, max: 2000 }),
    fc.integer({ min: 0, max: 40_000 }),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
)(
  'partitions the stack and covers the viewport plus one stride',
  (count, stride, viewport, scrollTop) => {
    const overscan = stride
    const total = count * stride
    const window = pasteboardWindow({
      count,
      stridePx: stride,
      scrollTop,
      viewportPx: viewport,
      overscanPx: overscan,
    })
    const mounted = window.end - window.start
    const clampedScroll = Math.min(Math.max(scrollTop, 0), total)
    const from = Math.max(0, clampedScroll - overscan)
    const to = Math.min(total, clampedScroll + viewport + overscan)

    expect(window.start).toBeGreaterThanOrEqual(0)
    expect(window.end).toBeLessThanOrEqual(count)
    expect(mounted).toBeGreaterThan(0)
    expect(window.leadPx + mounted * stride + window.tailPx).toBe(total)
    expect(window.start * stride).toBeLessThanOrEqual(from)
    expect(window.end * stride).toBeGreaterThanOrEqual(to)
  },
)

describe('pacePasteboardWindow', () => {
  const stride = 100
  const count = 40

  it('returns an empty window when count or stride is unusable', () => {
    const current = { start: 0, end: 2, leadPx: 0, tailPx: 38 * stride }
    const target = { start: 0, end: 10, leadPx: 0, tailPx: 30 * stride }
    const cover = { start: 0, end: 4, leadPx: 0, tailPx: 36 * stride }
    const empty = { start: 0, end: 0, leadPx: 0, tailPx: 0 }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count: Number.NaN,
        stridePx: stride,
      }),
    ).toEqual(empty)
    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count: 0,
        stridePx: stride,
      }),
    ).toEqual(empty)
    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: Number.NaN,
      }),
    ).toEqual(empty)
    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: 0,
      }),
    ).toEqual(empty)
    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: -10,
      }),
    ).toEqual(empty)
  })

  it('treats a non-finite mount budget as zero new mounts', () => {
    const current = { start: 0, end: 2, leadPx: 0, tailPx: 38 * stride }
    const target = { start: 0, end: 20, leadPx: 0, tailPx: 20 * stride }
    const cover = { start: 0, end: 8, leadPx: 0, tailPx: 32 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: Number.NaN,
        count,
        stridePx: stride,
      }),
    ).toEqual(current)
  })

  it('clamps non-finite window edges before pacing', () => {
    const current = {
      start: Number.NaN,
      end: Number.POSITIVE_INFINITY,
      leadPx: 0,
      tailPx: 0,
    }
    const target = { start: 0, end: 6, leadPx: 0, tailPx: 34 * stride }
    const cover = { start: 0, end: 4, leadPx: 0, tailPx: 36 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 0,
      end: 1,
      leadPx: 0,
      tailPx: 39 * stride,
    })
  })

  it('prefers filling cover behind the painted start when both cover sides need mounts', () => {
    const current = {
      start: 5,
      end: 7,
      leadPx: 5 * stride,
      tailPx: 33 * stride,
    }
    const target = { start: 0, end: 12, leadPx: 0, tailPx: 28 * stride }
    const cover = { start: 2, end: 10, leadPx: 2 * stride, tailPx: 30 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 4,
      end: 7,
      leadPx: 4 * stride,
      tailPx: 33 * stride,
    })
  })

  it('fills cover after the painted end when that side needs more than before', () => {
    const current = {
      start: 5,
      end: 7,
      leadPx: 5 * stride,
      tailPx: 33 * stride,
    }
    const target = { start: 0, end: 12, leadPx: 0, tailPx: 28 * stride }
    const cover = { start: 4, end: 11, leadPx: 4 * stride, tailPx: 29 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 5,
      end: 8,
      leadPx: 5 * stride,
      tailPx: 32 * stride,
    })
  })

  it('leaves the painted window unchanged when the mount budget is zero', () => {
    const current = { start: 0, end: 2, leadPx: 0, tailPx: 38 * stride }
    const target = { start: 0, end: 20, leadPx: 0, tailPx: 20 * stride }
    const cover = { start: 0, end: 8, leadPx: 0, tailPx: 32 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 0,
        count,
        stridePx: stride,
      }),
    ).toEqual(current)
  })

  it('fills viewport cover before overscan within the mount budget', () => {
    const current = { start: 0, end: 2, leadPx: 0, tailPx: 38 * stride }
    const target = { start: 0, end: 20, leadPx: 0, tailPx: 20 * stride }
    const cover = { start: 0, end: 8, leadPx: 0, tailPx: 32 * stride }

    const next = pacePasteboardWindow({
      current,
      target,
      viewportCover: cover,
      maxNewMounts: PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
      count,
      stridePx: stride,
    })

    expect(next.start).toBe(0)
    expect(next.end).toBe(2 + PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME)
    expect(next.end).toBeLessThanOrEqual(cover.end)
    expect(next.leadPx + (next.end - next.start) * stride + next.tailPx).toBe(
      count * stride,
    )
  })

  it('drops painted indices outside the target then grows within the budget', () => {
    const current = { start: 0, end: 30, leadPx: 0, tailPx: 10 * stride }
    const target = {
      start: 5,
      end: 10,
      leadPx: 5 * stride,
      tailPx: 30 * stride,
    }
    const cover = { start: 5, end: 10, leadPx: 5 * stride, tailPx: 30 * stride }

    // Overlap [5, 10) already covers the target — no growth needed.
    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual(target)
  })

  it('starts empty when the painted window does not overlap the target', () => {
    const current = { start: 0, end: 3, leadPx: 0, tailPx: 37 * stride }
    const target = {
      start: 10,
      end: 20,
      leadPx: 10 * stride,
      tailPx: 20 * stride,
    }
    const cover = {
      start: 10,
      end: 14,
      leadPx: 10 * stride,
      tailPx: 26 * stride,
    }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 10,
      end: 10 + PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
      leadPx: 10 * stride,
      tailPx: (count - (10 + PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME)) * stride,
    })
  })

  it('reaches the full target across multiple steps', () => {
    let current = { start: 0, end: 2, leadPx: 0, tailPx: 38 * stride }
    const target = { start: 0, end: 12, leadPx: 0, tailPx: 28 * stride }
    const cover = { start: 0, end: 2, leadPx: 0, tailPx: 38 * stride }

    for (let i = 0; i < 10; i += 1) {
      current = pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
        count,
        stridePx: stride,
      })
      if (current.start === target.start && current.end === target.end) {
        break
      }
    }

    expect(current).toEqual(target)
  })

  it('expands toward overscan before the start when that side needs more', () => {
    const current = {
      start: 4,
      end: 8,
      leadPx: 4 * stride,
      tailPx: 32 * stride,
    }
    const target = { start: 0, end: 8, leadPx: 0, tailPx: 32 * stride }
    const cover = { start: 4, end: 8, leadPx: 4 * stride, tailPx: 32 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 3,
      end: 8,
      leadPx: 3 * stride,
      tailPx: 32 * stride,
    })
  })

  it('expands toward overscan after the end when that side needs more', () => {
    const current = { start: 0, end: 4, leadPx: 0, tailPx: 36 * stride }
    const target = { start: 0, end: 10, leadPx: 0, tailPx: 30 * stride }
    const cover = { start: 0, end: 4, leadPx: 0, tailPx: 36 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 0,
      end: 5,
      leadPx: 0,
      tailPx: 35 * stride,
    })
  })

  it('fills cover on the after side only when before cover is already satisfied', () => {
    const current = {
      start: 4,
      end: 6,
      leadPx: 4 * stride,
      tailPx: 34 * stride,
    }
    const target = { start: 0, end: 12, leadPx: 0, tailPx: 28 * stride }
    const cover = { start: 4, end: 10, leadPx: 4 * stride, tailPx: 30 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 4,
      end: 7,
      leadPx: 4 * stride,
      tailPx: 33 * stride,
    })
  })

  it('fills cover on the before side only when after cover is already satisfied', () => {
    const current = {
      start: 6,
      end: 10,
      leadPx: 6 * stride,
      tailPx: 30 * stride,
    }
    const target = { start: 0, end: 12, leadPx: 0, tailPx: 28 * stride }
    const cover = { start: 2, end: 10, leadPx: 2 * stride, tailPx: 30 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 5,
      end: 10,
      leadPx: 5 * stride,
      tailPx: 30 * stride,
    })
  })

  it('grows toward target before when cover is already filled and before side is larger', () => {
    const current = {
      start: 8,
      end: 10,
      leadPx: 8 * stride,
      tailPx: 30 * stride,
    }
    const target = {
      start: 2,
      end: 12,
      leadPx: 2 * stride,
      tailPx: 28 * stride,
    }
    const cover = { start: 8, end: 10, leadPx: 8 * stride, tailPx: 30 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 7,
      end: 10,
      leadPx: 7 * stride,
      tailPx: 30 * stride,
    })
  })

  it('on a cover-side tie prefers expanding before the painted start', () => {
    const current = {
      start: 5,
      end: 7,
      leadPx: 5 * stride,
      tailPx: 33 * stride,
    }
    const target = { start: 0, end: 12, leadPx: 0, tailPx: 28 * stride }
    // coverBefore = 5-3 = 2, coverAfter = 9-7 = 2
    const cover = { start: 3, end: 9, leadPx: 3 * stride, tailPx: 31 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 4,
      end: 7,
      leadPx: 4 * stride,
      tailPx: 33 * stride,
    })
  })

  it('on a target-side tie prefers expanding before the painted start', () => {
    const current = {
      start: 5,
      end: 7,
      leadPx: 5 * stride,
      tailPx: 33 * stride,
    }
    // targetBefore = 5, targetAfter = 5; cover already filled
    const target = { start: 0, end: 12, leadPx: 0, tailPx: 28 * stride }
    const cover = { start: 5, end: 7, leadPx: 5 * stride, tailPx: 33 * stride }

    expect(
      pacePasteboardWindow({
        current,
        target,
        viewportCover: cover,
        maxNewMounts: 1,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 4,
      end: 7,
      leadPx: 4 * stride,
      tailPx: 33 * stride,
    })
  })

  it('treats windows equal only when start, end, and extents match', () => {
    const base = { start: 1, end: 4, leadPx: 100, tailPx: 200 }
    expect(pasteboardWindowsEqual(base, { ...base })).toBe(true)
    expect(pasteboardWindowsEqual(base, { ...base, start: 0 })).toBe(false)
    expect(pasteboardWindowsEqual(base, { ...base, end: 5 })).toBe(false)
    expect(pasteboardWindowsEqual(base, { ...base, leadPx: 0 })).toBe(false)
    expect(pasteboardWindowsEqual(base, { ...base, tailPx: 0 })).toBe(false)
  })
})

describe('applyForceMountIndex / clearForceMountIndex', () => {
  const stride = 100
  const count = 16
  const target = { start: 0, end: 16, leadPx: 0, tailPx: 0 }

  it('leaves the window unchanged when force is null or outside the target', () => {
    const next = { start: 0, end: 2, leadPx: 0, tailPx: 14 * stride }
    expect(
      applyForceMountIndex({
        next,
        forceIdx: null,
        target,
        count,
        stridePx: stride,
      }),
    ).toBe(next)
    expect(
      applyForceMountIndex({
        next,
        forceIdx: 16,
        target,
        count,
        stridePx: stride,
      }),
    ).toBe(next)
    expect(
      applyForceMountIndex({
        next,
        forceIdx: -1,
        target: { start: 2, end: 8, leadPx: 2 * stride, tailPx: 8 * stride },
        count,
        stridePx: stride,
      }),
    ).toEqual(next)
  })

  it('expands to include force index 0 and a later index with exact extents', () => {
    const next = { start: 2, end: 4, leadPx: 2 * stride, tailPx: 12 * stride }
    expect(
      applyForceMountIndex({
        next,
        forceIdx: 0,
        target,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 0,
      end: 4,
      leadPx: 0,
      tailPx: 12 * stride,
    })
    expect(
      applyForceMountIndex({
        next,
        forceIdx: 15,
        target,
        count,
        stridePx: stride,
      }),
    ).toEqual({
      start: 2,
      end: 16,
      leadPx: 2 * stride,
      tailPx: 0,
    })
  })

  it('clears force only after the forced index is inside the mounted window', () => {
    expect(
      clearForceMountIndex(15, { start: 0, end: 2, leadPx: 0, tailPx: 0 }),
    ).toBe(15)
    expect(
      clearForceMountIndex(15, { start: 0, end: 15, leadPx: 0, tailPx: 0 }),
    ).toBe(15)
    expect(
      clearForceMountIndex(15, { start: 0, end: 16, leadPx: 0, tailPx: 0 }),
    ).toBeNull()
    expect(
      clearForceMountIndex(0, { start: 0, end: 1, leadPx: 0, tailPx: 0 }),
    ).toBeNull()
    expect(
      clearForceMountIndex(null, { start: 0, end: 4, leadPx: 0, tailPx: 0 }),
    ).toBeNull()
  })
})

describe('pickActiveSpread', () => {
  it('keeps the earlier spread when ratios differ only by subpixels', () => {
    expect(
      pickActiveSpread([
        { id: 'spread-2', ratio: 1, index: 1 },
        { id: 'spread-1', ratio: 0.998, index: 0 },
        { id: 'spread-3', ratio: 0.79, index: 2 },
      ]),
    ).toBe('spread-1')
  })

  it('picks the spread that occupies more of the port', () => {
    expect(
      pickActiveSpread([
        { id: 'spread-1', ratio: 0.4, index: 0 },
        { id: 'spread-2', ratio: 1, index: 1 },
      ]),
    ).toBe('spread-2')
  })

  it('keeps the current spread while it is still tied for most visible', () => {
    const whole = [
      { id: 'spread-1', ratio: 1, index: 0 },
      { id: 'spread-2', ratio: 1, index: 1 },
      { id: 'spread-4', ratio: 0.985, index: 3 },
    ]
    expect(pickActiveSpread(whole, 'spread-4')).toBe('spread-4')
    expect(pickActiveSpread(whole, 'spread-2')).toBe('spread-2')
    // No current spread, or one not on screen: the earlier tie wins.
    expect(pickActiveSpread(whole)).toBe('spread-1')
    expect(pickActiveSpread(whole, 'spread-9')).toBe('spread-1')
  })

  it('still keeps the current spread exactly at the tie margin', () => {
    expect(
      pickActiveSpread(
        [
          { id: 'spread-1', ratio: 1, index: 0 },
          { id: 'spread-2', ratio: 1 - 0.02, index: 1 },
        ],
        'spread-2',
      ),
    ).toBe('spread-2')
  })

  it('hands the mark over once the current spread is clearly less visible', () => {
    expect(
      pickActiveSpread(
        [
          { id: 'spread-1', ratio: 1, index: 0 },
          { id: 'spread-2', ratio: 0.97, index: 1 },
        ],
        'spread-2',
      ),
    ).toBe('spread-1')
  })

  it('never keeps a current spread when nothing intersects', () => {
    expect(
      pickActiveSpread([{ id: 'spread-1', ratio: 0, index: 0 }], 'spread-1'),
    ).toBe(null)
  })

  it('returns null when nothing intersects', () => {
    expect(pickActiveSpread([{ id: 'spread-1', ratio: 0, index: 0 }])).toBe(
      null,
    )
  })

  it('returns a spread that only partly fills the port', () => {
    expect(pickActiveSpread([{ id: 'spread-1', ratio: 0.5, index: 0 }])).toBe(
      'spread-1',
    )
  })

  it('keeps the earlier spread when the ratio gap is exactly the tie threshold', () => {
    expect(
      pickActiveSpread([
        { id: 'later', ratio: 0, index: 1 },
        { id: 'earlier', ratio: 0.02, index: 0 },
      ]),
    ).toBe('earlier')
  })

  it('keeps the earlier spread when a later one is exactly the tie threshold more visible', () => {
    expect(
      pickActiveSpread([
        { id: 'earlier', ratio: 0.5, index: 0 },
        { id: 'later', ratio: 0.52, index: 1 },
      ]),
    ).toBe('earlier')
  })

  it('keeps the earlier spread when a later one is only slightly less visible', () => {
    expect(
      pickActiveSpread([
        { id: 'earlier', ratio: 1, index: 0 },
        { id: 'later', ratio: 0.99, index: 1 },
      ]),
    ).toBe('earlier')
  })

  it('keeps a clearly visible later spread ahead of a barely visible earlier one', () => {
    expect(
      pickActiveSpread([
        { id: 'later', ratio: 1, index: 1 },
        { id: 'earlier', ratio: 0.4, index: 0 },
      ]),
    ).toBe('later')
  })

  it('keeps the first entry when two observations share an index', () => {
    expect(
      pickActiveSpread([
        { id: 'first', ratio: 1, index: 0 },
        { id: 'second', ratio: 1, index: 0 },
      ]),
    ).toBe('first')
  })
})
