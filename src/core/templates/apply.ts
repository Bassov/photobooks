import { getSpreadPageCount } from '../geometry/spreadSize'
import type { Book, Frame, Spread } from '../schema'
import { isTextFrame } from '../text/resolveText'
import { updateSpread } from '../update'
import { frameIdFor, generateTemplateFrames } from './catalog'
import {
  customLayoutRects,
  isCustomLayoutId,
  type LayoutSlotPct,
} from './custom'
import type { TemplateId } from './types'

export function applyTemplate(
  book: Book,
  spreadId: string,
  templateId: TemplateId,
): Book {
  const spreadIndex = book.spreads.findIndex((spread) => spread.id === spreadId)
  if (spreadIndex < 0) {
    return book
  }

  return updateSpread(book, spreadId, (spread) =>
    templatedSpread(book, spreadIndex, spread, templateId),
  )
}

/**
 * The spread at `spreadIndex` laid out by `templateId`; the same object (and
 * the same frame objects) when the generated geometry is unchanged.
 */
export function templatedSpread(
  book: Book,
  spreadIndex: number,
  spread: Spread,
  templateId: TemplateId,
): Spread {
  const generated = generateTemplateFrames(
    templateId,
    book,
    spreadIndex,
    spread,
  )
  return withLayout(spread, templateId, generated)
}

/**
 * Kit applyTemplate for a saved layout: its slots scaled to this spread. A
 * layout saved on another page count (`pages`) leaves the book unchanged.
 */
export function applyCustomLayout(
  book: Book,
  spreadId: string,
  templateId: string,
  slots: readonly LayoutSlotPct[],
  pages: 1 | 2,
): Book {
  const spreadIndex = book.spreads.findIndex((spread) => spread.id === spreadId)
  // An unknown spread falls through: `updateSpread` returns the book as is.
  if (
    slots.length === 0 ||
    !isCustomLayoutId(templateId) ||
    pages !== getSpreadPageCount(spreadIndex, book.spreads.length)
  ) {
    return book
  }
  const rects = customLayoutRects(book, spreadIndex, slots)
  return updateSpread(book, spreadId, (spread) =>
    withLayout(
      spread,
      templateId,
      rects.map((rect, index) => ({
        id: frameIdFor(spread.id, index),
        rect,
        z: index,
      })),
    ),
  )
}

function withLayout(
  spread: Spread,
  templateId: string,
  generated: Frame[],
): Spread {
  const frames = rebindFrames(generated, spread.frames)
  if (
    spread.templateId === templateId &&
    frames.length === spread.frames.length &&
    frames.every((frame, index) => frame === spread.frames[index])
  ) {
    return spread
  }
  return { ...spread, templateId, frames }
}

/** Photo settings a layout change carries over; it only moves frames. */
const KEPT_FIELDS = [
  'assetId',
  'crop',
  'fit',
  'adjust',
  'caption',
  'frameStyleId',
  'locked',
] as const satisfies readonly (keyof Frame)[]

/**
 * Generated geometry on the previous image frames (by index); an unmoved frame
 * stays the same object. A moved frame keeps its photo settings and takes the
 * template's rect and z; its rotation resets (templates are unrotated). Text
 * frames keep their box and content and stay on top, in their relative order.
 */
function rebindFrames(generated: Frame[], previous: Frame[]): Frame[] {
  const images = previous.filter((frame) => !isTextFrame(frame))
  const laid = generated.map((frame, index) => {
    const prev = images[index]
    if (prev === undefined) {
      return frame
    }
    if (
      prev.z === frame.z &&
      prev.rotationDeg === undefined &&
      rectsEqual(prev.rect, frame.rect)
    ) {
      return prev
    }
    const next: Frame = {
      id: prev.id,
      rect: frame.rect,
      z: frame.z,
    }
    for (const key of KEPT_FIELDS) {
      copyDefined(next, prev, key)
    }
    return next
  })
  return [...laid, ...textsAbove(laid, previous.filter(isTextFrame))]
}

function copyDefined<K extends keyof Frame>(
  to: Pick<Frame, K>,
  from: Pick<Frame, K>,
  key: K,
): void {
  if (from[key] !== undefined) {
    to[key] = from[key]
  }
}

/** Text frames above every laid frame; unchanged when they already are. */
function textsAbove(laid: Frame[], texts: Frame[]): Frame[] {
  const top = laid.reduce((max, frame) => Math.max(max, frame.z), 0)
  if (texts.every((frame) => frame.z > top)) {
    return texts
  }
  return texts
    .toSorted((a, b) => a.z - b.z)
    .map((frame, index) => ({ ...frame, z: top + 1 + index }))
}

function rectsEqual(a: Frame['rect'], b: Frame['rect']): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  )
}
