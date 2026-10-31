import { useState, useSyncExternalStore } from 'react'
import { PAGE_STEP, TRIM_MAX_MM, TRIM_MIN_MM } from '../core'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  bookSettingsSubtitle,
  FIELD,
  fmtN,
  PAGE_MAX,
  PAGE_MIN,
  pagesNote,
  pagesOf,
  SUB,
  T,
} from './editorChromeTokens'
import { Select } from '../ui/Select'
import { InspectorRow, ReadOnlyPill, ToggleSwitch } from './InspectorControls'

type Unit = 'cm' | 'mm'

/** Kit PRESETS (uikit/src/sandbox/v7.tsx:55-57), cm. */
const PRESETS: readonly { id: string; name: string; w: number; h: number }[] = [
  { id: 'A6', name: 'A6', w: 10.5, h: 14.8 },
  { id: 'A5', name: 'A5', w: 14.8, h: 21 },
  { id: 'A4', name: 'A4', w: 21, h: 29.7 },
  { id: 'A3', name: 'A3', w: 29.7, h: 42 },
  { id: 'Letter', name: 'Letter', w: 21.6, h: 27.9 },
  { id: 'sq20', name: 'Square 20×20', w: 20, h: 20 },
  { id: 'sq30', name: 'Square 30×30', w: 30, h: 30 },
]
const CUSTOM = 'custom'

/** Kit presetLabel (v7.tsx:58): name · short × long cm, swapped when landscape. */
function presetLabel(
  preset: (typeof PRESETS)[number],
  landscape: boolean,
): string {
  const swap = landscape && preset.w !== preset.h
  return `${preset.name} · ${fmtN(swap ? preset.h : preset.w)} × ${fmtN(swap ? preset.w : preset.h)} cm`
}

function presetFor(trim: { widthMm: number; heightMm: number }): string {
  const found = PRESETS.find((p) => {
    const w = Math.round(p.w * 10)
    const h = Math.round(p.h * 10)
    return (
      (Math.round(trim.widthMm) === w && Math.round(trim.heightMm) === h) ||
      (Math.round(trim.widthMm) === h && Math.round(trim.heightMm) === w)
    )
  })
  return found?.id ?? CUSTOM
}

/** Kit `Field` (v7.tsx:132) without a setter: label, mono value, unit. */
function ReadOnlyField({
  label,
  value,
  unit,
  testId,
}: {
  label: string
  value: string
  unit: string
  testId: string
}) {
  return (
    <div className="insp-size-field" data-testid={testId}>
      <span className="text-muted-foreground">{label}</span>
      <span className="flex-1 tabular-nums">{value}</span>
      <span className="text-muted-foreground">{unit}</span>
    </div>
  )
}

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit SizeEditor number field (uikit/src/sandbox/v7.tsx:162-166). */
function SizeField({
  axis,
  label,
  unit,
  mm,
}: {
  axis: 'widthMm' | 'heightMm'
  label: 'W' | 'H'
  unit: Unit
  mm: number
}) {
  const k = unit === 'mm' ? 1 : 0.1
  const shown = Math.round(mm * k * 10) / 10
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    const value = Number.parseFloat(text) / k
    if (value >= TRIM_MIN_MM && value <= TRIM_MAX_MM) {
      const { trim } = readBook().settings
      dispatchBookOp({
        type: 'setTrim',
        widthMm: axis === 'widthMm' ? value : trim.widthMm,
        heightMm: axis === 'heightMm' ? value : trim.heightMm,
      })
    }
  }
  return (
    <label className="insp-size-field">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        aria-label={`${axis === 'widthMm' ? 'Width' : 'Height'} (${unit})`}
        data-testid={axis === 'widthMm' ? 'size-w' : 'size-h'}
        step={unit === 'mm' ? 1 : 0.1}
        min={TRIM_MIN_MM * k}
        max={TRIM_MAX_MM * k}
        value={draft ?? shown}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          commit(event.currentTarget.value)
        }}
        onBlur={() => {
          setDraft(null)
        }}
      />
      <span className="text-muted-foreground">{unit}</span>
    </label>
  )
}

/**
 * Rendered #/demo step 24: compact filled number box (kit `Val` metrics, no
 * spin arrows). A typed count commits on Enter / blur, clamped to 20–120 in
 * steps of 2, and adds or removes spreads at the end (one undo step).
 */
function PagesField({ pages }: { pages: number }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(pages)
  const commit = () => {
    // No draft ("null") or a non-number parses to NaN: the book is kept.
    dispatchBookOp({
      type: 'setPageCount',
      pages: Number.parseFloat(String(draft)),
    })
    setDraft(null)
  }
  return (
    <input
      type="number"
      className="insp-pages-field rounded-sm px-2 py-1 text-sm"
      aria-label="Pages"
      data-testid="book-pages-input"
      min={PAGE_MIN}
      max={PAGE_MAX}
      step={PAGE_STEP}
      value={shown}
      style={{
        width: `calc(${String(Math.max(2, shown.length))}ch + 1rem)`,
        background: FIELD,
        color: T,
      }}
      onChange={(event) => {
        setDraft(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        } else if (event.key === 'Escape') {
          setDraft(null)
        }
      }}
      onBlur={commit}
    />
  )
}

