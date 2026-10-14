import type { Book } from '../schema'
import { addToGallery } from '../ops/gallery'
import { placeAsset } from '../ops/place'
import { addSpread } from '../ops/spreads'
import { applyTemplate } from '../templates/apply'
import { makeBook } from './fixtures'

export const PAINTER_SPREAD_COUNT = 40

export const PAINTER_ASSET_IDS = [
  'painter-a',
  'painter-b',
  'painter-c',
  'painter-d',
] as const

const PREVIEW_FILLS = ['#6b8f71', '#c4a574', '#8a9a84', '#d07a5a'] as const

export interface PainterFixture {
  book: Book
  previewUrls: ReadonlyMap<string, string>
}

export function makePainterFixture(): PainterFixture {
  let book = makeBook({
    id: 'painter-fixture',
    spreads: [],
    gallery: [],
    assets: {},
  })
  book = addToGallery(book, PAINTER_ASSET_IDS)

  for (let index = 0; index < PAINTER_SPREAD_COUNT; index += 1) {
    book = addSpread(book, { id: `painter-spread-${String(index)}` })
  }
  // Templates must run after every spread exists so interior spreads are two pages wide.
  for (let index = 0; index < PAINTER_SPREAD_COUNT; index += 1) {
    const spreadId = `painter-spread-${String(index)}`
    book = applyTemplate(book, spreadId, '4-grid')
    const spread = book.spreads[index]
    if (spread === undefined) {
      throw new Error(`missing spread ${spreadId}`)
    }
    for (
      let frameIndex = 0;
      frameIndex < spread.frames.length;
      frameIndex += 1
    ) {
      if (index === 0 && frameIndex === 0) {
        continue
      }
      const frame = spread.frames[frameIndex]
      const assetId = PAINTER_ASSET_IDS[frameIndex]
      if (frame === undefined || assetId === undefined) {
        throw new Error(`missing frame ${String(frameIndex)} on ${spreadId}`)
      }
      book = placeAsset(book, spreadId, frame.id, assetId)
    }
  }

  const previewUrls = new Map<string, string>()
  for (let index = 0; index < PAINTER_ASSET_IDS.length; index += 1) {
    const assetId = PAINTER_ASSET_IDS[index]
    const fill = PREVIEW_FILLS[index]
    if (assetId === undefined || fill === undefined) {
      continue
    }
    previewUrls.set(assetId, previewDataUrl(fill))
  }

  return { book, previewUrls }
}

function previewDataUrl(fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${fill}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
