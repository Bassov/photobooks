import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import {
  PASTEBOARD_GAP_PX,
  PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
  pacePasteboardWindow,
  pasteboardStridePx,
  pasteboardWindow,
  pasteboardWindowsEqual,
  pickActiveSpread,
} from './pasteboardWindow'

describe('pasteboardStridePx', () => {
  it('adds the gap under a painted spread', () => {
    expect(pasteboardStridePx(150)).toBe(150 + PASTEBOARD_GAP_PX)
  })

  it('returns the gap when the spread height is not usable', () => {
    expect(pasteboardStridePx(Number.NaN)).toBe(PASTEBOARD_GAP_PX)
    expect(pasteboardStridePx(-1)).toBe(PASTEBOARD_GAP_PX)
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

  it('treats windows equal only when start, end, and extents match', () => {
    const base = { start: 1, end: 4, leadPx: 100, tailPx: 200 }
    expect(pasteboardWindowsEqual(base, { ...base })).toBe(true)
    expect(pasteboardWindowsEqual(base, { ...base, start: 0 })).toBe(false)
    expect(pasteboardWindowsEqual(base, { ...base, end: 5 })).toBe(false)
    expect(pasteboardWindowsEqual(base, { ...base, leadPx: 0 })).toBe(false)
    expect(pasteboardWindowsEqual(base, { ...base, tailPx: 0 })).toBe(false)
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
