import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { sourceCropRect } from '../geometry/cropRect'
import {
  applyMatrix,
  compose,
  frameMatrix,
  imageMatrix,
  type Matrix,
} from '../pdf/pdfGeometry'
import {
  applyBookOp,
  checkBookInvariants,
  resizeFrameKeepPhoto,
} from '../index'
import type { Book, Frame } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

function rectOf(x: number, y: number, width = 20, height = 10) {
  return { x, y, width, height }
}

function book(frames: Frame[]) {
  return makeBook({
    spreads: [makeSpread({ templateId: 'one-per-page', frames })],
  })
}

function frameOf(b: ReturnType<typeof book>, id: string): Frame {
  const frame = b.spreads[0]?.frames.find((f) => f.id === id)
  if (frame === undefined) {
    throw new Error(`no ${id}`)
  }
  return frame
}

const A = makeFrame({ id: 'a', rect: rectOf(10, 10) })
const LOCKED = makeFrame({ id: 'a', rect: rectOf(10, 10), locked: true })

describe('moveFrame', () => {
  it('translates an unlocked frame and detaches the template', () => {
    const next = applyBookOp(book([A]), {
      type: 'moveFrame',
      spreadId: 'spread-1',
      frameId: 'a',
      dx: 5,
      dy: -2,
    })
    expect(frameOf(next, 'a').rect).toEqual(rectOf(15, 8))
    expect(next.spreads[0]?.templateId).toBeUndefined()
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it.each([
    ['zero delta', 0, 0],
    ['NaN', Number.NaN, 1],
    ['Infinity', 1, Number.POSITIVE_INFINITY],
  ])('%s → unchanged', (_name, dx, dy) => {
    const before = book([A])
    expect(
      applyBookOp(before, {
        type: 'moveFrame',
        spreadId: 'spread-1',
        frameId: 'a',
        dx,
        dy,
      }),
    ).toBe(before)
  })

  it('skips a locked frame and unknown ids', () => {
    const before = book([LOCKED])
    for (const frameId of ['a', 'nope']) {
      expect(
        applyBookOp(before, {
          type: 'moveFrame',
          spreadId: 'spread-1',
          frameId,
          dx: 5,
          dy: 5,
        }),
      ).toBe(before)
    }
  })
})

describe('moveFrames', () => {
  const move = (
    b: ReturnType<typeof book>,
    frameIds: readonly string[],
    dx: number,
    dy: number,
  ) =>
    applyBookOp(b, {
      type: 'moveFrames',
      spreadId: 'spread-1',
      frameIds,
      dx,
      dy,
    })

  it('moves every listed unlocked frame by the same delta, locked stay', () => {
    const before = book([
      makeFrame({ id: 'a', rect: rectOf(10, 10) }),
      makeFrame({ id: 'b', rect: rectOf(50, 30), locked: true }),
      makeFrame({ id: 'c', rect: rectOf(90, 60) }),
      makeFrame({ id: 'd', rect: rectOf(5, 5) }),
    ])
    const next = move(before, ['a', 'b', 'c'], 4, -3)
    expect(frameOf(next, 'a').rect).toEqual(rectOf(14, 7))
    expect(frameOf(next, 'b')).toBe(frameOf(before, 'b'))
    expect(frameOf(next, 'c').rect).toEqual(rectOf(94, 57))
    expect(frameOf(next, 'd')).toBe(frameOf(before, 'd'))
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it.each([
    ['zero delta', 0, 0],
    ['NaN', Number.NaN, 1],
    ['Infinity', 1, Number.NEGATIVE_INFINITY],
  ])('%s → unchanged', (_name, dx, dy) => {
    const before = book([A])
    expect(move(before, ['a'], dx, dy)).toBe(before)
  })

  it('all locked, none listed or unknown ids → unchanged', () => {
    const before = book([LOCKED])
    for (const ids of [['a'], [], ['nope']]) {
      expect(move(before, ids, 5, 5)).toBe(before)
    }
  })

  it('PBT: locked never move and each frame equals folding moveFrame', () => {
    const delta = fc.double({ min: -500, max: 500, noNaN: true })
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.boolean(), fc.boolean()), {
          minLength: 1,
          maxLength: 6,
        }),
        delta,
        delta,
        (flags, dx, dy) => {
          const frames = flags.map(([locked], index) =>
            makeFrame({
              id: `f${String(index)}`,
              rect: rectOf(index * 7, index * 3),
              z: index,
              ...(locked ? { locked: true } : {}),
            }),
          )
          const ids = frames
            .filter((_, index) => flags[index]?.[1] === true)
            .map((frame) => frame.id)
          const before = book(frames)
          const group = move(before, ids, dx, dy)
          const folded = ids.reduce(
            (acc, frameId) =>
              applyBookOp(acc, {
                type: 'moveFrame',
                spreadId: 'spread-1',
                frameId,
                dx,
                dy,
              }),
            before,
          )
          for (const frame of frames) {
            expect(frameOf(group, frame.id).rect).toEqual(
              frameOf(folded, frame.id).rect,
            )
            if (frame.locked === true) {
              expect(frameOf(group, frame.id).rect).toEqual(frame.rect)
            }
          }
        },
      ),
    )
  })
})

