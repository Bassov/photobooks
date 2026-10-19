import { addToGallery } from '../ops/gallery'
import { placeAsset } from '../ops/place'
import type { Book, Frame, Spread } from '../schema'
import { CURRENT_SCHEMA_VERSION } from '../schema'
import { applyTemplate } from '../templates/apply'
import type { TemplateId } from '../templates/types'

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
    title,
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
    ...(title === undefined ? {} : { title }),
    settings,
    layoutGrid,
    guides,
    assets,
    gallery,
    spreads,
  }
}

export function makePlacedTemplateBook(
  templateId: TemplateId,
  assetIds: readonly string[],
): Book {
  let book = applyTemplate(
    addToGallery(makeBook(), assetIds),
    'spread-1',
    templateId,
  )
  const frames = book.spreads[0]?.frames ?? []
  for (let index = 0; index < assetIds.length; index += 1) {
    const frame = frames[index]
    const assetId = assetIds[index]
    if (frame === undefined || assetId === undefined) {
      break
    }
    book = placeAsset(book, 'spread-1', frame.id, assetId)
  }
  return book
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

/** Large book for benches: `spreadCount` spreads and `assetCount` gallery assets. */
export function largeBook(spreadCount = 40, assetCount = 1000): Book {
  const assets: Book['assets'] = {}
  const gallery: string[] = []
  for (let i = 0; i < assetCount; i += 1) {
    const id = `asset-${String(i)}`
    assets[id] = {}
    gallery.push(id)
  }

  const spreads: Spread[] = []
  for (let s = 0; s < spreadCount; s += 1) {
    const spreadId = `spread-${String(s)}`
    const frames: Frame[] = []
    for (let f = 0; f < 4; f += 1) {
      const assetId = gallery[(s * 4 + f) % gallery.length]
      frames.push(
        makeFrame({
          id: `${spreadId}-f${String(f)}`,
          z: f,
          rect: {
            x: 10 + f * 5,
            y: 10 + f * 5,
            width: 80,
            height: 80,
          },
          ...(assetId === undefined
            ? {}
            : { assetId, crop: { zoom: 1, center: { x: 0.5, y: 0.5 } } }),
        }),
      )
    }
    spreads.push(makeSpread({ id: spreadId, frames }))
  }

  return makeBook({ assets, gallery, spreads })
}
