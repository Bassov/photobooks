import { useSyncExternalStore } from 'react'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import type { EndpaperSide } from './endpaperSelection'
import { FIELD, SUB, T } from './editorChromeTokens'
import { ToggleSwitch } from './InspectorControls'
import { useThumbUrl } from './useThumbUrl'
import './EndpaperCanvas.css'

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit InspectorPart "Endpaper" (uikit/src/sandbox/v7.tsx:218-222). */
export function EndpaperSection({ side }: { side: EndpaperSide }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const assetId = book.endpapers[side].assetId
  const url = useThumbUrl(assetId)
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
      {/* Kit `Sec` / `Row` (v7.tsx:130,145; Owner Must M48, round 8):
          px-4 py-4 sections, an mb-3 title row, rows mt-3. */}
      <div className="px-4 py-4" data-testid="endpaper-sec-fill">
        <SecTitle title="Fill" />
        {/* Kit v7.tsx:220: label, "Pattern" chip and "coming later" spread
            across the row (justify-between of three). */}
        <div className="endpaper-row" data-testid="endpaper-style-row">
          <span style={{ color: SUB }}>Style</span>
          <span
            className="rounded-sm px-2 py-1"
            style={{ background: FIELD, color: T }}
            data-testid="endpaper-style"
          >
            {assetId === undefined ? 'Pattern' : 'Photo'}
          </span>
          <span
            className="ml-1.5 text-2xs"
            style={{ color: SUB }}
            data-testid="endp-fill-readonly"
          >
            coming later
          </span>
        </div>
        <div className="endpaper-row">
          <span style={{ color: SUB }}>
            {assetId === undefined ? 'Pattern' : 'Photo'}
          </span>
          <span
            className="endpaper-swatch"
            data-testid="endpaper-fill"
            data-photo-id={assetId}
            style={
              url === undefined ? undefined : { backgroundImage: `url(${url})` }
            }
          />
        </div>
        {assetId === undefined ? null : (
          <button
            type="button"
            className="e7-ghost mt-3 h-8 w-full rounded-md text-sm"
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
      </div>
      <div className="px-4 py-4" data-testid="endpaper-sec-apply">
        <SecTitle title="Apply" />
        <div className="endpaper-row">
          <span style={{ color: SUB }}>Same on back endpaper</span>
          <ToggleSwitch
            label="Same on back endpaper"
            testId="endpaper-same"
            on={same}
            onChange={(next) => {
              dispatchBookOp({ type: 'setEndpapersSame', same: next })
            }}
          />
        </div>
      </div>
    </section>
  )
}

/** Kit `Sec` title row: mb-3, 11 px semibold uppercase eyebrow at 0.12em. */
function SecTitle({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="inspector-eyebrow inspector-sec-title endpaper-sec-title">
        {title}
      </h3>
    </div>
  )
}