describe('resizeFrame', () => {
  const op = (rect: Frame['rect']) =>
    ({ type: 'resizeFrame', spreadId: 'spread-1', frameId: 'a', rect }) as const

  it('sets the rect of an unlocked frame', () => {
    const next = applyBookOp(book([A]), op(rectOf(8, 9, 30, 12)))
    expect(frameOf(next, 'a').rect).toEqual(rectOf(8, 9, 30, 12))
    expect(next.spreads[0]?.templateId).toBeUndefined()
  })

  it.each([
    ['narrow', rectOf(10, 10, 4.9, 10)],
    ['short', rectOf(10, 10, 20, 4.9)],
    ['NaN', rectOf(Number.NaN, 10)],
    ['same rect', rectOf(10, 10)],
  ])('%s → unchanged', (_name, rect) => {
    const before = book([A])
    expect(applyBookOp(before, op(rect))).toBe(before)
  })

  it('accepts exactly the minimum edge', () => {
    const next = applyBookOp(book([A]), op(rectOf(10, 10, 5, 5)))
    expect(frameOf(next, 'a').rect.width).toBe(5)
  })

  it('skips a locked frame', () => {
    const before = book([LOCKED])
    expect(applyBookOp(before, op(rectOf(0, 0, 50, 50)))).toBe(before)
  })
})

/** Photo unit square → spread mm, as the PDF painter lays the photo out. */
function photoMatrix(frame: Frame, aspect: number): Matrix {
  const turns = frame.crop?.quarterTurns ?? 0
  const item = {
    rectMm: frame.rect,
    rotation: frame.rotationDeg ?? 0,
    sourceCropRect: sourceCropRect(frame.rect, frame.crop, aspect, frame.fit),
    ...(turns === 0 ? {} : { photoQuarterTurns: turns as 1 | 2 | 3 }),
    straightenDeg: frame.crop?.straightenDeg ?? 0,
    ...(frame.crop?.flipH === true ? { photoFlipH: true as const } : {}),
    ...(frame.crop?.flipV === true ? { photoFlipV: true as const } : {}),
  }
  return compose(frameMatrix(item), imageMatrix(item))
}

function inverse([a, b, c, d, e, f]: Matrix): Matrix {
  const det = a * d - b * c
  return [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ]
}

const UNIT_CORNERS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

function photoCorners(frame: Frame, aspect: number) {
  const m = photoMatrix(frame, aspect)
  return UNIT_CORNERS.map((p) => applyMatrix(m, p))
}

/** Page centre and edge lengths of the photo. */
function photoBox(frame: Frame, aspect: number) {
  const [p0, p1, , p3] = photoCorners(frame, aspect)
  const m = photoMatrix(frame, aspect)
  return {
    centre: applyMatrix(m, { x: 0.5, y: 0.5 }),
    edges: [
      Math.hypot((p1?.x ?? 0) - (p0?.x ?? 0), (p1?.y ?? 0) - (p0?.y ?? 0)),
      Math.hypot((p3?.x ?? 0) - (p0?.x ?? 0), (p3?.y ?? 0) - (p0?.y ?? 0)),
    ].sort((l, r) => l - r),
  }
}

