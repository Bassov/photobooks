import type { Book, Spread } from '../schema'
import { sourceCropRect as computeSourceCropRect } from './cropRect'
import { getPageCuts, getSpreadSizeMm } from './spreadSize'
import type { AspectRatioLookup, ResolvedItem, ResolvedSpread } from './types'

interface StructuralCache {
  settings: Book['settings']
  spreadCount: number
  spreadIndex: number
  items: Omit<ResolvedItem, 'sourceCropRect'>[]
  pageCuts: ResolvedSpread['pageCuts']
  spreadWidthMm: number
  spreadHeightMm: number
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
  const items: ResolvedItem[] = structural.items.map((item) => {
    if (item.assetId === undefined) {
      return { ...item }
    }
    const aspect = getAspectRatio(item.assetId)
    const frame = spread.frames.find(
      (candidate) => candidate.id === item.frameId,
    )
    return {
      ...item,
      sourceCropRect: computeSourceCropRect(item.rectMm, frame?.crop, aspect),
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
  const items: Omit<ResolvedItem, 'sourceCropRect'>[] = spread.frames.map(
    (frame) => {
      const base: Omit<ResolvedItem, 'sourceCropRect'> = {
        frameId: frame.id,
        rectMm: { ...frame.rect },
        z: frame.z,
        rotation: 0,
      }
      if (frame.assetId !== undefined) {
        return { ...base, assetId: frame.assetId }
      }
      return base
    },
  )

  const next: StructuralCache = {
    settings: book.settings,
    spreadCount,
    spreadIndex: index,
    items,
    pageCuts,
    spreadWidthMm: size.widthMm,
    spreadHeightMm: size.heightMm,
  }
  structuralMemo.set(spread, next)
  return next
}
