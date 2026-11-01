import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  buildStridePrefix,
  filmstripWindowRange,
  indexFromScrollOffset,
  itemOriginOffsets,
  scrollportIndexRange,
  spacerWidthPx,
  THUMB_HEIGHT,
  THUMB_WIDTH_DEFAULT,
  THUMB_WIDTH_MAX,
  THUMB_WIDTH_MIN,
  thumbSlotSize,
  thumbStride,
  thumbSlotAspect,
  windowCountForCover,
} from './thumbSlotSize'

describe('thumbSlotAspect', () => {
  it('clamps to the slot width bounds and defaults bad input to square', () => {
    expect(thumbSlotAspect(1.5)).toBe(1.5)
    expect(thumbSlotAspect(0.1)).toBe(THUMB_WIDTH_MIN / THUMB_HEIGHT)
    expect(thumbSlotAspect(10)).toBe(THUMB_WIDTH_MAX / THUMB_HEIGHT)
    expect(thumbSlotAspect(Number.NaN)).toBe(1)
  })
})

describe('thumbSlotSize', () => {
  it('keeps fixed height', () => {
    expect(thumbSlotSize(1.5).height).toBe(THUMB_HEIGHT)
    expect(thumbSlotSize(0.5).height).toBe(THUMB_HEIGHT)
  })

  it('makes portrait narrower than landscape', () => {
    expect(thumbSlotSize(0.5).width).toBeLessThan(thumbSlotSize(1.5).width)
  })

  it('sizes square to the thumb height', () => {
    expect(thumbSlotSize(1)).toEqual({
      width: THUMB_HEIGHT,
      height: THUMB_HEIGHT,
    })
  })

  it('clamps extreme aspects', () => {
    expect(thumbSlotSize(0.01).width).toBe(THUMB_WIDTH_MIN)
    expect(thumbSlotSize(100).width).toBe(THUMB_WIDTH_MAX)
  })

  it('treats non-finite or non-positive aspect as 1', () => {
    expect(thumbSlotSize(0).width).toBe(THUMB_HEIGHT)
    expect(thumbSlotSize(-2).width).toBe(THUMB_HEIGHT)
    expect(thumbSlotSize(Number.NaN).width).toBe(THUMB_HEIGHT)
  })
})

describe('filmstrip stride prefix', () => {
  it('builds cumulative strides', () => {
    const prefix = buildStridePrefix([1.5, 0.5])
    expect(prefix[0]).toBe(0)
    expect(prefix[1]).toBe(thumbStride(1.5))
    expect(prefix[2]).toBe(thumbStride(1.5) + thumbStride(0.5))
  })

  it('packs origins from each card end, not a fixed max-width stride', () => {
    // Landscape then two portraits — regresses Virtualizer estimatedRowSize=144 packing.
    const aspects = [1.5, 0.5, 0.5]
    const origins = itemOriginOffsets(aspects)
    const maxStride = THUMB_WIDTH_DEFAULT + 8
    expect(origins[0]).toBe(0)
    expect(origins[1]).toBe(thumbStride(1.5))
    expect(origins[2]).toBe(thumbStride(1.5) + thumbStride(0.5))
    // Fixed max-width stride would place the second portrait too far right.
    expect(origins[2]).toBeLessThan(2 * maxStride)
    expect(origins[2]).not.toBe(2 * maxStride)
  })

  it('maps scroll offset to an index with overscan', () => {
    const prefix = buildStridePrefix([1.5, 1.5, 1.5, 1.5, 1.5, 1.5])
    const atThird = prefix[3] ?? 0
    expect(indexFromScrollOffset(atThird, prefix, 0)).toBe(3)
    expect(indexFromScrollOffset(atThird, prefix, 2)).toBe(1)
  })

  it('reserves spacer width for expected import slots', () => {
    const known = [1.5, 0.5]
    expect(spacerWidthPx(known, 5, 1)).toBe(
      thumbStride(1.5) + thumbStride(0.5) + 3 * thumbStride(1),
    )
  })

  it('returns zero spacer width when the gallery is empty', () => {
    expect(spacerWidthPx([], 0)).toBe(0)
  })

  it('needs more portrait items than landscape to cover the same viewport', () => {
    // Fixed WINDOW_SIZE=16 left a hole: 16×portrait ≈ 896px < typical scrollport.
    const coverPx = 1200
    const portraits = Array.from({ length: 40 }, () => 0.5)
    const landscapes = Array.from({ length: 40 }, () => 1.5)
    const portCount = windowCountForCover(
      buildStridePrefix(portraits),
      0,
      coverPx,
    )
    const landCount = windowCountForCover(
      buildStridePrefix(landscapes),
      0,
      coverPx,
    )
    expect(portCount).toBeGreaterThan(16)
    expect(portCount).toBeGreaterThan(landCount)
    const portPrefix = buildStridePrefix(portraits)
    expect(
      (portPrefix[portCount] ?? 0) - (portPrefix[0] ?? 0),
    ).toBeGreaterThanOrEqual(coverPx)
  })

  it('covers the viewport after a scrolled start index', () => {
    const aspects = Array.from({ length: 50 }, () => 0.5)
    const prefix = buildStridePrefix(aspects)
    const start = 10
    const coverPx = 800
    const count = windowCountForCover(prefix, start, coverPx)
    expect(count).toBeGreaterThan(0)
    expect(
      (prefix[start + count] ?? 0) - (prefix[start] ?? 0),
    ).toBeGreaterThanOrEqual(coverPx)
  })
})