/** Whether the photo of `photo` covers the page area of `frame`. */
function covers(
  photo: Frame,
  frame: Frame,
  aspect: number,
  slack = 1e-6,
): boolean {
  const toPhoto = inverse(photoMatrix(photo, aspect))
  const { width, height } = frame.rect
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
    .map((p) =>
      applyMatrix(toPhoto, applyMatrix(frameMatrix(frameItem(frame)), p)),
    )
    .every(
      (p) =>
        p.x >= -slack && p.x <= 1 + slack && p.y >= -slack && p.y <= 1 + slack,
    )
}

function frameItem(frame: Frame) {
  return { rectMm: frame.rect, rotation: frame.rotationDeg ?? 0 }
}

function expectSamePhoto(before: Frame, after: Frame, aspect: number) {
  const was = photoCorners(before, aspect)
  photoCorners(after, aspect).forEach((p, i) => {
    expect(p.x).toBeCloseTo(was[i]?.x ?? Number.NaN, 6)
    expect(p.y).toBeCloseTo(was[i]?.y ?? Number.NaN, 6)
  })
}

describe('resizeFrameKeepPhoto', () => {
  // A 3:2 photo; the 60 × 40 frame at (10, 10) shows it whole at zoom 1.
  const PHOTO = { widthPx: 3000, heightPx: 2000 }
  const photoFrame = (overrides: Partial<Frame> = {}) =>
    makeFrame({
      id: 'a',
      assetId: 'p',
      rect: rectOf(10, 10, 60, 40),
      crop: { zoom: 2, center: { x: 0.5, y: 0.5 } },
      ...overrides,
    })
  const photoBook = (frame: Frame, asset: Book['assets'][string] = PHOTO) =>
    makeBook({
      assets: { p: asset },
      gallery: ['p'],
      spreads: [makeSpread({ templateId: 'one-per-page', frames: [frame] })],
    })
  const op = (rect: Frame['rect'], aspectRatio?: number) =>
    ({
      type: 'resizeFrameKeepPhoto',
      spreadId: 'spread-1',
      frameId: 'a',
      rect,
      ...(aspectRatio === undefined ? {} : { aspectRatio }),
    }) as const

  it.each([
    ['left edge', rectOf(25, 10, 45, 40)],
    ['right edge', rectOf(10, 10, 45, 40)],
    ['top edge', rectOf(10, 20, 60, 30)],
    ['bottom edge', rectOf(10, 10, 60, 30)],
    ['top-left corner', rectOf(20, 15, 50, 35)],
    ['top-right corner', rectOf(10, 15, 50, 35)],
    ['bottom-left corner', rectOf(20, 10, 50, 35)],
    ['bottom-right corner', rectOf(10, 10, 50, 35)],
  ])('shrinking the %s keeps the photo in place', (_name, rect) => {
    const frame = photoFrame()
    const next = frameOf(applyBookOp(photoBook(frame), op(rect)), 'a')
    expect(next.rect).toEqual(rect)
    expectSamePhoto(frame, next, 1.5)
  })

  it.each([
    ['left edge', rectOf(-5, 10, 75, 40)],
    ['right edge', rectOf(10, 10, 75, 40)],
    ['top edge', rectOf(10, 0, 60, 50)],
    ['bottom edge', rectOf(10, 10, 60, 50)],
    ['top-left corner', rectOf(0, 0, 70, 50)],
    ['bottom-right corner', rectOf(10, 10, 70, 50)],
  ])('growing the %s inside the photo keeps it in place', (_name, rect) => {
    const frame = photoFrame()
    const next = applyBookOp(photoBook(frame), op(rect))
    expectSamePhoto(frame, frameOf(next, 'a'), 1.5)
    expect(next.spreads[0]?.templateId).toBeUndefined()
    expect(checkBookInvariants(next).ok).toBe(true)
  })

  it('shrinking zooms the crop in and moves its centre', () => {
    // The 120 × 80 photo around (40, 30); the 30 × 20 frame around (25, 20).
    const next = frameOf(
      applyBookOp(photoBook(photoFrame()), op(rectOf(10, 10, 30, 20))),
      'a',
    )
    expect(next.crop?.zoom).toBeCloseTo(4, 9)
    expect(next.crop?.center.x).toBeCloseTo(0.375, 9)
    expect(next.crop?.center.y).toBeCloseTo(0.375, 9)
  })

  it.each([
    // Frame = photo at zoom 1: growing an edge must scale the photo up.
    ['right edge, anchored left', rectOf(10, 10, 90, 40), { x: 55, y: 30 }],
    ['left edge, anchored right', rectOf(-20, 10, 90, 40), { x: 25, y: 30 }],
    ['bottom edge, anchored top', rectOf(10, 10, 60, 60), { x: 40, y: 40 }],
    ['top edge, anchored bottom', rectOf(10, -10, 60, 60), { x: 40, y: 20 }],
    [
      'bottom-right, anchored top-left',
      rectOf(10, 10, 90, 60),
      { x: 55, y: 40 },
    ],
    [
      'top-left, anchored bottom-right',
      rectOf(-20, -10, 90, 60),
      { x: 25, y: 20 },
    ],
  ])('Fill past the photo: %s', (_name, rect, centre) => {
    const frame = photoFrame({ crop: { zoom: 1, center: { x: 0.5, y: 0.5 } } })
    const next = frameOf(applyBookOp(photoBook(frame), op(rect)), 'a')
    const box = photoBox(next, 1.5)
    expect(box.centre.x).toBeCloseTo(centre.x, 6)
    expect(box.centre.y).toBeCloseTo(centre.y, 6)
    expect(box.edges[0]).toBeCloseTo(60, 6)
    expect(box.edges[1]).toBeCloseTo(90, 6)
    expect(covers(next, next, 1.5)).toBe(true)
  })

  it('Fill past one side while the other shrinks scales only as needed', () => {
    // Zoom 2: the photo is 120 × 80 around (40, 30), x from -20 to 100.
    const frame = photoFrame()
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(10, 10, 100, 30))),
      'a',
    )
    // Right edge 110 > 100: scale 100 / 90 about the left edge x = 10.
    const box = photoBox(next, 1.5)
    expect(box.edges[1]).toBeCloseTo(120 * (100 / 90), 6)
    expect(box.centre.x).toBeCloseTo(10 + (100 / 90) * 30, 6)
    expect(covers(next, next, 1.5)).toBe(true)
  })

  // Zoom 2: the photo spans x -20…100, y -10…70, past the fixed edge too, so
  // the anchored scale differs from a clamp that recentres it.
  const k1 = 100 / 90
  const k2 = 70 / 60
  it.each([
    ['right edge', rectOf(10, 10, 100, 40), { x: 10 + 30 * k1, y: 30 }, k1],
    ['left edge', rectOf(-30, 10, 100, 40), { x: 70 - 30 * k1, y: 30 }, k1],
    ['bottom edge', rectOf(10, 10, 60, 70), { x: 40, y: 10 + 20 * k2 }, k2],
    ['top edge', rectOf(10, -20, 60, 70), { x: 40, y: 50 - 20 * k2 }, k2],
    // Edges moved by exactly the tolerance still count as fixed.
    [
      'right edge, left nudged',
      rectOf(10 + 2 ** -20, 10, 100 - 2 ** -20, 40),
      { x: 10 + 30 * k1, y: 30 },
      k1,
    ],
    [
      'left edge, right nudged',
      rectOf(-30, 10, 100 + 2 ** -20, 40),
      { x: 70 - 30 * k1, y: 30 },
      k1,
    ],
  ])(
    'Fill past a zoomed photo: %s scales about the far edge',
    (_n, rect, centre, k) => {
      const next = frameOf(applyBookOp(photoBook(photoFrame()), op(rect)), 'a')
      const box = photoBox(next, 1.5)
      expect(box.centre.x).toBeCloseTo(centre.x, 5)
      expect(box.centre.y).toBeCloseTo(centre.y, 5)
      expect(box.edges[1]).toBeCloseTo(120 * k, 5)
      expect(covers(next, next, 1.5)).toBe(true)
    },
  )

  it('anchors the Fill scale of a zoomed photo in a rotated frame', () => {
    // 90° clockwise: local +x points down the page. The local left edge stays
    // at page y 0, the right one moves from 60 to 100, past the photo (90).
    const next = frameOf(
      applyBookOp(
        photoBook(photoFrame({ rotationDeg: 90 })),
        op(rectOf(-10, 30, 100, 40)),
      ),
      'a',
    )
    const box = photoBox(next, 1.5)
    expect(box.centre.x).toBeCloseTo(40, 6)
    expect(box.centre.y).toBeCloseTo(30 * k1, 6)
    expect(box.edges[1]).toBeCloseTo(120 * k1, 6)
  })

  it('scales a straightened photo by the least cover about the fixed edge', () => {
    const frame = photoFrame({
      crop: { zoom: 2, center: { x: 0.5, y: 0.5 }, straightenDeg: 10 },
    })
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(10, 10, 120, 40))),
      'a',
    )
    // The left edge midpoint (10, 30) keeps its place on the photo.
    const was = photoCorners(frame, 1.5)
    const now = photoCorners(next, 1.5)
    const k =
      Math.hypot(
        (now[1]?.x ?? 0) - (now[0]?.x ?? 0),
        (now[1]?.y ?? 0) - (now[0]?.y ?? 0),
      ) /
      Math.hypot(
        (was[1]?.x ?? 0) - (was[0]?.x ?? 0),
        (was[1]?.y ?? 0) - (was[0]?.y ?? 0),
      )
    expect(k).toBeGreaterThan(1)
    now.forEach((p, i) => {
      expect(p.x).toBeCloseTo(10 + k * ((was[i]?.x ?? Number.NaN) - 10), 6)
      expect(p.y).toBeCloseTo(30 + k * ((was[i]?.y ?? Number.NaN) - 30), 6)
    })
    // Least: covered, but a frame corner sits on the photo edge.
    expect(covers(next, next, 1.5)).toBe(true)
    expect(covers(next, next, 1.5, -1e-6)).toBe(false)
  })

  it('Fit keeps the photo size past the photo (no cover scale)', () => {
    const frame = photoFrame({ fit: 'fit' })
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(10, 10, 200, 40))),
      'a',
    )
    const box = photoBox(next, 1.5)
    // 120 × 80 as before; letterboxed, so centred across the frame.
    expect(box.edges).toEqual([expect.closeTo(80, 6), expect.closeTo(120, 6)])
    expect(box.centre.x).toBeCloseTo(110, 6)
    expect(box.centre.y).toBeCloseTo(30, 6)
  })

  it('Fit keeps the photo in place inside it', () => {
    const frame = photoFrame({ fit: 'fit' })
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(0, 15, 90, 30))),
      'a',
    )
    expectSamePhoto(frame, next, 1.5)
  })

  it('keeps the photo of a rotated frame', () => {
    const frame = photoFrame({ rotationDeg: 30 })
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(14, 12, 44, 31))),
      'a',
    )
    expectSamePhoto(frame, next, 1.5)
  })

  it('anchors the Fill scale at the fixed edge of a rotated frame', () => {
    // 90° clockwise: local +x points down the page. Growing the local right
    // edge by 30 with the left edge (page y = 0) fixed moves the centre to y 45.
    const frame = photoFrame({
      rotationDeg: 90,
      crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
    })
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(-5, 25, 90, 40))),
      'a',
    )
    const box = photoBox(next, 1.5)
    expect(box.centre.x).toBeCloseTo(40, 6)
    expect(box.centre.y).toBeCloseTo(45, 6)
    expect(box.edges[1]).toBeCloseTo(90, 6)
  })

  it('keeps a straightened, turned and flipped photo in place', () => {
    const frame = photoFrame({
      crop: {
        zoom: 3,
        center: { x: 0.4, y: 0.55 },
        quarterTurns: 1,
        straightenDeg: 10,
        flipH: true,
      },
    })
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(18, 14, 40, 28))),
      'a',
    )
    expectSamePhoto(frame, next, 1.5)
    expect(next.crop).toMatchObject({
      quarterTurns: 1,
      straightenDeg: 10,
      flipH: true,
    })
  })

  it('a straightened photo in Fill still covers the grown frame', () => {
    const frame = photoFrame({
      crop: { zoom: 1, center: { x: 0.5, y: 0.5 }, straightenDeg: -20 },
    })
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(10, 10, 90, 40))),
      'a',
    )
    expect(covers(next, next, 1.5)).toBe(true)
  })

  it.each([
    ['an EXIF-turned asset', { ...PHOTO, orientation: 6 }, 2 / 3],
    ['an asset without a size', {}, 1],
  ])('reads the aspect of %s', (_name, asset, aspect) => {
    const frame = photoFrame()
    const next = frameOf(
      applyBookOp(photoBook(frame, asset), op(rectOf(10, 10, 45, 30))),
      'a',
    )
    expectSamePhoto(frame, next, aspect)
  })

  it('keeps the photo of a frame without a crop (zoom 1, centred)', () => {
    const frame = makeFrame({
      id: 'a',
      assetId: 'p',
      rect: rectOf(10, 10, 60, 40),
    })
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(20, 15, 40, 30))),
      'a',
    )
    expectSamePhoto(frame, next, 1.5)
  })

  it('reads a photo without an asset record as square', () => {
    const frame = photoFrame()
    const before = makeBook({
      spreads: [makeSpread({ templateId: 'one-per-page', frames: [frame] })],
    })
    const next = frameOf(
      resizeFrameKeepPhoto(before, 'spread-1', 'a', rectOf(10, 10, 45, 30)),
      'a',
    )
    expectSamePhoto(frame, next, 1)
  })

  it('takes the given aspect over the asset record', () => {
    const frame = photoFrame()
    const next = frameOf(
      applyBookOp(photoBook(frame), op(rectOf(10, 10, 45, 30), 2)),
      'a',
    )
    expectSamePhoto(frame, next, 2)
  })

  it('sets only the rect of a frame without a photo', () => {
    const next = applyBookOp(book([A]), op(rectOf(8, 9, 30, 12)))
    expect(frameOf(next, 'a')).toEqual({ ...A, rect: rectOf(8, 9, 30, 12) })
  })

  it.each([
    ['narrow', rectOf(10, 10, 4.9, 40)],
    ['short', rectOf(10, 10, 60, 4.9)],
    ['NaN', rectOf(10, Number.NaN, 60, 40)],
    ['same rect', rectOf(10, 10, 60, 40)],
  ])('%s → unchanged', (_name, rect) => {
    const before = photoBook(photoFrame())
    expect(applyBookOp(before, op(rect))).toBe(before)
  })

  it('skips a locked frame', () => {
    const before = photoBook(photoFrame({ locked: true }))
    expect(
      resizeFrameKeepPhoto(before, 'spread-1', 'a', rectOf(0, 0, 50, 50)),
    ).toBe(before)
  })

  // Evenly spread (fc.double piles up at the bounds and near 0, where the
  // photo edge sits on the frame edge and the clamp always acts).
  const num = (min: number, max: number) =>
    fc
      .integer({ min: 0, max: 100_000 })
      .map((i) => min + ((max - min) * i) / 100_000)
  const frameArb = fc
    .record({
      rect: fc.record({
        x: num(-50, 50),
        y: num(-50, 50),
        width: num(5, 100),
        height: num(5, 100),
      }),
      rotationDeg: num(-180, 180),
      fit: fc.constantFrom<Frame['fit']>('fill', 'fit'),
      zoom: num(1, 4),
      cx: num(0, 1),
      cy: num(0, 1),
      quarterTurns: fc.integer({ min: 0, max: 3 }),
      flipH: fc.boolean(),
    })
    .map(({ rect, rotationDeg, fit, zoom, cx, cy, quarterTurns, flipH }) =>
      photoFrame({
        rect,
        rotationDeg,
        fit,
        crop: { zoom, center: { x: cx, y: cy }, quarterTurns, flipH },
      }),
    )

  it('PBT: the photo stays put unless the clamp acts; Fill always covers', () => {
    let idle = 0
    fc.assert(
      fc.property(
        frameArb,
        // Handle drags: each rect edge moves by up to 30 mm.
        fc.array(num(-30, 30), { minLength: 4, maxLength: 4 }),
        num(0.5, 2),
        (frame, [left = 0, top = 0, right = 0, bottom = 0], aspect) => {
          const rect = {
            x: frame.rect.x + left,
            y: frame.rect.y + top,
            width: Math.max(5, frame.rect.width - left + right),
            height: Math.max(5, frame.rect.height - top + bottom),
          }
          const next = frameOf(
            resizeFrameKeepPhoto(
              photoBook(frame),
              'spread-1',
              'a',
              rect,
              aspect,
            ),
            'a',
          )
          if (frame.fit !== 'fit') {
            expect(covers(next, next, aspect)).toBe(true)
          }
          const clampIdle =
            // Strictly inside: on the boundary the clamp may act by a hair.
            covers(frame, { ...next, rect }, aspect, -1e-6) &&
            (next.crop?.zoom ?? 0) < 8 - 1e-9
          if (clampIdle) {
            idle += 1
            const was = photoCorners(frame, aspect)
            photoCorners(next, aspect).forEach((p, i) => {
              expect(
                Math.abs(p.x - (was[i]?.x ?? Number.NaN)),
              ).toBeLessThanOrEqual(1e-6)
              expect(
                Math.abs(p.y - (was[i]?.y ?? Number.NaN)),
              ).toBeLessThanOrEqual(1e-6)
            })
          }
        },
      ),
      { numRuns: 300 },
    )
    // The invariance branch must actually run, not only the cover one.
    expect(idle).toBeGreaterThan(30)
  })
})

