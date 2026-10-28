import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  anchoredScrollOffset,
  buildStridePrefix,
  indexFromScrollOffset,
  itemOriginOffsets,
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

describe('anchoredScrollOffset', () => {
  const aspects = [1.5, 0.5, 1, 1.5, 2]
  const prev = buildStridePrefix(aspects, 96)
  const next = buildStridePrefix(aspects, 144)

  it('keeps the item under the left edge (and the fraction into it)', () => {
    const start = prev[2] ?? 0
    const stride = (prev[3] ?? 0) - start
    expect(anchoredScrollOffset(start, prev, next)).toBe(next[2])
    expect(anchoredScrollOffset(start + stride / 2, prev, next)).toBe(
      Math.round(((next[2] ?? 0) + (next[3] ?? 0)) / 2),
    )
  })

  it('lands on the item start when the previous stride is empty', () => {
    expect(anchoredScrollOffset(5, [0, 0, 0], [0, 100, 200])).toBe(100)
    expect(anchoredScrollOffset(0, [0, 0, 0], [0, 100, 200])).toBe(100)
  })

  it('stays at the origin and past the end stays on the last item', () => {
    expect(anchoredScrollOffset(0, prev, next)).toBe(0)
    expect(anchoredScrollOffset(1e6, prev, next)).toBe(next[5])
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
