import {
  editableSpread,
  resolveParentFrames,
  spreadParent,
} from '../parentSpreads'
import { bookDpiThresholds } from '../printProfile'
import type { Book, Frame, FrameStyle, Spread } from '../schema'
import { isTextFrame, resolveTextContent } from '../text/resolveText'
import { sourceCropRect as computeSourceCropRect } from './cropRect'
import { frameDpi, lowDpi } from './dpi'
import { getPageCuts, getSpreadSizeMm } from './spreadSize'
import type {
  AspectRatioLookup,
  ResolvedFrameStyle,
  ResolvedItem,
  ResolvedSpread,
} from './types'

interface StructuralCache {
  settings: Book['settings']
  frameStyles: Book['frameStyles']
  /** The parent layer paints its frames only; a grid / guide edit keeps them. */
  parentFrames: Frame[] | undefined
  spreadCount: number
  spreadIndex: number
  entries: StructuralEntry[]
  pageCuts: ResolvedSpread['pageCuts']
  spreadWidthMm: number
  spreadHeightMm: number
}

interface StructuralEntry {
  item: Omit<ResolvedItem, 'sourceCropRect'>
  frame: Spread['frames'][number]
}

const structuralMemo = new WeakMap<Spread, StructuralCache>()

const defaultAspect: AspectRatioLookup = () => 1

export interface ResolveSpreadOptions {
  getAspectRatio?: AspectRatioLookup
  /**
   * Decoded (EXIF-oriented) pixel size when known this session; falls back to
   * the asset record's `widthPx` / `heightPx`.
   */
  getPixelSize?: (
    assetId: string,
  ) => { widthPx: number; heightPx: number } | undefined
}

export function resolveSpread(
  book: Book,
  spreadId: string,
  options: ResolveSpreadOptions = {},
): ResolvedSpread | undefined {
  const found = editableSpread(book, spreadId)
  if (found === undefined) {
    return undefined
  }
  const { spread, index } = found

  const getAspectRatio = options.getAspectRatio ?? defaultAspect
  const structural = getStructural(book, spread, index)
  const dpiThresholds = bookDpiThresholds(book)
  const items: ResolvedItem[] = structural.entries.map(({ item, frame }) => {
    // Per call, not memoized: templates read the title and anchor meta.
    if (isTextFrame(frame)) {
      const { text, styleId, align } = resolveTextContent(book, spread, frame)
      return { ...item, text: { text, styleId, align } }
    }
    if (item.assetId === undefined) {
      return { ...item }
    }
    const aspect = getAspectRatio(item.assetId)
    const quarterTurns = frame.crop?.quarterTurns ?? 0
    const straightenDeg = frame.crop?.straightenDeg ?? 0
    const sourceCropRect = computeSourceCropRect(
      item.rectMm,
      frame.crop,
      aspect,
      frame.fit,
    )
    const asset = book.assets[item.assetId]
    const size =
      options.getPixelSize?.(item.assetId) ??
      (asset?.widthPx === undefined || asset.heightPx === undefined
        ? undefined
        : { widthPx: asset.widthPx, heightPx: asset.heightPx })
    const low =
      size === undefined
        ? undefined
        : lowDpi(
            frameDpi(
              item.rectMm,
              sourceCropRect,
              quarterTurns,
              size.widthPx,
              size.heightPx,
            ),
            dpiThresholds,
          )
    return {
      ...item,
      ...(quarterTurns > 0
        ? { photoQuarterTurns: quarterTurns as 1 | 2 | 3 }
        : {}),
      ...(straightenDeg === 0 ? {} : { straightenDeg }),
      ...(frame.crop?.flipH === true ? { photoFlipH: true as const } : {}),
      ...(frame.crop?.flipV === true ? { photoFlipV: true as const } : {}),
      sourceCropRect,
      ...(low === undefined ? {} : { lowDpi: low }),
    }
  })

  const background = spread.backgroundColor ?? book.settings.pageColor
  return {
    items,
    ...(background === undefined ? {} : { backgroundColor: background }),
    pageCuts: structural.pageCuts,
    spreadWidthMm: structural.spreadWidthMm,
    spreadHeightMm: structural.spreadHeightMm,
  }
}

function getStructural(
  book: Book,
  spread: Spread,
  index: number,
): StructuralCache {
  const spreadCount = book.spreads.length
  const parentFrames = spreadParent(book, spread)?.frames
  const cached = structuralMemo.get(spread)
  if (
    cached?.settings === book.settings &&
    cached.frameStyles === book.frameStyles &&
    cached.parentFrames === parentFrames &&
    cached.spreadCount === spreadCount &&
    cached.spreadIndex === index
  ) {
    return cached
  }

  const size = getSpreadSizeMm(book, index)
  const pageCuts = getPageCuts(book, index)
  // Parent layer first (painted beneath), then the spread's frames as stored.
  const inherited = resolveParentFrames(book, spread).filter(
    ({ layer }) => layer !== 'spread',
  )
  const entries: StructuralEntry[] = [
    ...inherited.map(({ frame }) => structuralEntry(book, frame, true)),
    ...spread.frames.map((frame) => structuralEntry(book, frame, false)),
  ]

  const next: StructuralCache = {
    settings: book.settings,
    frameStyles: book.frameStyles,
    parentFrames,
    spreadCount,
    spreadIndex: index,
    entries,
    pageCuts,
    spreadWidthMm: size.widthMm,
    spreadHeightMm: size.heightMm,
  }
  structuralMemo.set(spread, next)
  return next
}

function structuralEntry(
  book: Book,
  frame: Frame,
  parent: boolean,
): StructuralEntry {
  const base: Omit<ResolvedItem, 'sourceCropRect'> = {
    frameId: frame.id,
    rectMm: { ...frame.rect },
    z: frame.z,
    rotation: frame.rotationDeg ?? 0,
  }
  if (parent) {
    base.parent = true
  }
  if (frame.locked === true) {
    base.locked = true
  }
  const style =
    frame.frameStyleId === undefined
      ? undefined
      : book.frameStyles[frame.frameStyleId]
  if (style !== undefined) {
    base.style = resolveFrameStyle(style)
  }
  if (frame.caption !== undefined) {
    base.caption = frame.caption
  }
  if (frame.adjust !== undefined) {
    base.adjust = frame.adjust
  }
  if (frame.assetId !== undefined) {
    return { item: { ...base, assetId: frame.assetId }, frame }
  }
  return { item: base, frame }
}

/** Fills the defaults of a stored style; colors stay absent when unset. */
function resolveFrameStyle(style: FrameStyle): ResolvedFrameStyle {
  return {
    strokeMm: style.strokeMm ?? 0,
    ...(style.strokeColor === undefined
      ? {}
      : { strokeColor: style.strokeColor }),
    matMm: style.matMm ?? 0,
    ...(style.matColor === undefined ? {} : { matColor: style.matColor }),
    cornerRadiusMm: style.cornerRadiusMm ?? 0,
  }
}
