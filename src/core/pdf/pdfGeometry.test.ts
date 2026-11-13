import { describe, expect, it } from 'vitest'
import {
  applyMatrix,
  compose,
  CROP_MARK_LENGTH_MM,
  cropMarkOffsetMm,
  cropMarkSegments,
  frameMatrix,
  frameTouches,
  IDENTITY,
  imageMatrix,
  multiply,
  orientationMatrix,
  orientedAspect,
  pdfSheets,
  printBleedMm,
  PT_PER_MM,
  rotate,
  scale,
  sheetBoxes,
  sheetMatrix,
  translate,
} from './pdfGeometry'

const TRIM = { widthMm: 300, heightMm: 200 }

function close(point: { x: number; y: number }, x: number, y: number): void {
  expect(point.x).toBeCloseTo(x, 9)
  expect(point.y).toBeCloseTo(y, 9)
}

describe('matrices', () => {
  it('applies the right-hand matrix first', () => {
    const m = multiply(translate(10, 0), scale(2, 3))
    close(applyMatrix(m, { x: 1, y: 1 }), 12, 3)
    close(
      applyMatrix(compose(scale(2, 3), translate(10, 0)), { x: 1, y: 1 }),
      22,
      3,
    )
    expect(compose()).toEqual(IDENTITY)
  })

  it('rotates clockwise on a y-down page, like CSS', () => {
    close(applyMatrix(rotate(90), { x: 1, y: 0 }), 0, 1)
    close(applyMatrix(rotate(-90), { x: 1, y: 0 }), 0, -1)
    close(applyMatrix(rotate(180), { x: 0, y: 1 }), 0, -1)
  })
})

describe('pdfSheets', () => {
  it('prints a single first and last page and splits inner spreads into pages', () => {
    const sheets = pdfSheets(4, TRIM, 'pages')
    expect(sheets).toEqual([
      { spreadIndex: 0, trim: { x: 0, y: 0, width: 300, height: 200 } },
      { spreadIndex: 1, trim: { x: 0, y: 0, width: 300, height: 200 } },
      { spreadIndex: 1, trim: { x: 300, y: 0, width: 300, height: 200 } },
      { spreadIndex: 2, trim: { x: 0, y: 0, width: 300, height: 200 } },
      { spreadIndex: 2, trim: { x: 300, y: 0, width: 300, height: 200 } },
      { spreadIndex: 3, trim: { x: 0, y: 0, width: 300, height: 200 } },
    ])
  })

  it('prints one sheet per spread, two pages wide inside the book', () => {
    expect(pdfSheets(3, TRIM, 'spreads')).toEqual([
      { spreadIndex: 0, trim: { x: 0, y: 0, width: 300, height: 200 } },
      { spreadIndex: 1, trim: { x: 0, y: 0, width: 600, height: 200 } },
      { spreadIndex: 2, trim: { x: 0, y: 0, width: 300, height: 200 } },
    ])
  })

  it('prints nothing for an empty book and one page for a one-spread book', () => {
    expect(pdfSheets(0, TRIM, 'pages')).toEqual([])
    expect(pdfSheets(1, TRIM, 'spreads')).toHaveLength(1)
  })
})

describe('printBleedMm', () => {
  it('keeps the book bleed inside the profile range', () => {
    const range = { bleedMinMm: 2, bleedMaxMm: 5 }
    expect(printBleedMm(3, range)).toBe(3)
    expect(printBleedMm(0, range)).toBe(2)
    expect(printBleedMm(9, range)).toBe(5)
  })
})

