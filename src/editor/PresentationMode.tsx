import { useState, useSyncExternalStore } from 'react'
import { bookSpineWidthMm } from '../core'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { SpreadPager } from '../render/SpreadPager'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { CoverCanvas } from './CoverCanvas'
import {
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  subscribeBookStore,
} from './bookStore'

function readCoverWidthMm(): number {
  const { book } = getBookStoreSnapshot()
  return 2 * book.settings.trim.widthMm + bookSpineWidthMm(book)
}

/** The cover slide at the spreads' px / mm, so the pager fits it the same way. */
function PresentationCover() {
  const widthMm = useSyncExternalStore(
    subscribeBookStore,
    readCoverWidthMm,
    readCoverWidthMm,
  )
  return (
    <div
      data-testid="presentation-cover"
      style={{ width: widthMm * SPREAD_PX_PER_MM }}
    >
      <CoverCanvas mini tierSlot="cover:preview" />
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
