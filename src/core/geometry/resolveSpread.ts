import type { Book, Spread } from '../schema'
import { sourceCropRect as computeSourceCropRect } from './cropRect'
import { getPageCuts, getSpreadSizeMm } from './spreadSize'
import type { AspectRatioLookup, ResolvedItem, ResolvedSpread } from './types'

interface StructuralCache {
  settings: Book['settings']
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
    return {
      ...item,
      ...(quarterTurns > 0
        ? { photoQuarterTurns: quarterTurns as 1 | 2 | 3 }
        : {}),
      ...(straightenDeg === 0 ? {} : { straightenDeg }),
      sourceCropRect: computeSourceCropRect(
        item.rectMm,
        frame.crop,
        aspect,
        frame.fit,
      ),
    }
  })

  return {
    items,
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
    if (frame.assetId !== undefined) {
      return { item: { ...base, assetId: frame.assetId }, frame }
    }
    return { item: base, frame }
  })

  const next: StructuralCache = {
    settings: book.settings,
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
