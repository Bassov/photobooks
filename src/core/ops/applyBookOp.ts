import type { Book, Frame } from '../schema'
import { applyTemplate } from '../templates/apply'
import type { TemplateId } from '../templates/types'
import {
  addToGallery,
  removeFromGallery,
  removeManyFromGallery,
} from './gallery'
import { resetCrop, setCrop } from './crop'
import { fillSpread, insertSpreadWithAssets } from './fill'
import { placeAsset, replaceAsset, swapFrames, unplaceAsset } from './place'
import { addSpread, moveSpread, removeSpread } from './spreads'

export type BookOp =
  | { type: 'addToGallery'; assetIds: readonly string[] }
  | { type: 'removeFromGallery'; assetId: string }
  | { type: 'removeManyFromGallery'; assetIds: readonly string[] }
  | {
      type: 'place'
      spreadId: string
      frameId: string
      assetId: string
    }
  | {
      type: 'replace'
      spreadId: string
      frameId: string
      assetId: string
    }
  | { type: 'unplace'; spreadId: string; frameId: string }
  | {
      type: 'fillSpread'
      spreadId: string
      frameId: string
      assetIds: readonly string[]
    }
  | {
      type: 'insertSpreadWithAssets'
      index: number
      assetIds: readonly string[]
    }
  | {
      type: 'setCrop'
      spreadId: string
      frameId: string
      crop: NonNullable<Frame['crop']>
    }
  | { type: 'resetCrop'; spreadId: string; frameId: string }
  | {
      type: 'swap'
      spreadIdA: string
      frameIdA: string
      spreadIdB: string
      frameIdB: string
    }
  | {
      type: 'applyTemplate'
      spreadId: string
      templateId: TemplateId
    }
  | { type: 'addSpread'; index?: number; id?: string; templateId?: string }
  | { type: 'removeSpread'; spreadId: string }
  | { type: 'moveSpread'; spreadId: string; toIndex: number }
  | { type: 'setTitle'; title: string }

export function applyBookOp(book: Book, op: BookOp): Book {
  switch (op.type) {
    case 'addToGallery':
      return addToGallery(book, op.assetIds)
    case 'removeFromGallery':
      return removeFromGallery(book, op.assetId)
    case 'removeManyFromGallery':
      return removeManyFromGallery(book, op.assetIds)
    case 'place':
      return placeAsset(book, op.spreadId, op.frameId, op.assetId)
    case 'replace':
      return replaceAsset(book, op.spreadId, op.frameId, op.assetId)
    case 'unplace':
      return unplaceAsset(book, op.spreadId, op.frameId)
    case 'fillSpread':
      return fillSpread(book, op.spreadId, op.frameId, op.assetIds)
    case 'insertSpreadWithAssets':
      return insertSpreadWithAssets(book, op.index, op.assetIds)
    case 'setCrop':
      return setCrop(book, op.spreadId, op.frameId, op.crop)
    case 'resetCrop':
      return resetCrop(book, op.spreadId, op.frameId)
    case 'swap':
      return swapFrames(
        book,
        op.spreadIdA,
        op.frameIdA,
        op.spreadIdB,
        op.frameIdB,
      )
    case 'applyTemplate':
      return applyTemplate(book, op.spreadId, op.templateId)
    case 'addSpread': {
      const options: { index?: number; id?: string; templateId?: string } = {}
      if (op.index !== undefined) {
        options.index = op.index
      }
      if (op.id !== undefined) {
        options.id = op.id
      }
      if (op.templateId !== undefined) {
        options.templateId = op.templateId
      }
      return addSpread(book, options)
    }
    case 'removeSpread':
      return removeSpread(book, op.spreadId)
    case 'moveSpread':
      return moveSpread(book, op.spreadId, op.toIndex)
    case 'setTitle': {
      if (book.title === op.title) {
        return book
      }
      return { ...book, title: op.title }
    }
  }
}