test.prop([fc.double({ min: 0.01, max: 20, noNaN: true })], {
  numRuns: Number(process.env.FC_NUM_RUNS ?? 100),
})('slot width stays within clamp for finite positive aspects', (aspect) => {
  const { width, height } = thumbSlotSize(aspect)
  expect(height).toBe(THUMB_HEIGHT)
  expect(width).toBeGreaterThanOrEqual(THUMB_WIDTH_MIN)
  expect(width).toBeLessThanOrEqual(THUMB_WIDTH_MAX)
})

describe('filmstrip window ranges', () => {
  // Square slots at THUMB_HEIGHT: stride 104 px.
  const prefix = buildStridePrefix(Array.from({ length: 40 }, () => 1))

  it('scrollport range covers the items intersecting the view', () => {
    expect(scrollportIndexRange(prefix, 0, 400)).toEqual({ start: 0, end: 4 })
    expect(scrollportIndexRange(prefix, 520, 416)).toEqual({
      start: 5,
      end: 9,
    })
    expect(scrollportIndexRange([0], 0, 400)).toEqual({ start: 0, end: 0 })
  })

  it('forward: one scrollport ahead to the right, 2 slots behind', () => {
    // View [10, 14); ahead reaches 1040 + 416 + 416 = 1872 → item 18.
    expect(filmstripWindowRange(prefix, 1040, 416, 1, 416)).toEqual({
      start: 8,
      end: 19,
    })
  })

  it('backward: one scrollport ahead to the left, 2 slots behind', () => {
    // Ahead reaches 1040 - 416 = 624 → item 6.
    expect(filmstripWindowRange(prefix, 1040, 416, -1, 416)).toEqual({
      start: 6,
      end: 16,
    })
  })

  it('clamps to the gallery at both ends', () => {
    expect(filmstripWindowRange(prefix, 0, 416, -1, 416)).toEqual({
      start: 0,
      end: 6,
    })
    const atEnd = (prefix[40] ?? 0) - 416
    expect(filmstripWindowRange(prefix, atEnd, 416, 1, 416)).toEqual({
      start: 34,
      end: 40,
    })
    expect(filmstripWindowRange([0], 0, 416, 1, 416)).toEqual({
      start: 0,
      end: 0,
    })
  })
})

test.prop(
  [
    fc.array(fc.double({ min: 0.2, max: 4, noNaN: true }), {
      minLength: 1,
      maxLength: 60,
    }),
    fc.nat({ max: 8000 }),
    fc.integer({ min: 1, max: 2000 }),
    fc.constantFrom<1 | -1>(1, -1),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
)(
  'window holds the scrollport, ahead cover and 2 slots behind',
  (aspects, scrollLeft, viewportWidth, direction) => {
    const prefix = buildStridePrefix(aspects)
    const count = aspects.length
    const view = scrollportIndexRange(prefix, scrollLeft, viewportWidth)
    const range = filmstripWindowRange(
      prefix,
      scrollLeft,
      viewportWidth,
      direction,
      viewportWidth,
    )
    expect(range.start).toBeGreaterThanOrEqual(0)
    expect(range.end).toBeLessThanOrEqual(count)
    expect(range.start).toBeLessThanOrEqual(view.start)
    expect(range.end).toBeGreaterThanOrEqual(view.end)
    const behind =
      direction === 1 ? view.start - range.start : range.end - view.end
    const behindRoom = direction === 1 ? view.start : count - view.end
    expect(behind).toBe(Math.min(2, behindRoom))
    // Ahead edge reaches one scrollport past the view (or the gallery edge).
    const aheadOk =
      direction === 1
        ? range.end === count ||
          (prefix[range.end] ?? 0) > scrollLeft + 2 * viewportWidth
        : range.start === 0 ||
          (prefix[range.start] ?? 0) <= scrollLeft - viewportWidth
    expect(aheadOk).toBe(true)
  },
)
