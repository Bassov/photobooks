import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  getPageCuts,
  getSpreadPageCount,
  getSpreadSizeMm,
  moveSpread,
  removeSpread,
  resolveSpread,
  sourceCropRect,
} from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

describe('spread size and page cuts', () => {
  it('treats a single spread as one page', () => {
    expect(getSpreadPageCount(0, 1)).toBe(1)
  })

  it('treats first and last of many as one page and middle as two', () => {
    expect(getSpreadPageCount(0, 3)).toBe(1)
    expect(getSpreadPageCount(1, 3)).toBe(2)
    expect(getSpreadPageCount(2, 3)).toBe(1)
  })

  it('sizes interior spreads to twice trim width', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const middle = getSpreadSizeMm(book, 1)
    expect(middle.widthMm).toBe(book.settings.trim.widthMm * 2)
    expect(getPageCuts(book, 1)).toEqual([
      { orientation: 'vertical', offsetMm: book.settings.trim.widthMm },
    ])
    expect(getPageCuts(book, 0)).toEqual([])
  })
})

describe('sourceCropRect', () => {
  it('returns full cover window at zoom 1 for square into square', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 1, center: { x: 0.5, y: 0.5 } },
      1,
    )
    expect(rect).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it.each([
    ['portrait', 0.75],
    ['landscape', 1.5],
    ['panorama', 3],
  ])(
    'default fill of a %s photo in a 14.8x21 page covers without stretching',
    (_name, imageAspect) => {
      const frame = { x: 0, y: 0, width: 138.8, height: 201 }
      const rect = sourceCropRect(frame, undefined, imageAspect)
      // Window inside the image, and its pixel aspect equals the frame's.
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(1 + 1e-9)
      expect(rect.y + rect.height).toBeLessThanOrEqual(1 + 1e-9)
      expect((rect.width * imageAspect) / rect.height).toBeCloseTo(
        frame.width / frame.height,
      )
    },
  )

  it('default fill of a landscape photo in a portrait page crops the center', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 138.8, height: 201 },
      undefined,
      1.5,
    )
    expect(rect.height).toBe(1)
    expect(rect.x + rect.width / 2).toBeCloseTo(0.5)
  })

  it('fit contains a wide photo: window taller than the image, centered', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      undefined,
      2,
      'fit',
    )
    expect(rect.width).toBe(1)
    expect(rect.height).toBeCloseTo(2)
    expect(rect.x).toBe(0)
    expect(rect.y).toBeCloseTo(-0.5)
  })

  it('fit contains a tall photo: window wider than the image, centered', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 50 },
      undefined,
      0.5,
      'fit',
    )
    expect(rect.height).toBe(1)
    expect(rect.width).toBeCloseTo(4)
    expect(rect.x).toBeCloseTo(-1.5)
  })

  it('fit zoomed past the image edge pans inside it again', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 4, center: { x: 0.9, y: 0.5 } },
      2,
      'fit',
    )
    expect(rect.width).toBeCloseTo(0.25)
    expect(rect.x + rect.width).toBeCloseTo(1)
    expect(rect.height).toBeCloseTo(0.5)
    expect(rect.y).toBeCloseTo(0.25)
  })

  it('shrinks the window when zoomed', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 2, center: { x: 0.5, y: 0.5 } },
      1,
    )
    expect(rect.width).toBeCloseTo(0.5)
    expect(rect.height).toBeCloseTo(0.5)
    expect(rect.x).toBeCloseTo(0.25)
    expect(rect.y).toBeCloseTo(0.25)
  })

  it('uses default crop when crop is omitted', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      undefined,
      1,
    )
    expect(rect).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('crops sides for a wide image in a square frame', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 1, center: { x: 0.5, y: 0.5 } },
      2,
    )
    expect(rect.height).toBeCloseTo(1)
    expect(rect.width).toBeCloseTo(0.5)
    expect(rect.x).toBeCloseTo(0.25)
  })

  it('crops top and bottom for a tall image in a wide frame', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 200, height: 100 },
      { zoom: 1, center: { x: 0.5, y: 0.5 } },
      0.5,
    )
    expect(rect.width).toBeCloseTo(1)
    expect(rect.height).toBeCloseTo(0.25)
    expect(rect.y).toBeCloseTo(0.375)
  })

  it('clamps center so the crop stays in bounds', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 2, center: { x: 0, y: 1 } },
      1,
    )
    expect(rect.x).toBe(0)
    expect(rect.y + rect.height).toBeCloseTo(1)
  })
})