/** Kit "Book settings" (uikit/src/sandbox/v7.tsx:200-210) on the document. */
export function BookSettingsSection() {
  const { settings, spreads, cover } = useSyncExternalStore(
    subscribeBookStore,
    readBook,
    readBook,
  )
  const pages = pagesOf(spreads.length)
  const [unit, setUnit] = useState<Unit>('cm')
  const [customPicked, setCustomPicked] = useState(false)
  const { trim, endpapers } = settings
  const landscape = trim.widthMm > trim.heightMm
  const matched = presetFor(trim)
  const presetValue = customPicked ? CUSTOM : matched
  return (
    <section
      className="flex flex-col gap-3 px-4 py-4"
      data-testid="book-settings"
      aria-label="Book settings"
    >
      <div>
        <h2 className="text-sm font-semibold" data-testid="inspector-context">
          Book settings
        </h2>
        <p
          className="mt-0.5 text-xs text-muted-foreground"
          data-testid="book-settings-subtitle"
        >
          {bookSettingsSubtitle(cover.back.text, cover.front.text)}
        </p>
      </div>
      <h4 className="inspector-eyebrow">Page size</h4>
      {/* Kit SizeEditor select (v7.tsx:172-174), presets plus "Custom". */}
      <Select
        aria-label="Page size"
        data-testid="size-preset"
        value={presetValue}
        options={[
          ...PRESETS.map((p) => ({
            value: p.id,
            label: presetLabel(p, landscape),
          })),
          { value: CUSTOM, label: 'Custom' },
        ]}
        onChange={(value) => {
          const preset = PRESETS.find((p) => p.id === value)
          setCustomPicked(preset === undefined)
          if (preset !== undefined) {
            const swap = landscape && preset.w !== preset.h
            dispatchBookOp({
              type: 'setTrim',
              widthMm: Math.round((swap ? preset.h : preset.w) * 10),
              heightMm: Math.round((swap ? preset.w : preset.h) * 10),
            })
          }
        }}
      />
      <div data-testid="size-orientation">
        <SegmentedControl
          label="Orientation"
          size="sm"
          items={[
            { id: 'portrait', label: 'Portrait' },
            { id: 'landscape', label: 'Landscape' },
          ]}
          value={landscape ? 'landscape' : 'portrait'}
          onChange={(value) => {
            if ((value === 'landscape') !== landscape) {
              dispatchBookOp({
                type: 'setTrim',
                widthMm: trim.heightMm,
                heightMm: trim.widthMm,
              })
            }
          }}
        />
      </div>
      {presetValue === CUSTOM ? (
        <div data-testid="size-unit">
          <SegmentedControl
            label="Units"
            size="sm"
            items={[
              { id: 'cm', label: 'cm' },
              { id: 'mm', label: 'mm' },
            ]}
            value={unit}
            onChange={(value) => {
              setUnit(value === 'mm' ? 'mm' : 'cm')
            }}
          />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <SizeField axis="widthMm" label="W" unit={unit} mm={trim.widthMm} />
        <SizeField axis="heightMm" label="H" unit={unit} mm={trim.heightMm} />
      </div>
      <p className="text-2xs leading-4 text-muted-foreground">
        Size of one page. To print 2 pages per A4 sheet, choose A5.
      </p>
      <h4 className="inspector-eyebrow">Binding</h4>
      <InspectorRow label="Style">
        {/* Kit v7.tsx:205: disabled Val pill + "read-only" note. */}
        <ReadOnlyPill
          value="Hardcover"
          note="read-only"
          testId="binding-style"
          noteTestId="binding-readonly"
        />
      </InspectorRow>
      <InspectorRow label="Endpapers">
        <ToggleSwitch
          label="Endpapers"
          testId="book-endpapers"
          on={endpapers.enabled}
          onChange={(enabled) => {
            dispatchBookOp({ type: 'setEndpapersEnabled', enabled })
          }}
        />
      </InspectorRow>
      {/* Rendered #/demo step 24: pages box, range hint and the spreads note. */}
      <InspectorRow label="Pages">
        <span className="flex items-center gap-1" data-testid="book-pages">
          <PagesField pages={pages} />
          <span
            className="text-2xs"
            style={{ color: SUB }}
            data-testid="book-pages-range"
          >
            {PAGE_MIN}–{PAGE_MAX}
          </span>
        </span>
      </InspectorRow>
      <p
        className="text-2xs text-muted-foreground"
        data-testid="book-pages-note"
      >
        {pagesNote(pages)}
      </p>
      <h4 className="inspector-eyebrow">Print</h4>
      {/* Kit v7.tsx:209: bleed / safe margin Fields, paper pill. */}
      <div className="grid grid-cols-2 gap-2">
        <ReadOnlyField
          label="B"
          value={fmtN(settings.bleedMm)}
          unit="mm"
          testId="book-bleed"
        />
        <ReadOnlyField
          label="S"
          value={fmtN(settings.safeMarginMm)}
          unit="mm"
          testId="book-safe-margin"
        />
      </div>
      <InspectorRow label="Paper">
        <ReadOnlyPill value="Matte 200 g" />
      </InspectorRow>
      <h4 className="inspector-eyebrow">Defaults</h4>
      {/* Kit v7.tsx:201,210: default master and page colour (coming later). */}
      <InspectorRow label="Default master">
        <ReadOnlyPill value="Master A" />
      </InspectorRow>
      <InspectorRow label="Page colour">
        <span
          className="text-sm text-muted-foreground"
          data-testid="page-colour-readonly"
        >
          Paper white · coming later
        </span>
      </InspectorRow>
    </section>
  )
}
