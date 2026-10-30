import type { Book, Frame, Spread } from '../schema'
import { resolveLayoutGrid } from '../grid/layoutGrid'
import { getSpreadSizeMm } from '../geometry/spreadSize'
import type { RectMm } from '../geometry/types'
import {
  parseContactSheetId,
  type FixedTemplateId,
  type TemplateId,
} from './types'

export function generateTemplateFrames(
  templateId: TemplateId,
  book: Book,
  spreadIndex: number,
  spread?: Spread,
): Frame[] {
  const { widthMm: W, heightMm: H } = getSpreadSizeMm(book, spreadIndex)
  const bleed = book.settings.bleedMm
  const { values, pages } = resolveLayoutGrid(book, spreadIndex, spread)
  const boxes: Boxes =
    pages.length === 2
      ? [pages[0].content, pages[1].content]
      : [pages[0].content]
  const cg = values.columnGutterMm
  const rg = values.rowGutterMm

  const contact = parseContactSheetId(templateId)
  const rects = (() => {
    if (contact !== null) {
      return contactSheetRects(boxes, cg, rg, contact)
    }
    switch (templateId as FixedTemplateId) {
      case 'full-bleed':
        return [
          {
            x: -bleed,
            y: -bleed,
            width: W + 2 * bleed,
            height: H + 2 * bleed,
          },
        ]
      case 'one-per-page':
        return boxes
      case '2-up':
        return twoUpRects(spanBox(boxes), cg)
      case '4-grid':
        return fourGridRects(spanBox(boxes), cg, rg)
      case 'two-portraits':
        return twoPortraitsRects(boxes, cg)
      case 'landscape-two-portraits':
        return landscapeTwoPortraitsRects(boxes, cg, rg)
    }
  })()

  return rects.map((rect, index) => ({
    id: frameIdFor(spread?.id ?? `spread-${String(spreadIndex)}`, index),
    rect,
    z: index,
  }))
}

/** Outer edges of the page content boxes: the whole spread inside its margins. */
type Boxes = [RectMm] | [RectMm, RectMm]

function spanBox(boxes: Boxes): RectMm {
  const first = boxes[0]
  const last = boxes.length === 2 ? boxes[1] : first
  return { ...first, width: last.x + last.width - first.x }
}

function twoUpRects(box: RectMm, columnGutterMm: number): RectMm[] {
  const colW = (box.width - columnGutterMm) / 2
  return [
    { x: box.x, y: box.y, width: colW, height: box.height },
    {
      x: box.x + colW + columnGutterMm,
      y: box.y,
      width: colW,
      height: box.height,
    },
  ]
}

function fourGridRects(
  box: RectMm,
  columnGutterMm: number,
  rowGutterMm: number,
): RectMm[] {
  const cellW = (box.width - columnGutterMm) / 2
  const cellH = (box.height - rowGutterMm) / 2
  return [
    { x: box.x, y: box.y, width: cellW, height: cellH },
    {
      x: box.x + cellW + columnGutterMm,
      y: box.y,
      width: cellW,
      height: cellH,
    },
    {
      x: box.x,
      y: box.y + cellH + rowGutterMm,
      width: cellW,
      height: cellH,
    },
    {
      x: box.x + cellW + columnGutterMm,
      y: box.y + cellH + rowGutterMm,
      width: cellW,
      height: cellH,
    },
  ]
}

const PORTRAIT_RATIO = 3 / 4
const LANDSCAPE_RATIO = 3 / 2

function splitColumns(box: RectMm, gutterMm: number): [RectMm, RectMm] {
  const width = (box.width - gutterMm) / 2
  return [
    { ...box, width },
    { ...box, x: box.x + width + gutterMm, width },
  ]
}

function fitAspect(cell: RectMm, ratio: number): RectMm {
  const width = Math.min(cell.width, cell.height * ratio)
  const height = width / ratio
  return {
    x: cell.x + (cell.width - width) / 2,
    y: cell.y + (cell.height - height) / 2,
    width,
    height,
  }
}

function twoPortraitsRects(boxes: Boxes, columnGutterMm: number): RectMm[] {
  const cells =
    boxes.length === 2 ? boxes : splitColumns(boxes[0], columnGutterMm)
  return cells.map((cell) => fitAspect(cell, PORTRAIT_RATIO))
}

function landscapeTwoPortraitsRects(
  boxes: Boxes,
  columnGutterMm: number,
  rowGutterMm: number,
): RectMm[] {
  const left = boxes[0]
  const right = boxes[1]
  let landscapeCell = left
  let portraitBox = right ?? left
  if (right === undefined) {
    const half = (left.height - rowGutterMm) / 2
    landscapeCell = { ...left, height: half }
    portraitBox = { ...left, y: left.y + half + rowGutterMm, height: half }
  }
  const [a, b] = splitColumns(portraitBox, columnGutterMm)
  return [
    fitAspect(landscapeCell, LANDSCAPE_RATIO),
    fitAspect(a, PORTRAIT_RATIO),
    fitAspect(b, PORTRAIT_RATIO),
  ]
}

function contactSheetRects(
  boxes: Boxes,
  columnGutterMm: number,
  rowGutterMm: number,
  { cols, rows }: { cols: number; rows: number },
): RectMm[] {
  const rects: RectMm[] = []
  for (const box of boxes) {
    const cellW = (box.width - columnGutterMm * (cols - 1)) / cols
    const cellH = (box.height - rowGutterMm * (rows - 1)) / rows
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        rects.push({
          x: box.x + c * (cellW + columnGutterMm),
          y: box.y + r * (cellH + rowGutterMm),
          width: cellW,
          height: cellH,
        })
      }
    }
  }
  return rects
}

export function frameIdFor(spreadId: string, index: number): string {
  return `${spreadId}-f${String(index)}`
}
