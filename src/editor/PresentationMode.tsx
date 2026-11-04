import { useState, useSyncExternalStore } from 'react'
import { bookSpineWidthMm } from '../core'
import { CoverView } from '../render/CoverView'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { SpreadPager } from '../render/SpreadPager'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import {
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  subscribeBookStore,
} from './bookStore'
import { useTierPreviewUrl } from './useTierPreviewUrl'

function readBook() {
  return getBookStoreSnapshot().book
}

/** The cover slide at the spreads' px / mm, so the pager fits it the same way. */
function PresentationCover() {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const { url, tier } = useTierPreviewUrl(
    book.cover.front.assetId,
    'cover:preview',
  )
  const widthMm = 2 * book.settings.trim.widthMm + bookSpineWidthMm(book)
  return (
    <div
      data-testid="presentation-cover"
      style={{ width: widthMm * SPREAD_PX_PER_MM }}
    >
      <CoverView book={book} frontUrl={url} frontTier={tier} />
    </div>
  )
}

/** Pager position: the cover, then spreads numbered from 1. */
function presentationPosition(index: number, spreads: number): string {
  return index === 0 ? 'Cover' : `${String(index)} / ${String(spreads)}`
}

/**
 * Fullscreen reader: the cover, then the editor's SpreadView one spread at a
 * time. Owner Must M53 (round 7): it always opens on the cover (kit `#/demo`
 * preview opens on `site-cover`).
 */
export function PresentationMode({ onExit }: { onExit: () => void }) {
  const spreadIds = useSyncExternalStore(
    subscribeBookStore,
    getSpreadIdsSnapshot,
    getSpreadIdsSnapshot,
  )
  const [index, setIndex] = useState(0)
  return (
    <SpreadPager
      count={spreadIds.length + 1}
      index={Math.min(index, spreadIds.length)}
      onIndexChange={setIndex}
      onExit={onExit}
      position={(i) => presentationPosition(i, spreadIds.length)}
      renderSpread={(i) => {
        if (i === 0) {
          return <PresentationCover />
        }
        const id = spreadIds[i - 1]
        return id === undefined ? null : (
          <ConnectedSpreadView
            spreadId={id}
            lowDpiBadge={false}
            editorLayer={false}
          />
        )
      }}
    />
  )
}