describe('resolveSpread', () => {
  it('returns undefined for unknown spread', () => {
    expect(resolveSpread(makeBook(), 'missing')).toBeUndefined()
  })

  it('exposes a center cut on an interior spread', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b', frames: [makeFrame({ id: 'f' })] }),
        makeSpread({ id: 'c' }),
      ],
    })
    const resolved = resolveSpread(book, 'b')
    expect(resolved?.pageCuts).toEqual([
      { orientation: 'vertical', offsetMm: book.settings.trim.widthMm },
    ])
  })

  it('resolves a fit frame to a window larger than the image', () => {
    const book = makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [
        makeSpread({
          frames: [makeFrame({ id: 'f', assetId: 'a', fit: 'fit' })],
        }),
      ],
    })
    const [item] =
      resolveSpread(book, 'spread-1', { getAspectRatio: () => 0.1 })?.items ??
      []
    expect(item?.sourceCropRect?.width).toBeGreaterThan(1)
  })

  it('omits source crop for empty frames', () => {
    const book = makeBook({
      spreads: [makeSpread({ frames: [makeFrame({ id: 'empty' })] })],
    })
    const resolved = resolveSpread(book, 'spread-1')
    expect(resolved?.items[0]?.sourceCropRect).toBeUndefined()
  })

  it('recomputes source crops when aspect lookup changes', () => {
    const book = makeBook({
      assets: { a1: {} },
      gallery: ['a1'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              id: 'f1',
              assetId: 'a1',
              crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
              rect: { x: 0, y: 0, width: 200, height: 100 },
            }),
          ],
        }),
      ],
    })
    const first = resolveSpread(book, 'spread-1', {
      getAspectRatio: () => 1,
    })
    const second = resolveSpread(book, 'spread-1', {
      getAspectRatio: () => 2,
    })
    expect(first?.items[0]?.rectMm).toEqual(second?.items[0]?.rectMm)
    expect(first?.items[0]?.sourceCropRect).not.toEqual(
      second?.items[0]?.sourceCropRect,
    )
  })

  it('invalidates page size after moveSpread changes index role', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b', frames: [makeFrame({ id: 'f' })] }),
        makeSpread({ id: 'c' }),
      ],
    })
    const before = resolveSpread(book, 'b')
    expect(before?.pageCuts).toHaveLength(1)
    expect(before?.spreadWidthMm).toBe(book.settings.trim.widthMm * 2)

    const moved = moveSpread(book, 'b', 0)
    const after = resolveSpread(moved, 'b')
    expect(after?.pageCuts).toEqual([])
    expect(after?.spreadWidthMm).toBe(book.settings.trim.widthMm)
  })

  it('invalidates page size after removeSpread changes neighbor roles', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b', frames: [makeFrame({ id: 'f' })] }),
        makeSpread({ id: 'c' }),
      ],
    })
    expect(resolveSpread(book, 'b')?.pageCuts).toHaveLength(1)
    const trimmed = removeSpread(book, 'c')
    expect(resolveSpread(trimmed, 'b')?.pageCuts).toEqual([])
    expect(resolveSpread(trimmed, 'b')?.spreadWidthMm).toBe(
      book.settings.trim.widthMm,
    )
  })
})

