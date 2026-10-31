import { useSyncExternalStore } from 'react'
import { type CoverPanelName, type CoverStyle } from '../core'
import { Select } from '../ui/Select'
import {
  DIRECTION_OPTIONS,
  FINISH_OPTIONS,
  MATERIAL_OPTIONS,
  TITLE_FONT_OPTIONS,
} from './coverOptions'
import { InspectorRow, ReadOnlyPill } from './InspectorControls'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { COVER_WRAP_MM, coverPanelPpi } from './coverLayout'
import { SUB, fmtN } from './editorChromeTokens'
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

function readStyle(): CoverStyle {
  return readBook().cover.style
}

function useStyle(): CoverStyle {
  return useSyncExternalStore(subscribeBookStore, readStyle, readStyle)
}

function setStyle(patch: Partial<CoverStyle>): void {
  dispatchBookOp({ type: 'setCoverStyle', patch })
}

/** Kit Row with a native select for a cover style choice. */
function ChoiceRow<K extends 'titleFont' | 'material' | 'finish'>({
  label,
  field,
  options,
  testId,
}: {
  label: string
  field: K
  options: readonly { value: CoverStyle[K]; label: string }[]
  testId: string
}) {
  const style = useStyle()
  return (
    <InspectorRow label={label}>
      <Select
        aria-label={label}
        data-testid={testId}
        value={style[field]}
        options={options.map((item) => ({ ...item }))}
        onChange={(value) => {
          setStyle({ [field]: value })
        }}
      />
    </InspectorRow>
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
  const style = useStyle()
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
      <ChoiceRow
        label="Title font"
        field="titleFont"
        options={TITLE_FONT_OPTIONS}
        testId="cover-title-font"
      />
      <h4 className="inspector-eyebrow">Spine</h4>
      <CoverText panel="spine" label="Spine text" />
      {/* Rendered #/demo step 13: Spine width is read-only mono text. */}
      <InspectorRow label="Spine width">
        <span
          className="font-mono text-sm tabular-nums"
          data-testid="cover-spine-width"
        >
          {fmtN(style.spineWidthMm)} mm
        </span>
      </InspectorRow>
      {/* Kit v7.tsx:215: Direction is a read-only Val pill. */}
      <InspectorRow label="Direction">
        <ReadOnlyPill
          value={
            DIRECTION_OPTIONS.find(
              (item) => item.value === style.spineDirection,
            )?.label ?? ''
          }
          testId="cover-direction"
        />
      </InspectorRow>
      <h4 className="inspector-eyebrow">Back</h4>
      <CoverText panel="back" label="Back text" />
      {/* Kit v7.tsx:216: Fill is a "Paper white" pill with a "coming later" note. */}
      <InspectorRow label="Fill">
        <ReadOnlyPill
          value="Paper white"
          note="coming later"
          testId="cover-back-fill"
          noteTestId="fill-readonly"
        />
      </InspectorRow>
      <h4 className="inspector-eyebrow">Material</h4>
      <ChoiceRow
        label="Cover"
        field="material"
        options={MATERIAL_OPTIONS}
        testId="cover-material"
      />
      <ChoiceRow
        label="Finish"
        field="finish"
        options={FINISH_OPTIONS}
        testId="cover-finish"
      />
    </section>
  )
}
