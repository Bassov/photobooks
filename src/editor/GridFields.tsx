import { useId } from 'react'
import { Input, NumberField } from 'react-aria-components'
import {
  GRID_COUNT_MAX,
  GRID_COUNT_MIN,
  type GridField,
  type GridSource,
  type GridValues,
} from '../core'
import { Icon } from '../ui/Icon'
import { FIELD, SUB, T } from './editorChromeTokens'

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

interface GridFieldsTestIds {
  /** Input ids are `<field>-<GridField>`. */
  field: string
  link: string
  /** ↺ ids are `<reset>-<GridField>` (spread grid only). */
  reset: string
}

/** Spread grid (Designer GP2/GP3): per-field source and ↺ to the parent. */
interface GridInheritance {
  source: Record<GridField, GridSource>
  /** What a reset falls back to: the master name, or "book grid". */
  parentName: string
  onReset: (field: GridField) => void
}

/** One field's share of `GridInheritance`. */
interface FieldInheritance {
  source: GridSource
  parentName: string
  onReset: () => void
}

interface GridFieldsProps {
  values: GridValues
  linked: boolean
  onLinkedChange: (linked: boolean) => void
  onCommit: (field: GridField, value: number) => void
  testIds: GridFieldsTestIds
  /** Absent on the master: no source styling, no ↺. */
  inheritance?: GridInheritance
}

/**
 * Kit GridFields: C R / G RG, Margins + link, T B / I O. Shared by the master
 * inspector and the spread Grid Custom state (one field look).
 */
export function GridFields({
  values,
  linked,
  onLinkedChange,
  onCommit,
  testIds,
  inheritance,
}: GridFieldsProps) {
  const field = (spec: FieldSpec) => (
    <GridValueField
      key={spec.field}
      spec={spec}
      value={values[spec.field]}
      testIds={testIds}
      inherit={
        inheritance === undefined
          ? undefined
          : {
              source: inheritance.source[spec.field],
              parentName: inheritance.parentName,
              onReset: () => {
                inheritance.onReset(spec.field)
              },
            }
      }
      onCommit={(value) => {
        if (!Number.isNaN(value)) {
          onCommit(spec.field, value)
        }
      }}
    />
  )
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">{COUNTS.map(field)}</div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span style={{ color: SUB }}>Margins</span>
        <button
          type="button"
          className="e7-ghost insp-link-btn"
          aria-label="Link margins"
          aria-pressed={linked}
          data-testid={testIds.link}
          style={linked ? { background: FIELD, color: T } : { color: SUB }}
          onClick={() => {
            onLinkedChange(!linked)
          }}
        >
          <Icon name={linked ? 'link2' : 'unlink2'} size={14} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">{MARGINS.map(field)}</div>
    </div>
  )
}

function sourceText(source: GridSource, parentName: string): string {
  if (source === 'spread') {
    return 'set on this spread'
  }
  return source === 'master' ? `from ${parentName}` : 'from book grid'
}

/** Kit `Field` (v7.tsx:132): FIELD box, short label, mono value, unit, ↺. */
function GridValueField({
  spec,
  value,
  testIds,
  inherit,
  onCommit,
}: {
  spec: FieldSpec
  value: number
  testIds: GridFieldsTestIds
  inherit: FieldInheritance | undefined
  onCommit: (value: number) => void
}) {
  const descriptionId = useId()
  const counted = spec.unit === undefined
  const description =
    inherit === undefined
      ? undefined
      : `${spec.name} · ${sourceText(inherit.source, inherit.parentName)}`
  return (
    <NumberField
      value={value}
      minValue={counted ? GRID_COUNT_MIN : 0}
      {...(counted ? { maxValue: GRID_COUNT_MAX } : {})}
      step={counted ? 1 : 0.5}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
      onChange={onCommit}
      aria-label={spec.name}
      {...(inherit === undefined
        ? {}
        : { 'aria-describedby': descriptionId, 'data-source': inherit.source })}
      className="insp-size-field insp-grid-field"
    >
      <span
        className="text-center"
        style={{ color: SUB }}
        title={description ?? spec.name}
        aria-hidden="true"
      >
        {spec.short}
      </span>
      <Input
        title={description ?? spec.name}
        className="font-mono"
        // The spread grid colours the value by `data-source` (GridSection.css).
        style={inherit === undefined ? { color: T } : {}}
        data-testid={`${testIds.field}-${spec.field}`}
      />
      {spec.unit === undefined ? null : (
        <span style={{ color: SUB }}>{spec.unit}</span>
      )}
      {inherit === undefined ? null : (
        <>
          <span id={descriptionId} className="sr-only">
            {description}
          </span>
          {inherit.source === 'spread' ? (
            <ResetButton
              label={`Reset ${spec.name.replace(' (mm)', '')} to ${inherit.parentName}`}
              testId={`${testIds.reset}-${spec.field}`}
              onReset={inherit.onReset}
            />
          ) : null}
        </>
      )}
    </NumberField>
  )
}

/** GP3: ↺ inside the field after the unit, in the tab order after the input. */
function ResetButton({
  label,
  testId,
  onReset,
}: {
  label: string
  testId: string
  onReset: () => void
}) {
  return (
    <button
      type="button"
      className="e7-ghost insp-grid-reset"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={onReset}
    >
      <Icon name="rotateCcw" size={14} />
    </button>
  )
}
