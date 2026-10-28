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
  const {
    widthMm: W,
    heightMm: H,
    pageCount,
  } = getSpreadSizeMm(book, spreadIndex)
  const bleed = book.settings.bleedMm
  const grid = resolveLayoutGrid(book, spread)
  const { margins, columnGutterMm: cg, rowGutterMm: rg } = grid

  const contact = parseContactSheetId(templateId)
  const rects = (() => {
    if (contact !== null) {
      return contactSheetRects(W, H, pageCount, margins, cg, rg, contact)
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
        return onePerPageRects(W, H, pageCount, margins)
      case '2-up':
        return twoUpRects(W, H, margins, cg)
      case '4-grid':
        return fourGridRects(W, H, margins, cg, rg)
      case 'two-portraits':
        return twoPortraitsRects(W, H, pageCount, margins, cg)
      case 'landscape-two-portraits':
        return landscapeTwoPortraitsRects(W, H, pageCount, margins, cg, rg)
    }
  })()

  return rects.map((rect, index) => ({
    id: frameIdFor(spread?.id ?? `spread-${String(spreadIndex)}`, index),
    rect,
    z: index,
  }))
}

function onePerPageRects(
  W: number,
  H: number,
  pageCount: 1 | 2,
  margins: Book['layoutGrid']['margins'],
): RectMm[] {
  if (pageCount === 1) {
    return [
      {
        x: margins.left,
        y: margins.top,
        width: W - margins.left - margins.right,
        height: H - margins.top - margins.bottom,
      },
    ]
  }
  const pageW = W / 2
  return [
    {
      x: margins.left,
      y: margins.top,
      width: pageW - margins.left - margins.right,
      height: H - margins.top - margins.bottom,
    },
    {
      x: pageW + margins.left,
      y: margins.top,
      width: pageW - margins.left - margins.right,
      height: H - margins.top - margins.bottom,
    },
  ]
}

function contentBox(
  W: number,
  H: number,
  margins: Book['layoutGrid']['margins'],
  offsetX = 0,
): RectMm {
  return {
    x: offsetX + margins.left,
    y: margins.top,
    width: W - margins.left - margins.right,
    height: H - margins.top - margins.bottom,
  }
}

function twoUpRects(
  W: number,
  H: number,
  margins: Book['layoutGrid']['margins'],
  columnGutterMm: number,
): RectMm[] {
  const box = contentBox(W, H, margins)
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
  W: number,
  H: number,
  margins: Book['layoutGrid']['margins'],
  columnGutterMm: number,
  rowGutterMm: number,
): RectMm[] {
  const box = contentBox(W, H, margins)
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

function pageBoxes(
  W: number,
  H: number,
  pageCount: 1 | 2,
  margins: Book['layoutGrid']['margins'],
): [RectMm] | [RectMm, RectMm] {
  if (pageCount === 1) {
    return [contentBox(W, H, margins)]
  }
  return [contentBox(W / 2, H, margins), contentBox(W / 2, H, margins, W / 2)]
}

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

function twoPortraitsRects(
  W: number,
  H: number,
  pageCount: 1 | 2,
  margins: Book['layoutGrid']['margins'],
  columnGutterMm: number,
): RectMm[] {
  const boxes = pageBoxes(W, H, pageCount, margins)
  const cells =
    boxes.length === 2 ? boxes : splitColumns(boxes[0], columnGutterMm)
  return cells.map((cell) => fitAspect(cell, PORTRAIT_RATIO))
}

function landscapeTwoPortraitsRects(
  W: number,
  H: number,
  pageCount: 1 | 2,
  margins: Book['layoutGrid']['margins'],
  columnGutterMm: number,
  rowGutterMm: number,
): RectMm[] {
  const [left, right] = pageBoxes(W, H, pageCount, margins)
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
  W: number,
  H: number,
  pageCount: 1 | 2,
  margins: Book['layoutGrid']['margins'],
  columnGutterMm: number,
  rowGutterMm: number,
  { cols, rows }: { cols: number; rows: number },
): RectMm[] {
  const rects: RectMm[] = []
  for (const box of pageBoxes(W, H, pageCount, margins)) {
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
