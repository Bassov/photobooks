import { useId, useSyncExternalStore } from 'react'
import { Input, Label, NumberField } from 'react-aria-components'
import {
  GRID_COUNT_MAX,
  GRID_COUNT_MIN,
  effectiveGrid,
  hasGridOverride,
  type GridField,
} from '../core'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  getGridVisible,
  subscribeGridVisible,
  toggleGridVisible,
} from './gridView'
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

/**
 * Kit GridSection: book grid (`scope="book"`) or per-field override of one
 * spread (`scope="spread"`) with BOOK | SPREAD source labels and a reset.
 */
export function GridSection({
  scope,
  spreadId,
}: {
  scope: 'book' | 'spread'
  spreadId?: string
}) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const shown = useSyncExternalStore(
    subscribeGridVisible,
    getGridVisible,
    getGridVisible,
  )
  const spread =
    scope === 'spread'
      ? book.spreads.find((item) => item.id === spreadId)
      : undefined
  if (scope === 'spread' && spread === undefined) {
    return null
  }
  const { values, source } = effectiveGrid(book, spread)
  const overridden = spread !== undefined && hasGridOverride(spread)
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
    <section
      className="grid-section flex flex-col gap-3 px-4 py-4"
      data-testid={`grid-section-${scope}`}
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
      <div
        className="grid grid-cols-2 gap-x-2 gap-y-2"
        data-testid="grid-fields"
      >
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
      {spread === undefined ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          data-testid="grid-reset"
          isDisabled={!overridden}
          onPress={() => {
            dispatchBookOp({ type: 'resetSpreadGrid', spreadId: spread.id })
          }}
        >
          Reset to book grid
        </Button>
      )}
      <p className="grid-section-muted text-xs leading-snug">
        Facing pages are mirrored: inside = spine side.
      </p>
    </section>
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
