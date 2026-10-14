import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import {
  PASTEBOARD_GAP_PX,
  pasteboardStridePx,
  pasteboardWindow,
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
