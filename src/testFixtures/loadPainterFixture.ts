import {
  makePainterFixture,
  PAINTER_ASSET_IDS,
} from '../core/testing/painterFixture'
import { resetBookStore } from '../editor/bookStore'
import { retainAssetSource } from '../photo/assetSources'
import { painterSourceFile } from './painterSourceFile'

/**
 * Replace the in-memory book with the painter fixture and its preview URLs.
 * `&parent=a` makes Master A the book default, so all 40 spreads use it.
 */
export function loadPainterFixture(search = window.location.search): void {
  const fixture = makePainterFixture()
  const book =
    new URLSearchParams(search).get('parent') === 'a'
      ? { ...fixture.book, defaultParentId: 'painter-parent-a' }
      : fixture.book
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
