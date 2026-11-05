import { overrideParentFrame, type Book } from '../core'
import {
  makePainterFixture,
  PAINTER_ASSET_IDS,
} from '../core/testing/painterFixture'
import { resetBookStore } from '../editor/bookStore'
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

/**
 * Replace the in-memory book with the painter fixture and its preview URLs.
 * `&parent=a` makes Master A the book default, so all 40 spreads use it;
 * `&overrides=<n>` then has the first n spreads override its logo, and
 * `&guides=a` gives Master A two guides.
 */
export function loadPainterFixture(search = window.location.search): void {
  const fixture = makePainterFixture()
  const params = new URLSearchParams(search)
  const base =
    params.get('guides') === 'a' ? withMasterGuides(fixture.book) : fixture.book
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
}
