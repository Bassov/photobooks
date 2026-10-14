import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
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
} from './thumbSlotSize'

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
})

test.prop([fc.double({ min: 0.01, max: 20, noNaN: true })], {
  numRuns: Number(process.env.FC_NUM_RUNS ?? 100),
})('slot width stays within clamp for finite positive aspects', (aspect) => {
  const { width, height } = thumbSlotSize(aspect)
  expect(height).toBe(THUMB_HEIGHT)
  expect(width).toBeGreaterThanOrEqual(THUMB_WIDTH_MIN)
  expect(width).toBeLessThanOrEqual(THUMB_WIDTH_MAX)
})
