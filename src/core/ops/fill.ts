import { pagesOf } from '../pages'
import type { Book, Frame, Spread } from '../schema'
import { placementCountByAsset } from '../selectors/placements'
import { applyCustomLayout, applyTemplate } from '../templates/apply'
import { photoAspectClass, type AspectClass } from '../templates/aspect'
import { bestLayout } from '../templates/best'
import type { SavedTemplate } from '../templates/custom'
import { findSpreadFrame, updateFrame, updateSpread } from '../update'
import { takesPhoto, withPlacedAsset } from './place'
import { addSpread, nextSpreadId } from './spreads'

type Asset = Book['assets'][string]

interface UsableAsset {
  id: string
  asset: Asset
}

/** Gallery assets only, first occurrence wins, caller order kept. */
function usableAssets(book: Book, assetIds: readonly string[]): UsableAsset[] {
  const seen = new Set<string>()
  const usable: UsableAsset[] = []
  for (const id of assetIds) {
    const asset = book.assets[id]
    if (asset === undefined || seen.has(id) || !book.gallery.includes(id)) {
      continue
    }
    seen.add(id)
    usable.push({ id, asset })
  }
  return usable
}

function withAsset(frame: Frame, assetId: string): Frame {
  if (frame.assetId === assetId) {
    return frame
  }
  return withPlacedAsset(frame, assetId)
}

function fillFrames(
  book: Book,
  spreadId: string,
  firstFrameId: string | undefined,
  assetIds: readonly string[],
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const first = spread.frames.findIndex((frame) => frame.id === firstFrameId)
    const order: number[] = first < 0 ? [] : [first]
    spread.frames.forEach((frame, index) => {
      // A locked or text frame never takes a photo.
      if (index !== first && frame.assetId === undefined && takesPhoto(frame)) {
        order.push(index)
      }
    })
    const frames = spread.frames.map((frame, index) => {
      const assetId = assetIds[order.indexOf(index)]
      return assetId === undefined ? frame : withAsset(frame, assetId)
    })
    return { ...spread, frames }
  })
}

/**
 * Place photos in order: the target frame first (replaced if filled), then the
 * remaining empty unlocked frames in frame order. Extra photos are ignored; a
 * locked target leaves the book as is.
 */
export function fillSpread(
  book: Book,
  spreadId: string,
  frameId: string,
  assetIds: readonly string[],
): Book {
  const spread = book.spreads.find((candidate) => candidate.id === spreadId)
  const target =
    spread === undefined ? spread : findSpreadFrame(spread, frameId)
  if (target === undefined || !takesPhoto(target)) {
    return book
  }
  const usable = usableAssets(book, assetIds)
  const [first, ...rest] = usable.map(({ id }) => id)
  if (first === undefined) {
    return book
  }
  if (spread?.frames.includes(target) !== true) {
    // A local copy of a parent item takes the first photo, own frames the rest.
    const placed = updateFrame(book, spreadId, frameId, (frame) =>
      withAsset(frame, first),
    )
    return fillFrames(placed, spreadId, undefined, rest)
  }
  return fillFrames(book, spreadId, frameId, [first, ...rest])
}

function assetAspectClass({ asset }: UsableAsset): AspectClass {
  const { widthPx, heightPx } = asset
  return widthPx === undefined || heightPx === undefined
    ? 'square'
    : photoAspectClass(widthPx, heightPx)
}

/**
 * Insert a spread at `index` with the best-fit template (a builtin or one of
 * the user's `saved` layouts) and place photos in order.
 */
export function insertSpreadWithAssets(
  book: Book,
  index: number,
  assetIds: readonly string[],
  saved: readonly SavedTemplate[],
): Book {
  const usable = usableAssets(book, assetIds)
  if (usable.length === 0) {
    return book
  }
  return insertFilledSpread(book, index, usable, saved)
}

function insertFilledSpread(
  book: Book,
  index: number,
  usable: readonly UsableAsset[],
  saved: readonly SavedTemplate[],
): Book {
  const spreadId = nextSpreadId(book)
  const added = addSpread(book, { index, id: spreadId })
  const at = Math.max(0, Math.min(index, book.spreads.length))
  const layout = bestLayout(added, at, usable.map(assetAspectClass), saved)
  const templated =
    typeof layout === 'string'
      ? applyTemplate(added, spreadId, layout)
      : applyCustomLayout(
          added,
          spreadId,
          layout.id,
          layout.slots,
          layout.pages,
        )
  return fillFrames(
    templated,
    spreadId,
    undefined,
    usable.map(({ id }) => id),
  )
}

