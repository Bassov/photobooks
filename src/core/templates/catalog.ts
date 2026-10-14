import type { Book, Frame, Spread } from '../schema'
import { getSpreadSizeMm } from '../geometry/spreadSize'
import type { RectMm } from '../geometry/types'
import type { TemplateId } from './types'

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
  const grid = spread?.layoutGrid ?? book.layoutGrid
  const { margins, columnGutterMm: cg, rowGutterMm: rg } = grid

  const rects = (() => {
    switch (templateId) {
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
): RectMm {
  return {
    x: margins.left,
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

export function frameIdFor(spreadId: string, index: number): string {
  return `${spreadId}-f${String(index)}`
}
