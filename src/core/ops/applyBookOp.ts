import type { Book, Frame, Spread } from '../schema'
import { resolveTextContent } from '../text/resolveText'
import type { GridField, GridPatch } from '../grid/layoutGrid'
import { applyCustomLayout, applyTemplate } from '../templates/apply'
import type { LayoutSlotPct, SavedTemplate } from '../templates/custom'
import type { TemplateId } from '../templates/types'
import {
  addParent,
  hideParentItem,
  overrideParentFrame,
  overrideParentGuide,
  removeParent,
  renameParent,
  resetParentItem,
  resetSpreadToParent,
  setDefaultParent,
} from '../parentSpreads'
import { setSpreadBackground, setSpreadParent } from './spreadLook'
import {
  addToGallery,
  removeFromGallery,
  removeManyFromGallery,
} from './gallery'
import { resetCrop, setCrop, setFit } from './crop'
import {
  addFrame,
  addTextFrame,
  editText,
  removeFrames,
  setFrameRect,
  setTextAlign,
  setTextAnchor,
  setTextLive,
  setTextStyle,
} from './frames'
import {
  alignFrames,
  distributeFrames,
  moveFrame,
  moveFrames,
  resizeFrame,
  rotateFrame,
  type AlignEdge,
  type DistributeAxis,
} from './transform'
import {
  reorderFrame,
  reorderFrames,
  setFrameLocked,
  setFramesLocked,
  type ZMove,
} from './arrange'
import { fillSpread, insertSpreadWithAssets } from './fill'
import { placeAsset, replaceAsset, swapFrames, unplaceAsset } from './place'
import {
  resetSpreadGrid,
  resetSpreadGridFields,
  setBookGrid,
  setSpreadGrid,
} from './grid'
import {
  setCoverPhoto,
  setCoverStyle,
  setCoverText,
  setEndpaperPhoto,
  setEndpapersEnabled,
  setEndpapersSame,
  setPageColor,
  type CoverPanelName,
} from '../cover'
import type {
  CoverStyle,
  FrameAdjust,
  FrameStyle,
  PageNumbering,
  TextStyleId,
} from '../schema'
import {
  setPageNumbering,
  setParentPageNumbers,
  syncPageNumbers,
  type PageNumberPosition,
} from '../pageNumbers'
import type { PrintProfile } from '../print/profileSchema'
import { setPrintProfile, setTrim } from './bookSettings'
import {
  applyFrameStyle,
  editFrameStyle,
  newFrameStyleFromFrame,
  setFrameAdjust,
  setFrameCaption,
} from './frameLook'
import { addGuide, moveGuide, removeGuide } from './guides'
import {
  addSpread,
  duplicateSpread,
  moveSpread,
  removeSpread,
  setPageCount,
} from './spreads'

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
      /** The user's saved layouts best fit may pick, in save order. */
      templates: readonly SavedTemplate[]
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
  | { type: 'setPageCount'; pages: number }
  | { type: 'duplicateSpread'; spreadId: string; id?: string }
  | { type: 'moveSpread'; spreadId: string; toIndex: number }
  | {
      type: 'addFrame'
      spreadId: string
      rect: Frame['rect']
      id?: string
    }
  | {
      type: 'addTextFrame'
      spreadId: string
      rect: Frame['rect']
      id?: string
    }
  | {
      type: 'editText'
      spreadId: string
      frameId: string
      text: string
      /** Whole-line height the text needs; grows the box (capped at the paper). */
      fitHeightMm?: number
    }
  | {
      type: 'setTextStyle'
      spreadId: string
      frameId: string
      styleId: TextStyleId
    }
  | {
      type: 'setTextAlign'
      spreadId: string
      frameId: string
      align: NonNullable<Frame['align']>
    }
  | { type: 'setTextLive'; spreadId: string; frameId: string; live: boolean }
  | {
      type: 'setTextAnchor'
      spreadId: string
      frameId: string
      anchorFrameId: string
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
      type: 'moveFrames'
      spreadId: string
      frameIds: readonly string[]
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
      /** Slider drags: consecutive live rotations of one frame share an undo step. */
      live?: boolean
    }
  | {
      type: 'reorderFrame'
      spreadId: string
      frameId: string
      move: ZMove
    }
  | {
      type: 'reorderFrames'
      spreadId: string
      frameIds: readonly string[]
      move: ZMove
    }
  | {
      type: 'setFrameLocked'
      spreadId: string
      frameId: string
      locked: boolean
    }
  | {
      type: 'setFramesLocked'
      spreadId: string
      frameIds: readonly string[]
      locked: boolean
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
  | { type: 'setCoverText'; panel: CoverPanelName; text: string }
  | { type: 'setCoverPhoto'; assetId: string }
  | { type: 'setCoverStyle'; patch: Partial<CoverStyle> }
  | { type: 'setTrim'; widthMm: number; heightMm: number }
  | {
      type: 'setPrintProfile'
      id: string
      /** The library's custom profiles (a custom `id` resolves here). */
      customs?: readonly PrintProfile[]
    }
  | { type: 'setEndpapersEnabled'; enabled: boolean }
  | { type: 'setEndpapersSame'; same: boolean }
  | {
      type: 'setEndpaperPhoto'
      side: 'front' | 'back'
      assetId: string | undefined
    }
  | { type: 'setPageColor'; color: string | undefined }
  | {
      type: 'setFrameCaption'
      spreadId: string
      frameId: string
      caption: string
    }
  | {
      type: 'setFrameAdjust'
      spreadId: string
      frameId: string
      /** `null` resets all three. */
      patch: Partial<FrameAdjust> | null
    }
  | {
      type: 'applyFrameStyle'
      spreadId: string
      frameId: string
      styleId: string | undefined
    }
  | { type: 'editFrameStyle'; styleId: string; patch: Partial<FrameStyle> }
  | { type: 'newFrameStyle'; spreadId: string; frameId: string }
  | { type: 'setBookGrid'; patch: GridPatch }
  | { type: 'setSpreadGrid'; spreadId: string; patch: GridPatch }
  | { type: 'resetSpreadGrid'; spreadId: string }
  | {
      type: 'resetSpreadGridFields'
      spreadId: string
      fields: readonly GridField[]
    }
  | {
      type: 'addGuide'
      spreadId: string
      orientation: 'horizontal' | 'vertical'
      offsetMm: number
      id?: string
    }
  | { type: 'moveGuide'; spreadId: string; guideId: string; offsetMm: number }
  | { type: 'removeGuide'; spreadId: string; guideId: string }
  | {
      type: 'applyCustomLayout'
      spreadId: string
      templateId: string
      slots: readonly LayoutSlotPct[]
      pages: 1 | 2
    }
  | { type: 'setSpreadBackground'; spreadId: string; color: string | undefined }
  | { type: 'setSpreadParent'; spreadId: string; parentId: string | null }
  | { type: 'addParent'; id?: string }
  | { type: 'renameParent'; parentId: string; name: string }
  | { type: 'removeParent'; parentId: string }
  | { type: 'setDefaultParent'; parentId: string | null }
  | {
      type: 'overrideParentFrame'
      spreadId: string
      parentFrameId: string
      id?: string
    }
  | {
      type: 'overrideParentGuide'
      spreadId: string
      parentGuideId: string
      id?: string
    }
  | { type: 'hideParentItem'; spreadId: string; parentItemId: string }
  | { type: 'resetParentItem'; spreadId: string; parentItemId: string }
  | { type: 'resetSpreadToParent'; spreadId: string }
  | {
      type: 'setParentPageNumbers'
      parentId: string
      position: PageNumberPosition | null
    }
  | { type: 'setPageNumbering'; patch: Partial<PageNumbering> }

/** A text frame's anchor must name an image frame of its own spread. */
function anchorHolds(spread: Spread, frame: Frame): boolean {
  const anchorId = frame.anchorFrameId
  if (anchorId === undefined) {
    return true
  }
  const anchor = spread.frames.find((candidate) => candidate.id === anchorId)
  return anchor !== undefined && anchor.kind !== 'text'
}

/**
 * `frame` as static text, resolved against its spread in `before` (where the
 * anchor still exists), with the anchor removed.
 */
function frozen(before: Book, spread: Spread, frame: Frame): Frame {
  const was = before.spreads.find((candidate) => candidate.id === spread.id)
  const { text } = resolveTextContent(before, was ?? spread, frame)
  const next: Frame = { ...frame, content: { type: 'static', text } }
  delete next.anchorFrameId
  return next
}

/**
 * Live captions whose anchor the op removed become static with the text
 * they painted before it, so `bad-text-anchor` never fires. Only spreads
 * the op replaced are visited.
 */
function normaliseAnchors(before: Book, after: Book): Book {
  if (after.spreads === before.spreads) {
    return after
  }
  let spreads: Spread[] | undefined
  after.spreads.forEach((spread, index) => {
    if (
      before.spreads[index] === spread ||
      spread.frames.every((f) => anchorHolds(spread, f))
    ) {
      return
    }
    spreads ??= [...after.spreads]
    spreads[index] = {
      ...spread,
      frames: spread.frames.map((frame) =>
        anchorHolds(spread, frame) ? frame : frozen(before, spread, frame),
      ),
    }
  })
  return spreads === undefined ? after : { ...after, spreads }
}

export function applyBookOp(book: Book, op: BookOp): Book {
  return normaliseAnchors(book, applyRaw(book, op))
}

function applyRaw(book: Book, op: BookOp): Book {
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
      return insertSpreadWithAssets(book, op.index, op.assetIds, op.templates)
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
    case 'setPageCount':
      return setPageCount(book, op.pages)
    case 'duplicateSpread':
      return duplicateSpread(
        book,
        op.spreadId,
        op.id === undefined ? {} : { id: op.id },
      )
    case 'moveSpread':
      return moveSpread(book, op.spreadId, op.toIndex)
    case 'setCoverText':
      return setCoverText(book, op.panel, op.text)
    case 'setCoverPhoto':
      return setCoverPhoto(book, op.assetId)
    case 'setCoverStyle':
      return setCoverStyle(book, op.patch)
    case 'setTrim':
      return syncPageNumbers(
        setTrim(book, { widthMm: op.widthMm, heightMm: op.heightMm }),
      )
    case 'setPrintProfile':
      return setPrintProfile(book, op.id, op.customs)
    case 'setEndpapersEnabled':
      return setEndpapersEnabled(book, op.enabled)
    case 'setEndpapersSame':
      return setEndpapersSame(book, op.same)
    case 'setEndpaperPhoto':
      return setEndpaperPhoto(book, op.side, op.assetId)
    case 'setPageColor':
      return setPageColor(book, op.color)
    case 'setFrameCaption':
      return setFrameCaption(book, op.spreadId, op.frameId, op.caption)
    case 'setFrameAdjust':
      return setFrameAdjust(book, op.spreadId, op.frameId, op.patch)
    case 'applyFrameStyle':
      return applyFrameStyle(book, op.spreadId, op.frameId, op.styleId)
    case 'editFrameStyle':
      return editFrameStyle(book, op.styleId, op.patch)
    case 'newFrameStyle':
      return newFrameStyleFromFrame(book, op.spreadId, op.frameId)
    // Grid edits reaching a parent move its folios with the margins.
    case 'setBookGrid':
      return syncPageNumbers(setBookGrid(book, op.patch))
    case 'setSpreadGrid':
      return syncPageNumbers(setSpreadGrid(book, op.spreadId, op.patch))
    case 'resetSpreadGrid':
      return syncPageNumbers(resetSpreadGrid(book, op.spreadId))
    case 'resetSpreadGridFields':
      return syncPageNumbers(
        resetSpreadGridFields(book, op.spreadId, op.fields),
      )
    case 'addGuide':
      return addGuide(book, op.spreadId, {
        orientation: op.orientation,
        offsetMm: op.offsetMm,
        id: op.id,
      })
    case 'moveGuide':
      return moveGuide(book, op.spreadId, op.guideId, op.offsetMm)
    case 'removeGuide':
      return removeGuide(book, op.spreadId, op.guideId)
    case 'applyCustomLayout':
      return applyCustomLayout(
        book,
        op.spreadId,
        op.templateId,
        op.slots,
        op.pages,
      )
    case 'setSpreadBackground':
      return setSpreadBackground(book, op.spreadId, op.color)
    case 'setSpreadParent':
      return setSpreadParent(book, op.spreadId, op.parentId)
    case 'addParent':
      return addParent(book, op.id)
    case 'renameParent':
      return renameParent(book, op.parentId, op.name)
    case 'removeParent':
      return removeParent(book, op.parentId)
    case 'setDefaultParent':
      return setDefaultParent(book, op.parentId)
    case 'overrideParentFrame':
      return overrideParentFrame(book, op.spreadId, op.parentFrameId, op.id)
    case 'overrideParentGuide':
      return overrideParentGuide(book, op.spreadId, op.parentGuideId, op.id)
    case 'hideParentItem':
      return hideParentItem(book, op.spreadId, op.parentItemId)
    case 'resetParentItem':
      return resetParentItem(book, op.spreadId, op.parentItemId)
    case 'resetSpreadToParent':
      return resetSpreadToParent(book, op.spreadId)
    case 'setParentPageNumbers':
      return setParentPageNumbers(book, op.parentId, op.position)
    case 'setPageNumbering':
      return setPageNumbering(book, op.patch)
    case 'addFrame':
      return addFrame(book, op.spreadId, op.rect, op.id)
    case 'addTextFrame':
      return addTextFrame(book, op.spreadId, op.rect, op.id)
    case 'editText':
      return editText(book, op.spreadId, op.frameId, op.text, op.fitHeightMm)
    case 'setTextLive':
      return setTextLive(book, op.spreadId, op.frameId, op.live)
    case 'setTextAnchor':
      return setTextAnchor(book, op.spreadId, op.frameId, op.anchorFrameId)
    case 'setTextStyle':
      return setTextStyle(book, op.spreadId, op.frameId, op.styleId)
    case 'setTextAlign':
      return setTextAlign(book, op.spreadId, op.frameId, op.align)
    case 'removeFrames':
      return removeFrames(book, op.spreadId, op.frameIds)
    case 'setFrameRect':
      return setFrameRect(book, op.spreadId, op.frameId, op.rect)
    case 'moveFrame':
      return moveFrame(book, op.spreadId, op.frameId, op.dx, op.dy)
    case 'moveFrames':
      return moveFrames(book, op.spreadId, op.frameIds, op.dx, op.dy)
    case 'resizeFrame':
      return resizeFrame(book, op.spreadId, op.frameId, op.rect)
    case 'rotateFrame':
      return rotateFrame(book, op.spreadId, op.frameId, op.rotationDeg)
    case 'reorderFrame':
      return reorderFrame(book, op.spreadId, op.frameId, op.move)
    case 'reorderFrames':
      return reorderFrames(book, op.spreadId, op.frameIds, op.move)
    case 'setFrameLocked':
      return setFrameLocked(book, op.spreadId, op.frameId, op.locked)
    case 'setFramesLocked':
      return setFramesLocked(book, op.spreadId, op.frameIds, op.locked)
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