/** What `fillBook` will do, for the confirm popover. */
export interface FillBookPlan {
  /** Photos for empty frames: spreads before the last one, then the last page. */
  intoFrames: number
  onNewSpreads: number
  newSpreads: number
  /** Photos that don't fit: the tail of the order. */
  leftover: number
  pagesBefore: number
  pagesAfter: number
  maxPages: number
}

interface FrameSlot {
  spreadId: string
  frameId: string
}

interface FillLayout {
  plan: FillBookPlan
  usable: readonly UsableAsset[]
  /** Empty frames of the spreads before the last one (E), in reading order. */
  early: readonly FrameSlot[]
  /** Empty frames of the single last page (L). */
  last: readonly FrameSlot[]
  intoEarly: number
}

/**
 * Empty own photo frames in reading order: left page, then right page, then
 * top (rounded to 1 mm), then left, on the unrotated rect.
 */
function emptyFrameSlots(book: Book, spread: Spread): FrameSlot[] {
  const pageWidth = book.settings.trim.widthMm
  const page = (frame: Frame): number => (frame.rect.x >= pageWidth ? 1 : 0)
  return spread.frames
    .filter((frame) => frame.assetId === undefined && takesPhoto(frame))
    .sort(
      (a, b) =>
        page(a) - page(b) ||
        Math.round(a.rect.y) - Math.round(b.rect.y) ||
        a.rect.x - b.rect.x,
    )
    .map((frame) => ({ spreadId: spread.id, frameId: frame.id }))
}

function layoutFill(
  book: Book,
  assetIds: readonly string[],
  maxPages: number,
): FillLayout {
  const counts = placementCountByAsset(book)
  const usable = usableAssets(book, assetIds).filter(
    ({ id }) => !counts.has(id),
  )
  const spreadCount = book.spreads.length
  const early = book.spreads
    .slice(0, -1)
    .flatMap((spread) => emptyFrameSlots(book, spread))
  const lastSpread = spreadCount >= 2 ? book.spreads.at(-1) : undefined
  const last = lastSpread === undefined ? [] : emptyFrameSlots(book, lastSpread)
  const count = usable.length
  const needed = Math.max(0, count - early.length - last.length)
  const pagesBefore = pagesOf(spreadCount)
  const room = Math.max(0, Math.floor((maxPages - pagesBefore) / 2))
  const newSpreads = Math.min(Math.ceil(needed / 2), room)
  const onNewSpreads = Math.min(needed, 2 * newSpreads)
  const intoEarly = Math.min(count, early.length)
  // New spreads only come when every L frame gets a photo too.
  const intoLast = Math.min(count - intoEarly, last.length)
  return {
    plan: {
      intoFrames: intoEarly + intoLast,
      onNewSpreads,
      newSpreads,
      leftover: count - intoEarly - onNewSpreads - intoLast,
      pagesBefore,
      pagesAfter: pagesOf(spreadCount + newSpreads),
      maxPages,
    },
    usable,
    early,
    last,
    intoEarly,
  }
}

/** Place `usable` in order into `slots` until either runs out. */
function placeInSlots(
  book: Book,
  slots: readonly FrameSlot[],
  usable: readonly UsableAsset[],
): Book {
  let next = book
  for (const [index, { spreadId, frameId }] of slots.entries()) {
    const asset = usable[index]
    if (asset === undefined) {
      break
    }
    next = updateFrame(next, spreadId, frameId, (frame) =>
      withPlacedAsset(frame, asset.id),
    )
  }
  return next
}

/**
 * Numbers of `fillBook(book, assetIds, saved, maxPages)`: `assetIds` are the
 * caller's ordered unplaced photos; placed or non-gallery ids are dropped.
 */
export function planFillBook(
  book: Book,
  assetIds: readonly string[],
  maxPages: number,
): FillBookPlan {
  return layoutFill(book, assetIds, maxPages).plan
}

/**
 * Place unplaced photos in order: the empty frames of the spreads before the
 * last one, then new best-fit spreads of 2 photos inserted before the last
 * page (within `maxPages`), then the last page's empty frames. Filled frames,
 * cover, endpapers and master items are left as they are.
 */
export function fillBook(
  book: Book,
  assetIds: readonly string[],
  saved: readonly SavedTemplate[],
  maxPages: number,
): Book {
  const { plan, usable, early, last, intoEarly } = layoutFill(
    book,
    assetIds,
    maxPages,
  )
  let next = placeInSlots(book, early, usable)
  const firstIndex = Math.max(1, book.spreads.length - 1)
  const onNewEnd = intoEarly + plan.onNewSpreads
  for (let k = 0; k < plan.newSpreads; k += 1) {
    const start = intoEarly + 2 * k
    const chunk = usable.slice(start, Math.min(start + 2, onNewEnd))
    next = insertFilledSpread(next, firstIndex + k, chunk, saved)
  }
  return placeInSlots(next, last, usable.slice(onNewEnd))
}
