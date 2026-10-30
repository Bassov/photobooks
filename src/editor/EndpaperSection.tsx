import { useSyncExternalStore } from 'react'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import type { EndpaperSide } from './endpaperSelection'
import { InspectorRow, ReadOnlyPill, ToggleSwitch } from './InspectorControls'
import { useCoverPhotoUrl } from './useCoverPhotoUrl'
import './EndpaperCanvas.css'

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit InspectorPart "Endpaper" (uikit/src/sandbox/v7.tsx:218-222). */
export function EndpaperSection({ side }: { side: EndpaperSide }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const assetId = book.endpapers[side].assetId
  const url = useCoverPhotoUrl(assetId)
  const { same } = book.settings.endpapers
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="insp-endpaper"
      aria-label="Endpaper"
    >
      <div>
        <h2 className="text-sm font-semibold" data-testid="inspector-context">
          Endpaper · {side}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pastedown and free leaf, printed full bleed
        </p>
      </div>
      <h4 className="inspector-eyebrow">Fill</h4>
      {/* Kit v7.tsx:220: Style is a "Pattern" pill with a "coming later" note. */}
      <InspectorRow label="Style">
        <ReadOnlyPill
          value={assetId === undefined ? 'Pattern' : 'Photo'}
          note="coming later"
          testId="endpaper-style"
          noteTestId="endp-fill-readonly"
        />
      </InspectorRow>
      <InspectorRow label={assetId === undefined ? 'Pattern' : 'Photo'}>
        <span
          className="endpaper-swatch"
          data-testid="endpaper-fill"
          data-photo-id={assetId}
          style={
            url === undefined ? undefined : { backgroundImage: `url(${url})` }
          }
        />
      </InspectorRow>
      {assetId === undefined ? null : (
        <button
          type="button"
          className="e7-ghost h-8 rounded-md text-sm"
          data-testid="endpaper-clear"
          onClick={() => {
            dispatchBookOp({
              type: 'setEndpaperPhoto',
              side,
              assetId: undefined,
            })
          }}
        >
          Back to pattern
        </button>
      )}
      <h4 className="inspector-eyebrow">Apply</h4>
      <InspectorRow label="Same on back endpaper">
        <ToggleSwitch
          label="Same on back endpaper"
          testId="endpaper-same"
          on={same}
          onChange={(next) => {
            dispatchBookOp({ type: 'setEndpapersSame', same: next })
          }}
        />
      </InspectorRow>
    </section>
  )
}
