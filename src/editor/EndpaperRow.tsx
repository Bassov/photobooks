import { useSyncExternalStore } from 'react'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { setCoverSelected } from './coverSelection'
import { EndpaperCanvas } from './EndpaperCanvas'
import {
  getSelectedEndpaper,
  setEndpaperSelected,
  subscribeEndpaperSelection,
  type EndpaperSide,
} from './endpaperSelection'
import { endpaperCardRatio } from './spreadsPanelModel'
import { ThumbCard } from './ThumbCard'

function readRatio(): number {
  return endpaperCardRatio(getBookStoreSnapshot().book.settings.trim)
}

/** Kit list item "Endpaper" (uikit/src/sandbox/chrome.tsx:275,278,305-314). */
export function EndpaperRow({ side }: { side: EndpaperSide }) {
  const picked = useSyncExternalStore(
    subscribeEndpaperSelection,
    getSelectedEndpaper,
    getSelectedEndpaper,
  )
  const ratio = useSyncExternalStore(subscribeBookStore, readRatio, readRatio)
  const selected = picked === side
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Endpaper ${side}`}
      className="e7-item relative mb-1 rounded-md p-2"
      data-endpaper-row={side}
      data-testid={`endpaper-list-item-${side}`}
      onClick={() => {
        setCoverSelected(false)
        setEndpaperSelected(side)
      }}
    >
      <ThumbCard ratio={ratio}>
        <EndpaperCanvas side={side} mini />
      </ThumbCard>
      <div className="mt-1.5 flex text-2xs tabular-nums">
        <span data-label className={selected ? 'font-semibold' : 'font-normal'}>
          Endpaper
        </span>
      </div>
    </button>
  )
}
