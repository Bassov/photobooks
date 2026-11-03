import { useState, useSyncExternalStore } from 'react'
import { Input, NumberField } from 'react-aria-components'
import {
  GRID_COUNT_MAX,
  GRID_COUNT_MIN,
  effectiveGrid,
  parentAsSpread,
  type GridField,
  type GridPatch,
  type GridValues,
} from '../core'
import { Icon } from '../ui/Icon'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { FIELD, SUB, T } from './editorChromeTokens'
import { InspectorHead, InspectorSec } from './InspectorControls'
import {
  masterGridPatch,
  parentUsage,
  parentUsageLabel,
} from './inspectorModel'

/** Kit GridFields (v7.tsx:191-200): short label, long name on title / aria. */
interface FieldSpec {
  field: GridField
  short: string
  name: string
  unit?: 'mm'
}

const COUNTS: readonly FieldSpec[] = [
  { field: 'columns', short: 'C', name: 'Columns' },
  { field: 'rows', short: 'R', name: 'Rows' },
  { field: 'columnGutterMm', short: 'G', name: 'Gutter (mm)', unit: 'mm' },
  { field: 'rowGutterMm', short: 'RG', name: 'Row gap (mm)', unit: 'mm' },
]

const MARGINS: readonly FieldSpec[] = [
  { field: 'top', short: 'T', name: 'Top margin (mm)', unit: 'mm' },
  { field: 'bottom', short: 'B', name: 'Bottom margin (mm)', unit: 'mm' },
  { field: 'inside', short: 'I', name: 'Inside margin (mm)', unit: 'mm' },
  { field: 'outside', short: 'O', name: 'Outside margin (mm)', unit: 'mm' },
]

function readBook() {
  return getBookStoreSnapshot().book
}

function marginsEqual(values: GridValues): boolean {
  return (
    values.top === values.bottom &&
    values.top === values.inside &&
    values.top === values.outside
  )
}

/**
 * Kit master inspector (uikit/src/sandbox/v7.tsx:231-233): head (name, usage)
 * and the GRID section. Every commit is one `setSpreadGrid` on the parent.
 * Mount per parent (`key`): the margin link starts on when all four match.
 */
export function MasterSection({ parentId }: { parentId: string }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const parent = book.parents?.find((item) => item.id === parentId)
  const { values } = effectiveGrid(
    book,
    parent === undefined ? undefined : parentAsSpread(parent),
  )
  const [linked, setLinked] = useState(() => marginsEqual(values))
  if (parent === undefined) {
    return null
  }
  const write = (patch: GridPatch) => {
    dispatchBookOp({ type: 'setSpreadGrid', spreadId: parent.id, patch })
  }
  const commit = (field: GridField, value: number) => {
    if (!Number.isNaN(value)) {
      write(masterGridPatch(field, value, linked))
    }
  }
  const field = (spec: FieldSpec) => (
    <MasterField
      key={spec.field}
      spec={spec}
      value={values[spec.field]}
      onCommit={(value) => {
        commit(spec.field, value)
      }}
    />
  )
  return (
    <section data-testid="insp-master" aria-label="Master">
      <InspectorHead
        title={parent.name}
        sub={parentUsageLabel(parentUsage(book, parent.id))}
        subTestId="master-usage"
      />
      <InspectorSec title="Grid" testId="master-grid">
        <div className="grid grid-cols-2 gap-2">{COUNTS.map(field)}</div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span style={{ color: SUB }}>Margins</span>
          <button
            type="button"
            className="e7-ghost insp-link-btn"
            aria-label="Link margins"
            aria-pressed={linked}
            data-testid="master-field-link"
            style={linked ? { background: FIELD, color: T } : { color: SUB }}
            onClick={() => {
              if (!linked) {
                write({
                  bottom: values.top,
                  inside: values.top,
                  outside: values.top,
                })
              }
              setLinked(!linked)
            }}
          >
            <Icon name={linked ? 'link2' : 'unlink2'} size={14} />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">{MARGINS.map(field)}</div>
      </InspectorSec>
    </section>
  )
}

/** Kit `Field` (v7.tsx:132): FIELD box, short label, mono value, unit. */
function MasterField({
  spec,
  value,
  onCommit,
}: {
  spec: FieldSpec
  value: number
  onCommit: (value: number) => void
}) {
  const counted = spec.unit === undefined
  return (
    <NumberField
      value={value}
      minValue={counted ? GRID_COUNT_MIN : 0}
      {...(counted ? { maxValue: GRID_COUNT_MAX } : {})}
      step={counted ? 1 : 0.5}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
      onChange={onCommit}
      aria-label={spec.name}
      className="insp-size-field insp-grid-field"
    >
      <span
        className="text-center"
        style={{ color: SUB }}
        title={spec.name}
        aria-hidden="true"
      >
        {spec.short}
      </span>
      <Input
        title={spec.name}
        className="font-mono"
        style={{ color: T }}
        data-testid={`master-field-${spec.field}`}
      />
      {spec.unit === undefined ? null : (
        <span style={{ color: SUB }}>{spec.unit}</span>
      )}
    </NumberField>
  )
}
