import { sha256HexSync } from '../assets/sha256Sync'
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

/** Give every asset a content hash, so derivatives (site export) can encode. */
function withContentHashes(book: Book): Book {
  const assets: Book['assets'] = {}
  for (const [assetId, asset] of Object.entries(book.assets)) {
    assets[assetId] = { ...asset, contentHash: sha256HexSync(assetId) }
  }
  return { ...book, assets }
}

/**
 * Replace the in-memory book with the painter fixture and its preview URLs.
 * `&hashes=1` gives the photos content hashes (site export encodes them).
 * `&parent=a` makes Master A the book default, so all 40 spreads use it;
 * `&overrides=<n>` then has the first n spreads override its logo.
 */
export function loadPainterFixture(search = window.location.search): void {
  const fixture = makePainterFixture()
  const params = new URLSearchParams(search)
  const book =
    params.get('parent') === 'a'
      ? withLogoOverrides(
          { ...fixture.book, defaultParentId: 'painter-parent-a' },
          Number(params.get('overrides') ?? 0),
        )
      : fixture.book
  resetBookStore({
    book: params.get('hashes') === '1' ? withContentHashes(book) : book,
    sessionMeta: new Map(),
    previewUrls: fixture.previewUrls,
    importRunning: false,
    importExpectedCount: 0,
  })
  for (const assetId of PAINTER_ASSET_IDS) {
    retainAssetSource(assetId, painterSourceFile(assetId), { cover: true })
  }
}
