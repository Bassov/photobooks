import { useSyncExternalStore } from 'react'
import type { CoverPanelName } from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { SUB } from './editorChromeTokens'
import './CoverCanvas.css'
import { useCoverPhotoUrl } from './useCoverPhotoUrl'

function readBook() {
  return getBookStoreSnapshot().book
}

function CoverText({ panel, label }: { panel: CoverPanelName; label: string }) {
  const text = useSyncExternalStore(
    subscribeBookStore,
    () => readBook().cover[panel].text,
    () => readBook().cover[panel].text,
  )
  return (
    <input
      type="text"
      aria-label={label}
      placeholder={label}
      value={text}
      data-testid={`cover-text-${panel}`}
      className="cover-text-input"
      onChange={(event) => {
        dispatchBookOp({
          type: 'setCoverText',
          panel,
          text: event.currentTarget.value,
        })
      }}
    />
  )
}

/** Kit InspectorPart "Cover": front photo and title, spine text, back text. */
export function CoverSection() {
  const assetId = useSyncExternalStore(
    subscribeBookStore,
    () => readBook().cover.front.assetId,
    () => readBook().cover.front.assetId,
  )
  const url = useCoverPhotoUrl(assetId)
  const name = useSyncExternalStore(
    subscribeBookStore,
    () =>
      assetId === undefined
        ? undefined
        : getBookStoreSnapshot().sessionMeta.get(assetId)?.name,
    () => undefined,
  )
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="insp-cover"
      aria-label="Cover"
    >
      <div>
        <h2 className="text-sm font-semibold" data-testid="inspector-context">
          Cover
        </h2>
        <p className="mt-0.5 text-xs" style={{ color: SUB }}>
          Back, spine and front
        </p>
      </div>
      <h4 className="inspector-eyebrow">Front</h4>
      <div className="flex items-center gap-3">
        <div
          className="cover-thumb"
          data-testid="cover-front-thumb"
          data-photo-id={assetId}
          style={{
            backgroundImage: url === undefined ? undefined : `url(${url})`,
          }}
        />
        <div className="min-w-0 text-sm">
          <div className="truncate">
            {assetId === undefined ? 'No photo yet' : (name ?? assetId)}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: SUB }}>
            Drag a photo from the filmstrip onto the cover
          </div>
        </div>
      </div>
      <CoverText panel="front" label="Front title" />
      <h4 className="inspector-eyebrow">Spine</h4>
      <CoverText panel="spine" label="Spine text" />
      <h4 className="inspector-eyebrow">Back</h4>
      <CoverText panel="back" label="Back text" />
    </section>
  )
}
