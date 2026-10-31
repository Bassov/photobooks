import { useId, useState, useSyncExternalStore } from 'react'
import { Input, Label, NumberField } from 'react-aria-components'
import {
  GRID_COUNT_MAX,
  GRID_COUNT_MIN,
  effectiveGrid,
  hasGridOverride,
  type Book,
  type GridField,
  type Spread,
} from '../core'
import { Disclosure } from '../ui/Disclosure'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  getGridVisible,
  setGridVisible,
  subscribeGridVisible,
  toggleGridVisible,
} from './gridView'
import { ToggleSwitch } from './InspectorControls'
import './GridSection.css'

const FIELDS: readonly { field: GridField; label: string; unit: 'mm' | '' }[] =
  [
    { field: 'top', label: 'Top', unit: 'mm' },
    { field: 'bottom', label: 'Bottom', unit: 'mm' },
    { field: 'inside', label: 'Inside', unit: 'mm' },
    { field: 'outside', label: 'Outside', unit: 'mm' },
    { field: 'columns', label: 'Columns', unit: '' },
    { field: 'rows', label: 'Rows', unit: '' },
    { field: 'columnGutterMm', label: 'Column gutter', unit: 'mm' },
    { field: 'rowGutterMm', label: 'Row gutter', unit: 'mm' },
  ]

function readBook() {
  return getBookStoreSnapshot().book
}

function useGridShown() {
  return useSyncExternalStore(
    subscribeGridVisible,
    getGridVisible,
    getGridVisible,
  )
}

/**
 * Kit grid sections: the book grid (`scope="book"`), or the spread's kit
 * Grid section (`scope="spread"`, context-inspector.tsx:215-236).
 */
export function GridSection({
  scope,
  spreadId,
}: {
  scope: 'book' | 'spread'
  spreadId?: string
}) {
  return scope === 'spread' ? (
    <SpreadGridSection spreadId={spreadId} />
  ) : (
    <BookGridSection />
  )
}

function BookGridSection() {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const shown = useGridShown()
  const { values } = effectiveGrid(book)
  return (
    <section
      className="grid-section flex flex-col gap-3 px-4 py-4"
      data-testid="grid-section-book"
      aria-label="Layout grid"
    >
      <header className="flex items-center gap-2">
        <h4 className="inspector-eyebrow">Layout grid</h4>
        <span
          className="grid-section-muted text-xs tabular-nums"
          data-testid="grid-summary"
        >
          {`${String(values.columns)}×${String(values.rows)}`}
        </span>
        <IconButton
          label={shown ? 'Hide grid' : 'Show grid'}
          size="sm"
          className="grid-eye ml-auto"
          aria-pressed={shown}
          data-testid="grid-toggle"
          onPress={toggleGridVisible}
        >
          <Icon name="eye" />
        </IconButton>
      </header>
      <GridFields book={book} />
      <p className="grid-section-muted text-xs leading-snug">
        Facing pages are mirrored: inside = spine side.
      </p>
    </section>
  )
}

/** Kit spread grid name (context-inspector.tsx:222): master or book grid. */
function gridOwner(spread: Spread): { name: string; source: string } {
  const masterId = spread.masterId ?? 'A'
  return masterId === 'none'
    ? { name: 'Book grid', source: 'Use book' }
    : { name: `Master ${masterId}`, source: 'Use master' }
}

/**
 * Kit SpreadGridSection: "Use master" (inherit) or Custom (per-field spread
 * override with BOOK | SPREAD labels), and the shared Show grid switch.
 */
