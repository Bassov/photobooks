import type { Book, Spread } from '../schema'

/** Inspector-facing grid fields; `inside` / `outside` are the page-scoped margins. */
export const GRID_FIELDS = [
  'top',
  'bottom',
  'inside',
  'outside',
  'columns',
  'rows',
  'columnGutterMm',
  'rowGutterMm',
] as const

export type GridField = (typeof GRID_FIELDS)[number]
export type GridValues = Record<GridField, number>
export type GridPatch = Partial<GridValues>
export type GridSource = 'book' | 'spread'

export const GRID_COUNT_MIN = 1
export const GRID_COUNT_MAX = 12
/** Upper bound for margins and gutters so a typo cannot blow up the layout. */
const GRID_MM_MAX = 1000

type Grid = Book['layoutGrid']
type GridOverride = NonNullable<Spread['layoutGrid']>

/**
 * Stub until the page-scoped schema lands (`layout-grids-schema`): `inside`
 * and `outside` are stored in the v3 `left` / `right` margins.
 */
const MARGIN_KEY = {
  top: 'top',
  bottom: 'bottom',
  inside: 'left',
  outside: 'right',
} as const

type MarginField = keyof typeof MARGIN_KEY

function isMarginField(field: GridField): field is MarginField {
  return field in MARGIN_KEY
}

export function clampGridValue(field: GridField, value: number): number {
  if (!Number.isFinite(value)) {
    return field === 'columns' || field === 'rows' ? GRID_COUNT_MIN : 0
  }
  if (field === 'columns' || field === 'rows') {
    return Math.min(GRID_COUNT_MAX, Math.max(GRID_COUNT_MIN, Math.round(value)))
  }
  return Math.min(GRID_MM_MAX, Math.max(0, value))
}

export function readGridField(grid: Grid, field: GridField): number {
  return isMarginField(field) ? grid.margins[MARGIN_KEY[field]] : grid[field]
}

function readOverrideField(
  override: GridOverride | undefined,
  field: GridField,
): number | undefined {
  if (override === undefined) {
    return undefined
  }
  return isMarginField(field)
    ? override.margins?.[MARGIN_KEY[field]]
    : override[field]
}

/** The spread's override of one field, if any. */
export function spreadOverrideValue(
  spread: Spread,
  field: GridField,
): number | undefined {
  return readOverrideField(spread.layoutGrid, field)
}

/** True when the spread overrides this single field. */
export function overridesGridField(spread: Spread, field: GridField): boolean {
  return readOverrideField(spread.layoutGrid, field) !== undefined
}

export function hasGridOverride(spread: Spread): boolean {
  return GRID_FIELDS.some((field) => overridesGridField(spread, field))
}

/** The book grid with the spread's per-field overrides applied. */
export function resolveLayoutGrid(book: Book, spread?: Spread): Grid {
  const override = spread?.layoutGrid
  if (override === undefined) {
    return book.layoutGrid
  }
  const base = book.layoutGrid
  return {
    columns: override.columns ?? base.columns,
    rows: override.rows ?? base.rows,
    columnGutterMm: override.columnGutterMm ?? base.columnGutterMm,
    rowGutterMm: override.rowGutterMm ?? base.rowGutterMm,
    margins: {
      top: override.margins?.top ?? base.margins.top,
      bottom: override.margins?.bottom ?? base.margins.bottom,
      left: override.margins?.left ?? base.margins.left,
      right: override.margins?.right ?? base.margins.right,
    },
  }
}

export function effectiveGrid(
  book: Book,
  spread?: Spread,
): { values: GridValues; source: Record<GridField, GridSource> } {
  const grid = resolveLayoutGrid(book, spread)
  const values = {} as GridValues
  const source = {} as Record<GridField, GridSource>
  for (const field of GRID_FIELDS) {
    values[field] = readGridField(grid, field)
    source[field] =
      spread !== undefined && overridesGridField(spread, field)
        ? 'spread'
        : 'book'
  }
  return { values, source }
}

export function patchBookGrid(grid: Grid, patch: GridPatch): Grid {
  const margins = { ...grid.margins }
  const next: Grid = { ...grid, margins }
  for (const field of GRID_FIELDS) {
    const raw = patch[field]
    if (raw === undefined) {
      continue
    }
    const value = clampGridValue(field, raw)
    if (isMarginField(field)) {
      margins[MARGIN_KEY[field]] = value
    } else {
      next[field] = value
    }
  }
  return next
}

export function patchGridOverride(
  override: GridOverride | undefined,
  patch: GridPatch,
): GridOverride {
  const margins = { ...override?.margins }
  const next: GridOverride = { ...override }
  for (const field of GRID_FIELDS) {
    const raw = patch[field]
    if (raw === undefined) {
      continue
    }
    const value = clampGridValue(field, raw)
    if (isMarginField(field)) {
      margins[MARGIN_KEY[field]] = value
    } else {
      next[field] = value
    }
  }
  if (Object.keys(margins).length > 0) {
    next.margins = margins
  }
  return next
}
