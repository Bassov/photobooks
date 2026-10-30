import { useSyncExternalStore } from 'react'
import { setCoverSelected } from './coverSelection'
import { EndpaperCanvas } from './EndpaperCanvas'
import {
  getSelectedEndpaper,
  setEndpaperSelected,
  subscribeEndpaperSelection,
  type EndpaperSide,
} from './endpaperSelection'

/** Kit list item "Endpaper" (uikit/src/sandbox/chrome.tsx:275,278). */
export function EndpaperRow({ side }: { side: EndpaperSide }) {
  const picked = useSyncExternalStore(
    subscribeEndpaperSelection,
    getSelectedEndpaper,
    getSelectedEndpaper,
  )
  const selected = picked === side
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Endpaper ${side}`}
      className="e7-item rounded-md p-2"
      data-endpaper-row={side}
      data-testid={`endpaper-list-item-${side}`}
      onClick={() => {
        setCoverSelected(false)
        setEndpaperSelected(side)
      }}
    >
      <div className="mx-auto w-full">
        <EndpaperCanvas side={side} mini />
      </div>
      <div className="mt-1.5 flex text-2xs tabular-nums">
        <span data-label className={selected ? 'font-semibold' : 'font-normal'}>
          Endpaper
        </span>
      </div>
    </button>
  )
}
