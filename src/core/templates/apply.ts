import type { Book, Frame } from '../schema'
import { updateSpread } from '../update'
import { generateTemplateFrames } from './catalog'
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

  return updateSpread(book, spreadId, (spread) => {
    const generated = generateTemplateFrames(
      templateId,
      book,
      spreadIndex,
      spread,
    )
    const frames = rebindFrames(generated, spread.frames)
    if (
      spread.templateId === templateId &&
      framesEqualByContent(frames, spread.frames)
    ) {
      return spread
    }
    return { ...spread, templateId, frames }
  })
}

function rebindFrames(generated: Frame[], previous: Frame[]): Frame[] {
  return generated.map((frame, index) => {
    const prev = previous[index]
    if (prev === undefined) {
      return frame
    }
    const next: Frame = {
      id: prev.id,
      rect: frame.rect,
      z: frame.z,
    }
    if (prev.assetId !== undefined) {
      next.assetId = prev.assetId
    }
    if (prev.crop !== undefined) {
      next.crop = prev.crop
    }
    return next
  })
}

function framesEqualByContent(a: Frame[], b: Frame[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]
    const right = b[i]
    if (left === undefined || right === undefined) {
      return false
    }
    if (
      left.id !== right.id ||
      left.z !== right.z ||
      left.assetId !== right.assetId ||
      left.rect.x !== right.rect.x ||
      left.rect.y !== right.rect.y ||
      left.rect.width !== right.rect.width ||
      left.rect.height !== right.rect.height ||
      JSON.stringify(left.crop) !== JSON.stringify(right.crop)
    ) {
      return false
    }
  }
  return true
}
