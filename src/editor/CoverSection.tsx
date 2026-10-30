import { useSyncExternalStore } from 'react'
import type { CoverPanelName } from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { COVER_SPINE_MM, COVER_WRAP_MM, coverPanelPpi } from './coverLayout'
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

function Row({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: { text: string; testId: string }
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: SUB }}>{label}</span>
      <span>
        {value}
        {note === undefined ? null : (
          <span
            className="ml-1.5 text-2xs"
            style={{ color: SUB }}
            data-testid={note.testId}
          >
            {note.text}
          </span>
        )}
      </span>
    </div>
  )
}

/** Front photo's resolution on the panel; absent until the photo is decoded. */
function frontPpi(): number | undefined {
  const { book, sessionMeta } = getBookStoreSnapshot()
  const { assetId, crop } = book.cover.front
  const meta = sessionMeta.get(assetId ?? '')
  if (
    meta === undefined ||
    (meta.correctedWidth <= 1 && meta.correctedHeight <= 1)
  ) {
    return undefined
  }
  return coverPanelPpi(
    { widthPx: meta.correctedWidth, heightPx: meta.correctedHeight },
    {
      widthMm: book.settings.trim.widthMm,
      heightMm: book.settings.trim.heightMm,
    },
    crop?.zoom ?? 1,
  )
}

const COMING_LATER = (testId: string) => ({ text: 'coming later', testId })

/**
 * Kit InspectorPart "Cover" (cover-editor): front photo and title, spine text,
 * back text. Values the document does not hold yet are read-only rows.
 */
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
  const ppi = useSyncExternalStore(subscribeBookStore, frontPpi, frontPpi)
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
          Hardcover · back, spine, front · wrap {COVER_WRAP_MM} mm
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
          <div className="mt-0.5" style={{ color: SUB }}>
            {ppi === undefined
              ? 'Full bleed'
              : `Full bleed · ${String(ppi)} ppi`}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: SUB }}>
            Drag a photo from the filmstrip onto the cover
          </div>
        </div>
      </div>
      <CoverText panel="front" label="Front title" />
      <Row label="Title font" value="Serif italic" />
      <h4 className="inspector-eyebrow">Spine</h4>
      <CoverText panel="spine" label="Spine text" />
      <Row label="Spine width" value={`${String(COVER_SPINE_MM)} mm`} />
      <Row label="Direction" value="Top to bottom" />
      <h4 className="inspector-eyebrow">Back</h4>
      <CoverText panel="back" label="Back text" />
      <Row
        label="Fill"
        value="Paper white"
        note={COMING_LATER('fill-readonly')}
      />
      <h4 className="inspector-eyebrow">Material</h4>
      <Row
        label="Cover"
        value="Printed"
        note={COMING_LATER('material-readonly')}
      />
      <Row
        label="Finish"
        value="Matte laminate"
        note={COMING_LATER('finish-readonly')}
      />
    </section>
  )
}