function SpreadGridSection({ spreadId }: { spreadId: string | undefined }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const shown = useGridShown()
  // Custom with no field changed yet: the fields show, nothing is written.
  const [customFor, setCustomFor] = useState<string | null>(null)
  const spread = book.spreads.find((item) => item.id === spreadId)
  if (spread === undefined) {
    return null
  }
  const { values } = effectiveGrid(book, spread)
  const custom = hasGridOverride(spread) || customFor === spread.id
  const owner = gridOwner(spread)
  return (
    <Disclosure
      title="Grid"
      defaultExpanded
      summary={`${String(values.columns)}×${String(values.rows)}`}
      data-testid="grid"
    >
      <div
        className="grid-section px-4 pt-0.5 pb-3"
        data-testid="grid-section-spread"
        role="group"
        aria-label="Grid"
      >
        <SegmentedControl
          label="Grid source"
          className="grid-source"
          value={custom ? 'custom' : 'inherit'}
          onChange={(next) => {
            if (next === 'custom') {
              setCustomFor(spread.id)
              return
            }
            setCustomFor(null)
            dispatchBookOp({ type: 'resetSpreadGrid', spreadId: spread.id })
          }}
          items={[
            { id: 'inherit', label: owner.source },
            { id: 'custom', label: 'Custom' },
          ]}
        />
        <div className="mt-3">
          {custom ? (
            <GridFields book={book} spread={spread} />
          ) : (
            <p
              className="grid-section-muted m-0 text-sm"
              data-testid="spread-grid-inherit"
            >
              {`${owner.name} · ${String(values.columns)} × ${String(values.rows)} · gutter ${String(values.columnGutterMm)} mm · margins ${String(values.top)}/${String(values.bottom)}/${String(values.inside)}/${String(values.outside)} mm`}
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="grid-section-muted">Show grid</span>
          <ToggleSwitch
            label="Show grid"
            on={shown}
            onChange={setGridVisible}
            testId="grid-toggle"
          />
        </div>
      </div>
    </Disclosure>
  )
}

function GridFields({ book, spread }: { book: Book; spread?: Spread }) {
  const { values, source } = effectiveGrid(book, spread)
  const commit = (field: GridField, value: number) => {
    if (Number.isNaN(value)) {
      return
    }
    dispatchBookOp(
      spread === undefined
        ? { type: 'setBookGrid', patch: { [field]: value } }
        : {
            type: 'setSpreadGrid',
            spreadId: spread.id,
            patch: { [field]: value },
          },
    )
  }
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-2" data-testid="grid-fields">
      {FIELDS.map(({ field, label, unit }) => (
        <GridFieldInput
          key={field}
          field={field}
          label={label}
          unit={unit}
          value={values[field]}
          source={spread === undefined ? undefined : source[field]}
          onCommit={(value) => {
            commit(field, value)
          }}
        />
      ))}
    </div>
  )
}

function GridFieldInput({
  field,
  label,
  unit,
  value,
  source,
  onCommit,
}: {
  field: GridField
  label: string
  unit: 'mm' | ''
  value: number
  source: 'book' | 'spread' | undefined
  onCommit: (value: number) => void
}) {
  const counted = field === 'columns' || field === 'rows'
  const sourceId = useId()
  return (
    <NumberField
      value={value}
      minValue={counted ? GRID_COUNT_MIN : 0}
      {...(counted ? { maxValue: GRID_COUNT_MAX } : {})}
      step={counted ? 1 : 0.5}
      onChange={onCommit}
      data-testid={`grid-field-${field}`}
      {...(source === undefined ? {} : { 'aria-describedby': sourceId })}
      className="flex min-w-0 flex-col gap-1"
    >
      <div className="flex items-center gap-1">
        <Label className="grid-section-muted text-xs">{label}</Label>
        {source === undefined ? null : (
          <span
            id={sourceId}
            className="grid-section-muted ml-auto text-2xs font-medium tracking-wide uppercase"
            data-testid={`grid-source-${field}`}
          >
            {source}
          </span>
        )}
      </div>
      <div className="grid-field">
        <Input className="grid-field-input" />
        {unit === '' ? null : (
          <span className="grid-section-muted text-xs">{unit}</span>
        )}
      </div>
    </NumberField>
  )
}