describe('sheetBoxes', () => {
  it('without crop marks: media = bleed box, trim inset by the bleed', () => {
    const boxes = sheetBoxes(300, 200, 3, false)
    expect(boxes.slugMm).toBe(3)
    expect(boxes.media).toEqual({
      x: 0,
      y: 0,
      width: 306 * PT_PER_MM,
      height: 206 * PT_PER_MM,
    })
    expect(boxes.bleed).toEqual(boxes.media)
    expect(boxes.trim.x).toBeCloseTo(3 * PT_PER_MM, 9)
    expect(boxes.trim.y).toBeCloseTo(3 * PT_PER_MM, 9)
    expect(boxes.trim.width).toBeCloseTo(300 * PT_PER_MM, 9)
    expect(boxes.trim.height).toBeCloseTo(200 * PT_PER_MM, 9)
  })

  it('with crop marks: media grows by the mark offset and length', () => {
    const boxes = sheetBoxes(300, 200, 3, true)
    expect(boxes.slugMm).toBe(3 + CROP_MARK_LENGTH_MM)
    expect(boxes.media.width).toBeCloseTo(316 * PT_PER_MM, 9)
    expect(boxes.media.height).toBeCloseTo(216 * PT_PER_MM, 9)
    expect(boxes.bleed.x).toBeCloseTo(5 * PT_PER_MM, 9)
    expect(boxes.bleed.width).toBeCloseTo(306 * PT_PER_MM, 9)
    expect(boxes.trim.x).toBeCloseTo(8 * PT_PER_MM, 9)
  })

  it('without bleed: bleed box = trim box, marks still clear of the trim', () => {
    const boxes = sheetBoxes(300, 200, 0, true)
    expect(cropMarkOffsetMm(0)).toBe(3)
    expect(boxes.slugMm).toBe(8)
    expect(boxes.bleed).toEqual(boxes.trim)
    expect(sheetBoxes(300, 200, 0, false).media).toEqual(
      sheetBoxes(300, 200, 0, false).trim,
    )
  })
})

describe('sheetMatrix', () => {
  it('maps the sheet trim onto the PDF trim box (y up)', () => {
    const left = {
      spreadIndex: 1,
      trim: { x: 0, y: 0, width: 300, height: 200 },
    }
    const right = { ...left, trim: { ...left.trim, x: 300 } }
    const boxes = sheetBoxes(300, 200, 3, false)
    const topLeft = { x: boxes.trim.x, y: boxes.trim.y + boxes.trim.height }
    close(
      applyMatrix(sheetMatrix(left, 3), { x: 0, y: 0 }),
      topLeft.x,
      topLeft.y,
    )
    close(
      applyMatrix(sheetMatrix(right, 3), { x: 300, y: 0 }),
      topLeft.x,
      topLeft.y,
    )
    close(
      applyMatrix(sheetMatrix(right, 3), { x: 600, y: 200 }),
      boxes.trim.x + boxes.trim.width,
      boxes.trim.y,
    )
    const lowered = { ...left, trim: { ...left.trim, y: 10 } }
    close(
      applyMatrix(sheetMatrix(lowered, 3), { x: 0, y: 10 }),
      topLeft.x,
      topLeft.y,
    )
  })
})

describe('cropMarkSegments', () => {
  it('draws two 5 mm marks per corner on the trim lines, outside the bleed', () => {
    const trim = { x: 300, y: 0, width: 300, height: 200 }
    const segments = cropMarkSegments(trim, 4)
    expect(segments).toHaveLength(8)
    expect(segments[0]).toEqual({
      from: { x: 296, y: 0 },
      to: { x: 291, y: 0 },
    })
    expect(segments[1]).toEqual({
      from: { x: 300, y: -4 },
      to: { x: 300, y: -9 },
    })
    expect(segments[7]).toEqual({
      from: { x: 600, y: 204 },
      to: { x: 600, y: 209 },
    })
  })
})

describe('frameMatrix', () => {
  it('places the frame rect and rotates it about its centre', () => {
    const rectMm = { x: 10, y: 20, width: 40, height: 20 }
    close(
      applyMatrix(frameMatrix({ rectMm, rotation: 0 }), { x: 0, y: 0 }),
      10,
      20,
    )
    const turned = frameMatrix({ rectMm, rotation: 90 })
    close(applyMatrix(turned, { x: 20, y: 10 }), 30, 30)
    close(applyMatrix(turned, { x: 0, y: 0 }), 40, 10)
  })
})

describe('frameTouches', () => {
  const area = { x: 297, y: -3, width: 306, height: 206 }
  const at = (x: number, width: number, rotation = 0) => ({
    rectMm: { x, y: 10, width, height: 20 },
    rotation,
  })

  it('keeps frames reaching into the area, by their rotated bounds', () => {
    expect(frameTouches(at(10, 100), area)).toBe(false)
    expect(frameTouches(at(200, 97), area)).toBe(false)
    expect(frameTouches(at(200, 98), area)).toBe(true)
    expect(frameTouches(at(400, 20), area)).toBe(true)
    expect(frameTouches(at(603, 20), area)).toBe(false)
    expect(frameTouches(at(602, 20), area)).toBe(true)
    // 100 × 20 turned 90° about its centre spans x 245–265 only.
    expect(frameTouches(at(205, 100, 90), area)).toBe(false)
    expect(frameTouches(at(160, 100, 90), area)).toBe(false)
    expect(frameTouches(at(300, 20), { ...area, y: 31 })).toBe(false)
    expect(frameTouches(at(300, 20), { ...area, y: 30 })).toBe(false)
    expect(frameTouches(at(300, 20), { ...area, y: 29 })).toBe(true)
    expect(frameTouches(at(300, 20), { ...area, y: -200, height: 210 })).toBe(
      false,
    )
    expect(frameTouches(at(300, 20), { ...area, y: -200, height: 211 })).toBe(
      true,
    )
  })
})

