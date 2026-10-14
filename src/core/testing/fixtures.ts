import type { Book, Frame, Spread } from '../schema'
import { CURRENT_SCHEMA_VERSION } from '../schema'

export type BookOverrides = Partial<Omit<Book, 'settings' | 'layoutGrid'>> & {
  settings?: Partial<Book['settings']> & {
    trim?: Partial<Book['settings']['trim']>
  }
  layoutGrid?: Partial<Book['layoutGrid']> & {
    margins?: Partial<Book['layoutGrid']['margins']>
  }
}

export function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: 'frame-1',
    rect: { x: 10, y: 10, width: 100, height: 100 },
    z: 0,
    ...overrides,
  }
}

export function makeSpread(overrides: Partial<Spread> = {}): Spread {
  return {
    id: 'spread-1',
    frames: [makeFrame()],
    ...overrides,
  }
}

export function makeBook(overrides: BookOverrides = {}): Book {
  const {
    settings: settingsOverride,
    layoutGrid: layoutGridOverride,
    schemaVersion = CURRENT_SCHEMA_VERSION,
    id = 'book-1',
    guides = [],
    assets = {},
    gallery = [],
    spreads = [makeSpread()],
  } = overrides

  const settings: Book['settings'] = {
    bleedMm: settingsOverride?.bleedMm ?? 3,
    safeMarginMm: settingsOverride?.safeMarginMm ?? 5,
    trim: {
      widthMm: settingsOverride?.trim?.widthMm ?? 300,
      heightMm: settingsOverride?.trim?.heightMm ?? 300,
    },
  }

  const layoutGrid: Book['layoutGrid'] = {
    columns: layoutGridOverride?.columns ?? 2,
    rows: layoutGridOverride?.rows ?? 2,
    columnGutterMm: layoutGridOverride?.columnGutterMm ?? 5,
    rowGutterMm: layoutGridOverride?.rowGutterMm ?? 5,
    margins: {
      top: layoutGridOverride?.margins?.top ?? 15,
      right: layoutGridOverride?.margins?.right ?? 15,
      bottom: layoutGridOverride?.margins?.bottom ?? 15,
      left: layoutGridOverride?.margins?.left ?? 15,
    },
  }

  return {
    schemaVersion,
    id,
    settings,
    layoutGrid,
    guides,
    assets,
    gallery,
    spreads,
  }
}

export function makeBookWithAsset(
  assetId = 'asset-1',
  options: { place?: boolean } = {},
): Book {
  const place = options.place ?? true
  const frame = makeFrame(
    place ? { assetId, crop: { zoom: 1, center: { x: 0.5, y: 0.5 } } } : {},
  )
  return makeBook({
    assets: { [assetId]: {} },
    gallery: [assetId],
    spreads: [makeSpread({ frames: [frame] })],
  })
}
