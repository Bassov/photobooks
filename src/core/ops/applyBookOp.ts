import type { Book, Frame } from '../schema'
import type { GridPatch } from '../grid/layoutGrid'
import { applyTemplate } from '../templates/apply'
import type { TemplateId } from '../templates/types'
import {
  addToGallery,
  removeFromGallery,
  removeManyFromGallery,
} from './gallery'
import { resetCrop, setCrop, setFit } from './crop'
import { addFrame, removeFrames, setFrameRect } from './frames'
import {
  alignFrames,
  distributeFrames,
  moveFrame,
  resizeFrame,
  rotateFrame,
  type AlignEdge,
  type DistributeAxis,
} from './transform'
import { fillSpread, insertSpreadWithAssets } from './fill'
import { placeAsset, replaceAsset, swapFrames, unplaceAsset } from './place'
import { resetSpreadGrid, setBookGrid, setSpreadGrid } from './grid'
import { addSpread, duplicateSpread, moveSpread, removeSpread } from './spreads'

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
      type: 'setFit'
      spreadId: string
      frameId: string
      fit: NonNullable<Frame['fit']>
    }
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
  | { type: 'duplicateSpread'; spreadId: string; id?: string }
  | { type: 'moveSpread'; spreadId: string; toIndex: number }
  | {
      type: 'addFrame'
      spreadId: string
      rect: Frame['rect']
      id?: string
    }
  | { type: 'removeFrames'; spreadId: string; frameIds: readonly string[] }
  | {
      type: 'setFrameRect'
      spreadId: string
      frameId: string
      rect: Frame['rect']
    }
  | {
      type: 'moveFrame'
      spreadId: string
      frameId: string
      dx: number
      dy: number
    }
  | {
      type: 'resizeFrame'
      spreadId: string
      frameId: string
      rect: Frame['rect']
    }
  | {
      type: 'rotateFrame'
      spreadId: string
      frameId: string
      rotationDeg: number
    }
  | {
      type: 'alignFrames'
      spreadId: string
      frameIds: readonly string[]
      edge: AlignEdge
    }
  | {
      type: 'distributeFrames'
      spreadId: string
      frameIds: readonly string[]
      axis: DistributeAxis
    }
  | { type: 'setTitle'; title: string }
  | { type: 'setBookGrid'; patch: GridPatch }
  | { type: 'setSpreadGrid'; spreadId: string; patch: GridPatch }
  | { type: 'resetSpreadGrid'; spreadId: string }

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
    case 'setFit':
      return setFit(book, op.spreadId, op.frameId, op.fit)
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
    case 'duplicateSpread':
      return duplicateSpread(
        book,
        op.spreadId,
        op.id === undefined ? {} : { id: op.id },
      )
    case 'moveSpread':
      return moveSpread(book, op.spreadId, op.toIndex)
    case 'setBookGrid':
      return setBookGrid(book, op.patch)
    case 'setSpreadGrid':
      return setSpreadGrid(book, op.spreadId, op.patch)
    case 'resetSpreadGrid':
      return resetSpreadGrid(book, op.spreadId)
    case 'addFrame':
      return addFrame(book, op.spreadId, op.rect, op.id)
    case 'removeFrames':
      return removeFrames(book, op.spreadId, op.frameIds)
    case 'setFrameRect':
      return setFrameRect(book, op.spreadId, op.frameId, op.rect)
    case 'moveFrame':
      return moveFrame(book, op.spreadId, op.frameId, op.dx, op.dy)
    case 'resizeFrame':
      return resizeFrame(book, op.spreadId, op.frameId, op.rect)
    case 'rotateFrame':
      return rotateFrame(book, op.spreadId, op.frameId, op.rotationDeg)
    case 'alignFrames':
      return alignFrames(book, op.spreadId, op.frameIds, op.edge)
    case 'distributeFrames':
      return distributeFrames(book, op.spreadId, op.frameIds, op.axis)
    case 'setTitle': {
      if (book.title === op.title) {
        return book
      }
      return { ...book, title: op.title }
    }
  }
}
