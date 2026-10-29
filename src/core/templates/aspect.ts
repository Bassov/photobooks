import type { Book, Spread } from '../schema'
import type { RectMm } from '../geometry/types'
import { generateTemplateFrames } from './catalog'
import type { TemplateId } from './types'

export type AspectClass = 'portrait' | 'landscape' | 'square'

const SQUARE_TOLERANCE = 0.05

function aspectClass(width: number, height: number): AspectClass {
  const ratio = width / height
  if (Math.abs(ratio - 1) <= SQUARE_TOLERANCE) {
    return 'square'
  }
  return ratio < 1 ? 'portrait' : 'landscape'
}

export function slotAspect(rect: RectMm): AspectClass {
  return aspectClass(rect.width, rect.height)
}

/**
 * Class of photo dims. Asset `widthPx`/`heightPx` are already EXIF-oriented
 * (extractAssetMetadata), so no orientation swap happens here.
 */
export function photoAspectClass(
  widthPx: number,
  heightPx: number,
): AspectClass {
  return aspectClass(widthPx, heightPx)
}

export function templateSlotAspects(
  templateId: TemplateId,
  book: Book,
  spreadIndex: number,
  spread?: Spread,
): AspectClass[] {
  return generateTemplateFrames(templateId, book, spreadIndex, spread).map(
    (frame) => slotAspect(frame.rect),
  )
}
