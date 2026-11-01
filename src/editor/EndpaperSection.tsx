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
    <section data-testid="insp-endpaper" aria-label="Endpaper">
      {/* Kit `Head` (v7.tsx:219): the panel's first block, px-4 pt-4 pb-1
          (Owner Must M48, round 7). */}
      <div className="px-4 pt-4 pb-1" data-testid="inspector-head">
        <h2 className="endpaper-head-title" data-testid="inspector-context">
          Endpaper · {side}
        </h2>
        <p className="endpaper-head-sub text-muted-foreground">
          Pastedown and free leaf, printed full bleed
        </p>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
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
      </div>
    </section>
  )
}