describe('rotation in resolve', () => {
  const resolveOne = (frame: ReturnType<typeof makeFrame>, aspect = 2) =>
    resolveSpread(
      makeBook({
        assets: { a: {} },
        gallery: ['a'],
        spreads: [makeSpread({ frames: [frame] })],
      }),
      'spread-1',
      { getAspectRatio: () => aspect },
    )?.items[0]

  it('exposes frame rotationDeg, defaulting to 0', () => {
    expect(resolveOne(makeFrame())?.rotation).toBe(0)
    expect(resolveOne(makeFrame({ rotationDeg: 37.5 }))?.rotation).toBe(37.5)
    expect(resolveOne(makeFrame({ rotationDeg: -90 }))?.rotation).toBe(-90)
  })

  it('does not change the rect when rotated', () => {
    const frame = makeFrame({ rotationDeg: 45 })
    expect(resolveOne(frame)?.rectMm).toEqual(frame.rect)
  })

  it('omits photo rotation fields when crop has none', () => {
    const item = resolveOne(makeFrame({ assetId: 'a' }))
    expect(item).not.toHaveProperty('photoQuarterTurns')
    expect(item).not.toHaveProperty('straightenDeg')
  })

  it('exposes photo quarter turns and straighten', () => {
    const item = resolveOne(
      makeFrame({
        assetId: 'a',
        crop: {
          zoom: 1,
          center: { x: 0.5, y: 0.5 },
          quarterTurns: 1,
          straightenDeg: -3,
        },
      }),
    )
    expect(item?.photoQuarterTurns).toBe(1)
    expect(item?.straightenDeg).toBe(-3)
  })

  it('treats quarterTurns 0 as no rotation', () => {
    const rect = { x: 0, y: 0, width: 120, height: 80 }
    const base = { zoom: 2, center: { x: 0.4, y: 0.6 } }
    expect(sourceCropRect(rect, { ...base, quarterTurns: 0 }, 1.5)).toEqual(
      sourceCropRect(rect, base, 1.5),
    )
  })

  it('maps a quarter-turned centered window to the matching source axes', () => {
    // Square frame on a 2:1 image turned 90° shows a 1:2 image: the window
    // spans the full source height... in source space it is a full-width strip.
    const rect = { x: 0, y: 0, width: 100, height: 100 }
    const turned = sourceCropRect(
      rect,
      { zoom: 1, center: { x: 0.5, y: 0.5 }, quarterTurns: 1 },
      2,
    )
    expect(turned.width).toBeCloseTo(0.5)
    expect(turned.height).toBeCloseTo(1)
    expect(turned.x).toBeCloseTo(0.25)
    // Turning 180° keeps the unturned window for a centered crop.
    expect(
      sourceCropRect(
        rect,
        { zoom: 1, center: { x: 0.5, y: 0.5 }, quarterTurns: 2 },
        2,
      ),
    ).toEqual(sourceCropRect(rect, { zoom: 1, center: { x: 0.5, y: 0.5 } }, 2))
  })

  it('moves the window toward the correct source edge per quarter turn', () => {
    // Center at top-left of the displayed image.
    const rect = { x: 0, y: 0, width: 100, height: 100 }
    const crop = (quarterTurns: number) =>
      sourceCropRect(rect, { zoom: 4, center: { x: 0, y: 0 }, quarterTurns }, 1)
    // Displayed top-left corner is source: 90° cw → bottom-left,
    // 180° → bottom-right, 270° → top-right.
    expect(crop(1)).toMatchObject({ x: 0, y: 0.75 })
    expect(crop(2)).toMatchObject({ x: 0.75, y: 0.75 })
    expect(crop(3)).toMatchObject({ x: 0.75, y: 0 })
  })

  test.prop(
    [
      fc.integer({ min: 0, max: 3 }),
      fc.double({ min: 1, max: 4, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0.4, max: 3, noNaN: true }),
      fc.double({ min: -720, max: 720, noNaN: true }),
    ],
    { numRuns: 100 },
  )(
    'rotated frames and photos keep source crop inside the unit square',
    (quarterTurns, zoom, cx, cy, aspect, rotationDeg) => {
      const item = resolveOne(
        makeFrame({
          assetId: 'a',
          rotationDeg,
          rect: { x: 5, y: 5, width: 120, height: 80 },
          crop: { zoom, center: { x: cx, y: cy }, quarterTurns },
        }),
        aspect,
      )
      const rect = item?.sourceCropRect
      expect(item?.rotation).toBe(rotationDeg)
      expect(rect?.x).toBeGreaterThanOrEqual(-1e-9)
      expect(rect?.y).toBeGreaterThanOrEqual(-1e-9)
      expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(1 + 1e-9)
      expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeLessThanOrEqual(1 + 1e-9)
    },
  )
})

test.prop(
  [
    fc.double({ min: 1, max: 4, noNaN: true }),
    fc.double({ min: 0.2, max: 0.8, noNaN: true }),
    fc.double({ min: 0.2, max: 0.8, noNaN: true }),
    fc.double({ min: 0.5, max: 3, noNaN: true }),
  ],
  { numRuns: 50 },
)('source crop stays inside the unit square', (zoom, cx, cy, aspect) => {
  const rect = sourceCropRect(
    { x: 0, y: 0, width: 120, height: 80 },
    { zoom, center: { x: cx, y: cy } },
    aspect,
  )
  expect(rect.x).toBeGreaterThanOrEqual(0)
  expect(rect.y).toBeGreaterThanOrEqual(0)
  expect(rect.x + rect.width).toBeLessThanOrEqual(1 + 1e-9)
  expect(rect.y + rect.height).toBeLessThanOrEqual(1 + 1e-9)
})
