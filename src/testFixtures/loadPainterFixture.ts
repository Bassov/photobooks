import {
  applyBookOp,
  overrideParentFrame,
  type Book,
  type BookOp,
} from '../core'
import {
  makePainterFixture,
  PAINTER_ASSET_IDS,
} from '../core/testing/painterFixture'
import { resetBookStore } from '../editor/bookStore'
import { seedPrintProfilesFromQuery } from '../editor/printProfilesStore'
import { retainAssetSource } from '../photo/assetSources'
import { painterSourceFile } from './painterSourceFile'

/** The first `count` spreads override the Master A logo with a local copy. */
function withLogoOverrides(book: Book, count: number): Book {
  return book.spreads
    .slice(0, count)
    .reduce(
      (next, spread) =>
        overrideParentFrame(next, spread.id, 'painter-parent-logo'),
      book,
    )
}

/** Every painter asset records a `px` × 3/4 `px` source, so print profiles flag low-res photos. */
function withPixelSize(book: Book, px: number): Book {
  if (!(px > 0)) {
    return book
  }
  const assets = { ...book.assets }
  for (const assetId of PAINTER_ASSET_IDS) {
    assets[assetId] = {
      ...assets[assetId],
      widthPx: px,
      heightPx: Math.round((px * 3) / 4),
    }
  }
  return { ...book, assets }
}

/** Master A with a horizontal guide at mid height and a vertical one on the right page. */
function withMasterGuides(book: Book): Book {
  return {
    ...book,
    parents: book.parents?.map((parent) =>
      parent.id === 'painter-parent-a'
        ? {
            ...parent,
            guides: [
              {
                id: 'painter-parent-guide-h',
                orientation: 'horizontal',
                offsetMm: 150,
              },
              {
                id: 'painter-parent-guide-v',
                orientation: 'vertical',
                offsetMm: 420,
              },
            ],
          }
        : parent,
    ),
  }
}

/** Spread 2 of the painter fixture: four filled image frames. */
export const PAINTER_CAPTION_SPREAD_ID = 'painter-spread-1'

/**
 * EXIF-like metadata on the painter photos, and a live caption
 * (`{title} · {date}`) over the lower part of each of spread 2's `count`
 * image frames, anchored to it.
 */
function withLiveCaptions(book: Book, count: number): Book {
  if (count <= 0) {
    return book
  }
  const assets: Book['assets'] = Object.fromEntries(
    PAINTER_ASSET_IDS.map((assetId, index) => [
      assetId,
      {
        ...book.assets[assetId],
        capturedAt: `2025-07-${String(10 + index)}T08:35:00`,
        meta: { title: `Photo ${assetId}`, camera: 'Canon EOS R5' },
      },
    ]),
  )
  const frames = book.spreads
    .filter((spread) => spread.id === PAINTER_CAPTION_SPREAD_ID)
    .flatMap((spread) => spread.frames.slice(0, count))
  return frames.reduce(
    (next, frame, index) => {
      const id = `painter-caption-${String(index)}`
      const { x, y, width, height } = frame.rect
      const at = { spreadId: PAINTER_CAPTION_SPREAD_ID, frameId: id }
      const ops: BookOp[] = [
        {
          type: 'addTextFrame',
          spreadId: PAINTER_CAPTION_SPREAD_ID,
          rect: { x, y: y + height - 12, width, height: 10 },
          id,
        },
        { type: 'editText', ...at, text: '{title} · {date}' },
        { type: 'setTextLive', ...at, live: true },
      ]
      return ops.reduce(applyBookOp, next)
    },
    { ...book, assets },
  )
}

/**
 * Replace the in-memory book with the painter fixture and its preview URLs.
 * `&parent=a` makes Master A the book default, so all 40 spreads use it;
 * `&overrides=<n>` then has the first n spreads override its logo,
 * `&guides=a` gives Master A two guides and `&captions=<n>` puts n live
 * captions on spread 2; `&px=<n>` records an n px wide source on every
 * painter asset, and `&printProfiles=kit` adds the kit's sample profile.
 */
export function loadPainterFixture(search = window.location.search): void {
  const fixture = makePainterFixture()
  const params = new URLSearchParams(search)
  const captioned = withLiveCaptions(
    withPixelSize(fixture.book, Number(params.get('px') ?? 0)),
    Number(params.get('captions') ?? 0),
  )
  const base =
    params.get('guides') === 'a' ? withMasterGuides(captioned) : captioned
  const book =
    params.get('parent') === 'a'
      ? withLogoOverrides(
          { ...base, defaultParentId: 'painter-parent-a' },
          Number(params.get('overrides') ?? 0),
        )
      : base
  resetBookStore({
    book,
    sessionMeta: new Map(),
    previewUrls: fixture.previewUrls,
    importRunning: false,
    importExpectedCount: 0,
  })
  for (const assetId of PAINTER_ASSET_IDS) {
    retainAssetSource(assetId, painterSourceFile(assetId), { cover: true })
  }
  seedPrintProfilesFromQuery(search)
}
