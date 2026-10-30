import type { Book, FrameStyle, Spread } from '../schema'
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
  const index = book.spreads.findIndex((spread) => spread.id === spreadId)
  if (index < 0) {
    return undefined
  }
  const spread = book.spreads[index]
  if (spread === undefined) {
    return undefined
  }

  const getAspectRatio = options.getAspectRatio ?? defaultAspect
  const structural = getStructural(book, spread, index)
  const items: ResolvedItem[] = structural.entries.map(({ item, frame }) => {
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
          )
    return {
      ...item,
      ...(quarterTurns > 0
        ? { photoQuarterTurns: quarterTurns as 1 | 2 | 3 }
        : {}),
      ...(straightenDeg === 0 ? {} : { straightenDeg }),
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
  const cached = structuralMemo.get(spread)
  if (
    cached?.settings === book.settings &&
    cached.frameStyles === book.frameStyles &&
    cached.spreadCount === spreadCount &&
    cached.spreadIndex === index
  ) {
    return cached
  }

  const size = getSpreadSizeMm(book, index)
  const pageCuts = getPageCuts(book, index)
  const entries: StructuralEntry[] = spread.frames.map((frame) => {
    const base: Omit<ResolvedItem, 'sourceCropRect'> = {
      frameId: frame.id,
      rectMm: { ...frame.rect },
      z: frame.z,
      rotation: frame.rotationDeg ?? 0,
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
  })

  const next: StructuralCache = {
    settings: book.settings,
    frameStyles: book.frameStyles,
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