describe('orientationMatrix', () => {
  // Where the raw top-left, top-right and bottom-left corners show.
  it.each([
    [1, [0, 0], [1, 0], [0, 1]],
    [2, [1, 0], [0, 0], [1, 1]],
    [3, [1, 1], [0, 1], [1, 0]],
    [4, [0, 1], [1, 1], [0, 0]],
    [5, [0, 0], [0, 1], [1, 0]],
    [6, [1, 0], [1, 1], [0, 0]],
    [7, [1, 1], [1, 0], [0, 1]],
    [8, [0, 1], [0, 0], [1, 1]],
  ])(
    'orientation %i shows the raw corners at %o, %o, %o',
    (orientation, topLeft, topRight, bottomLeft) => {
      const m = orientationMatrix(orientation)
      expect(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ].map((corner) => {
          const { x, y } = applyMatrix(m, corner)
          // `+ 0` folds -0 into 0.
          return [Math.round(x) + 0, Math.round(y) + 0]
        }),
      ).toEqual([topLeft, topRight, bottomLeft])
    },
  )

  it('turns the raw top-right corner like the EXIF rotation', () => {
    // 6: 90° clockwise, so the raw top-right lands bottom-right.
    close(applyMatrix(orientationMatrix(6), { x: 1, y: 0 }), 1, 1)
    close(applyMatrix(orientationMatrix(8), { x: 1, y: 0 }), 0, 0)
    close(applyMatrix(orientationMatrix(5), { x: 1, y: 0 }), 0, 1)
    close(applyMatrix(orientationMatrix(7), { x: 1, y: 0 }), 1, 0)
    expect(orientationMatrix(undefined)).toEqual(IDENTITY)
  })

  it('swaps the aspect for orientations 5–8 only', () => {
    expect(orientedAspect(400, 200, undefined)).toBe(2)
    expect(orientedAspect(400, 200, 4)).toBe(2)
    expect(orientedAspect(400, 200, 5)).toBe(0.5)
    expect(orientedAspect(400, 200, 8)).toBe(0.5)
  })
})

describe('imageMatrix', () => {
  const rectMm = { x: 0, y: 0, width: 40, height: 20 }

  it('fills the frame with the whole upright image (PDF image y up)', () => {
    const m = imageMatrix({ rectMm })
    close(applyMatrix(m, { x: 0, y: 1 }), 0, 0)
    close(applyMatrix(m, { x: 1, y: 0 }), 40, 20)
  })

  it('scales the crop window up to the frame', () => {
    const m = imageMatrix({
      rectMm,
      sourceCropRect: { x: 0.25, y: 0.5, width: 0.5, height: 0.25 },
    })
    // Window top-left (0.25, 0.5) is image space (0.25, 0.5) after the y flip.
    close(applyMatrix(m, { x: 0.25, y: 0.5 }), 0, 0)
    close(applyMatrix(m, { x: 0.75, y: 0.25 }), 40, 20)
  })

  it('turns, flips and orients the photo about the frame centre', () => {
    const turned = imageMatrix({ rectMm, photoQuarterTurns: 1 })
    // The image's top-left goes top-right after a clockwise quarter turn.
    close(applyMatrix(turned, { x: 0, y: 1 }), 40, 0)
    const flipped = imageMatrix({ rectMm, photoFlipH: true, photoFlipV: true })
    close(applyMatrix(flipped, { x: 0, y: 1 }), 40, 20)
    const tilted = imageMatrix({ rectMm, straightenDeg: 180 })
    close(applyMatrix(tilted, { x: 0, y: 1 }), 40, 20)
    // EXIF 6: the raw top-left shows top-right.
    close(applyMatrix(imageMatrix({ rectMm }, 6), { x: 0, y: 1 }), 40, 0)
  })
})
