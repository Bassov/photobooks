import {
  makePainterFixture,
  PAINTER_ASSET_IDS,
} from '../core/testing/painterFixture'
import { resetBookStore } from '../editor/bookStore'
import { retainAssetSource } from '../photo/assetSources'
import { painterSourceFile } from './painterSourceFile'

/** Replace the in-memory book with the painter fixture and its preview URLs. */
export function loadPainterFixture(): void {
  const fixture = makePainterFixture()
  resetBookStore({
    book: fixture.book,
    sessionMeta: new Map(),
    previewUrls: fixture.previewUrls,
    importRunning: false,
    importExpectedCount: 0,
  })
  for (const assetId of PAINTER_ASSET_IDS) {
    retainAssetSource(assetId, painterSourceFile(assetId), { cover: true })
  }
}
