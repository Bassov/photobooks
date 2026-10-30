import { useState, useSyncExternalStore } from 'react'
import { TRIM_MAX_MM, TRIM_MIN_MM } from '../core'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { SUB, fmtN, pagesOf } from './editorChromeTokens'
import {
  InspectorRow,
  Swatches,
  ToggleSwitch,
  type SwatchOption,
} from './InspectorControls'

type Unit = 'cm' | 'mm'

/** Paper is the default (no stored colour); the rest are page tints. */
const PAPER = '#ffffff'
const PAGE_COLORS: readonly SwatchOption[] = [
  { value: PAPER, name: 'Paper white' },
  { value: '#f4f1ea', name: 'Cream' },
  { value: '#e6e6e6', name: 'Light grey' },
  { value: '#3e3c3b', name: 'Charcoal' },
]

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
      <span style={{ color: SUB }}>{label}</span>
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
      <span style={{ color: SUB }}>{unit}</span>
    </label>
  )
}

/** Kit "Book settings" (uikit/src/sandbox/v7.tsx:200-210) on the document. */
export function BookSettingsSection() {
  const { settings, spreads } = useSyncExternalStore(
    subscribeBookStore,
    readBook,
    readBook,
  )
  const [unit, setUnit] = useState<Unit>('cm')
  const { trim, endpapers } = settings
  const landscape = trim.widthMm > trim.heightMm
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
        <p className="mt-0.5 text-xs text-muted-foreground">
          Applies to the whole book
        </p>
      </div>
      <h4 className="inspector-eyebrow">Page size</h4>
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
      <div className="grid grid-cols-2 gap-2">
        <SizeField axis="widthMm" label="W" unit={unit} mm={trim.widthMm} />
        <SizeField axis="heightMm" label="H" unit={unit} mm={trim.heightMm} />
      </div>
      <p className="text-2xs leading-4" style={{ color: SUB }}>
        Size of one page. To print 2 pages per A4 sheet, choose A5.
      </p>
      <h4 className="inspector-eyebrow">Binding</h4>
      <InspectorRow label="Style">
        <span>
          Hardcover
          <span
            className="ml-1.5 text-2xs"
            style={{ color: SUB }}
            data-testid="binding-readonly"
          >
            read-only
          </span>
        </span>
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
      <InspectorRow label="Pages">
        <span className="tabular-nums" data-testid="book-pages">
          {String(pagesOf(spreads.length))}
        </span>
      </InspectorRow>
      <h4 className="inspector-eyebrow">Print</h4>
      <InspectorRow label="Bleed">
        <span className="tabular-nums">{fmtN(settings.bleedMm)} mm</span>
      </InspectorRow>
      <InspectorRow label="Safe margin">
        <span className="tabular-nums">{fmtN(settings.safeMarginMm)} mm</span>
      </InspectorRow>
      <h4 className="inspector-eyebrow">Defaults</h4>
      <InspectorRow label="Page colour">
        <Swatches
          label="Page colour"
          options={PAGE_COLORS}
          value={settings.pageColor ?? PAPER}
          testId="book-page-colour"
          onChange={(value) => {
            dispatchBookOp({
              type: 'setPageColor',
              color: value === PAPER ? undefined : value,
            })
          }}
        />
      </InspectorRow>
    </section>
  )
}