describe('rotateFrame', () => {
  const op = (rotationDeg: number) =>
    ({
      type: 'rotateFrame',
      spreadId: 'spread-1',
      frameId: 'a',
      rotationDeg,
    }) as const

  it('sets rotation and detaches the template', () => {
    const next = applyBookOp(book([A]), op(30))
    expect(frameOf(next, 'a').rotationDeg).toBe(30)
    expect(next.spreads[0]?.templateId).toBeUndefined()
  })

  it.each([
    [370, 10],
    [-90, 270],
    [360, 0],
  ])('normalises %d° to [0, 360) → %d', (input, expected) => {
    const start = book([{ ...A, rotationDeg: 45 }])
    expect(frameOf(applyBookOp(start, op(input)), 'a').rotationDeg).toBe(
      expected,
    )
  })

  it('same angle (absent counts as 0), NaN and locked → unchanged', () => {
    const plain = book([A])
    expect(applyBookOp(plain, op(0))).toBe(plain)
    expect(applyBookOp(plain, op(360))).toBe(plain)
    expect(applyBookOp(plain, op(Number.NaN))).toBe(plain)
    const locked = book([LOCKED])
    expect(applyBookOp(locked, op(45))).toBe(locked)
  })
})

describe('alignFrames', () => {
  const fa = makeFrame({ id: 'a', rect: rectOf(10, 10, 20, 10) })
  const fb = makeFrame({ id: 'b', rect: rectOf(50, 40, 30, 20) })
  const fc = makeFrame({ id: 'c', rect: rectOf(100, 5, 10, 10) })
  const f = [fa, fb, fc]
  const run = (
    frames: Frame[],
    edge: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY',
    ids = ['a', 'b', 'c'],
  ) =>
    applyBookOp(book(frames), {
      type: 'alignFrames',
      spreadId: 'spread-1',
      frameIds: ids,
      edge,
    })

  it.each([
    ['left', 'b', { x: 10 }],
    ['right', 'a', { x: 90 }],
    ['top', 'b', { y: 5 }],
    ['bottom', 'a', { y: 50 }],
    ['centerX', 'c', { x: 55 }],
    ['centerY', 'a', { y: 27.5 }],
  ] as const)('%s', (edge, id, expected) => {
    const rect = frameOf(run(f, edge), id).rect
    expect(rect).toMatchObject(expected)
  })

  it('locked frames neither move nor widen the bounds', () => {
    const lockedC = { ...fc, locked: true }
    const next = run([fa, fb, lockedC], 'right')
    expect(frameOf(next, 'a').rect.x).toBe(60)
    expect(frameOf(next, 'c')).toEqual(lockedC)
  })

  it('under two unlocked targets → unchanged', () => {
    const before = book([fa, { ...fb, locked: true }])
    expect(
      applyBookOp(before, {
        type: 'alignFrames',
        spreadId: 'spread-1',
        frameIds: ['a', 'b'],
        edge: 'left',
      }),
    ).toBe(before)
  })

  it('already aligned → unchanged', () => {
    const aligned = book([
      makeFrame({ id: 'a', rect: rectOf(10, 0) }),
      makeFrame({ id: 'b', rect: rectOf(10, 30) }),
    ])
    expect(
      applyBookOp(aligned, {
        type: 'alignFrames',
        spreadId: 'spread-1',
        frameIds: ['a', 'b'],
        edge: 'left',
      }),
    ).toBe(aligned)
  })
})

