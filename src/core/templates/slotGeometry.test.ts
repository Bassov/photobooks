import { describe, expect, it } from 'vitest'
import {
  bestTemplateId,
  generateTemplateFrames,
  parseContactSheetId,
  photoAspectClass,
} from '../index'
import { makeBook, makeSpread } from '../testing/fixtures'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const margins = { top: 10, bottom: 12, left: 8, right: 14 }
const COL_GUTTER = 4
const ROW_GUTTER = 6

function gridBook(spreads = 1) {
  return makeBook({
    spreads: Array.from({ length: spreads }, (_, i) =>
      makeSpread({ id: `s${String(i)}` }),
    ),
    layoutGrid: {
      margins,
      columnGutterMm: COL_GUTTER,
      rowGutterMm: ROW_GUTTER,
    },
  })
}

function boxFor(book: ReturnType<typeof gridBook>, page: 0 | 1, pages: 1 | 2) {
  const trimW = book.settings.trim.widthMm
  const trimH = book.settings.trim.heightMm
  return {
    x: (pages === 2 ? trimW * page : 0) + margins.left,
    y: margins.top,
    width: trimW - margins.left - margins.right,
    height: trimH - margins.top - margins.bottom,
  }
}

function fit(cell: Box, ratio: number): Box {
  const width = Math.min(cell.width, cell.height * ratio)
  const height = width / ratio
  return {
    x: cell.x + (cell.width - width) / 2,
    y: cell.y + (cell.height - height) / 2,
    width,
    height,
  }
}

function expectRects(actual: readonly { rect: Box }[], expected: Box[]) {
  expect(actual).toHaveLength(expected.length)
  for (const [i, want] of expected.entries()) {
    const got = actual[i]?.rect
    expect(got?.x).toBeCloseTo(want.x, 6)
    expect(got?.y).toBeCloseTo(want.y, 6)
    expect(got?.width).toBeCloseTo(want.width, 6)
    expect(got?.height).toBeCloseTo(want.height, 6)
  }
}

describe('exact template geometry', () => {
  it('contact sheet cells follow gutters on a one-page spread', () => {
    const book = gridBook()
    const box = boxFor(book, 0, 1)
    const cols = 3
    const rows = 2
    const cellW = (box.width - COL_GUTTER * (cols - 1)) / cols
    const cellH = (box.height - ROW_GUTTER * (rows - 1)) / rows
    const expected: Box[] = []
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        expected.push({
          x: box.x + c * (cellW + COL_GUTTER),
          y: box.y + r * (cellH + ROW_GUTTER),
          width: cellW,
          height: cellH,
        })
      }
    }
    expectRects(generateTemplateFrames('contact-3x2', book, 0), expected)
  })

  it('two-portraits fits 3:4 cells split by the column gutter', () => {
    const book = gridBook()
    const box = boxFor(book, 0, 1)
    const w = (box.width - COL_GUTTER) / 2
    expectRects(generateTemplateFrames('two-portraits', book, 0), [
      fit({ ...box, width: w }, 3 / 4),
      fit({ ...box, x: box.x + w + COL_GUTTER, width: w }, 3 / 4),
    ])
  })

  it('landscape-two-portraits stacks 3:2 over two 3:4 on one page', () => {
    const book = gridBook()
    const box = boxFor(book, 0, 1)
    const half = (box.height - ROW_GUTTER) / 2
    const lower = { ...box, y: box.y + half + ROW_GUTTER, height: half }
    const w = (box.width - COL_GUTTER) / 2
    expectRects(generateTemplateFrames('landscape-two-portraits', book, 0), [
      fit({ ...box, height: half }, 3 / 2),
      fit({ ...lower, width: w }, 3 / 4),
      fit({ ...lower, x: lower.x + w + COL_GUTTER, width: w }, 3 / 4),
    ])
  })

  it('landscape-two-portraits puts landscape left and portraits right on two pages', () => {
    const book = gridBook(3)
    const left = boxFor(book, 0, 2)
    const right = boxFor(book, 1, 2)
    const w = (right.width - COL_GUTTER) / 2
    expectRects(generateTemplateFrames('landscape-two-portraits', book, 1), [
      fit(left, 3 / 2),
      fit({ ...right, width: w }, 3 / 4),
      fit({ ...right, x: right.x + w + COL_GUTTER, width: w }, 3 / 4),
    ])
  })
})

describe('parsing and orientation edges', () => {
  it('rejects ids with extra prefix, suffix or non-digits', () => {
    for (const id of [
      'xcontact-3x4',
      'contact-3x4x',
      'contact-3x4 ',
      'contact-3ax4',
      'contact-3x4a',
      'contact-a3x4',
    ]) {
      expect(parseContactSheetId(id)).toBeNull()
    }
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'does not swap already-oriented dims again for EXIF orientation %i',
    (orientation) => {
      expect(photoAspectClass(4000, 3000, orientation)).toBe('landscape')
      expect(photoAspectClass(3000, 4000, orientation)).toBe('portrait')
    },
  )

  it('uses four rows when the per-page count needs them', () => {
    const book = gridBook(3)
    expect(bestTemplateId(book, 1, Array(32).fill('landscape'))).toBe(
      'contact-4x4',
    )
  })
})