describe('distributeFrames', () => {
  const fa = makeFrame({ id: 'a', rect: rectOf(0, 0, 10, 10) })
  const fb = makeFrame({ id: 'b', rect: rectOf(15, 30, 10, 10) })
  const fc = makeFrame({ id: 'c', rect: rectOf(50, 70, 10, 10) })
  const f = [fa, fb, fc]
  const run = (frames: Frame[], axis: 'horizontal' | 'vertical') =>
    applyBookOp(book(frames), {
      type: 'distributeFrames',
      spreadId: 'spread-1',
      frameIds: ['a', 'b', 'c'],
      axis,
    })

  it('evens horizontal gaps, keeping the outer two', () => {
    const next = run(f, 'horizontal')
    expect(frameOf(next, 'a').rect.x).toBe(0)
    expect(frameOf(next, 'b').rect.x).toBe(25)
    expect(frameOf(next, 'c').rect.x).toBe(50)
    expect(next.spreads[0]?.templateId).toBeUndefined()
  })

  it('evens vertical gaps', () => {
    expect(frameOf(run(f, 'vertical'), 'b').rect.y).toBe(35)
  })

  it('skips a locked frame: it stays and the unlocked three even out', () => {
    const locked = makeFrame({
      id: 'l',
      rect: rectOf(90, 0, 10, 10),
      locked: true,
    })
    const next = applyBookOp(book([...f, locked]), {
      type: 'distributeFrames',
      spreadId: 'spread-1',
      frameIds: ['a', 'b', 'c', 'l'],
      axis: 'horizontal',
    })
    expect(frameOf(next, 'b').rect.x).toBe(25)
    expect(frameOf(next, 'c').rect.x).toBe(50)
    expect(frameOf(next, 'l')).toEqual(locked)
  })

  it('a locked middle frame leaves two targets → unchanged', () => {
    const before = book([fa, { ...fb, locked: true }, fc])
    expect(
      applyBookOp(before, {
        type: 'distributeFrames',
        spreadId: 'spread-1',
        frameIds: ['a', 'b', 'c'],
        axis: 'horizontal',
      }),
    ).toBe(before)
  })

  it('already even → unchanged', () => {
    const even = book([
      makeFrame({ id: 'a', rect: rectOf(0, 0, 10, 10) }),
      makeFrame({ id: 'b', rect: rectOf(20, 0, 10, 10) }),
      makeFrame({ id: 'c', rect: rectOf(40, 0, 10, 10) }),
    ])
    expect(
      applyBookOp(even, {
        type: 'distributeFrames',
        spreadId: 'spread-1',
        frameIds: ['a', 'b', 'c'],
        axis: 'horizontal',
      }),
    ).toBe(even)
  })
})
