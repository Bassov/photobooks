import type { RectMm } from '../geometry/types'
import { getSpreadPageCount } from '../geometry/spreadSize'
import type { Book, Spread } from '../schema'
import { spreadParent } from '../spreadParent'

/** Inspector-facing grid fields; `inside` is the spine side, `outside` the fore-edge. */
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
export type GridSource = 'book' | 'master' | 'spread'

export const GRID_COUNT_MIN = 1
export const GRID_COUNT_MAX = 12
/** Upper bound for margins and gutters so a typo cannot blow up the layout. */
const GRID_MM_MAX = 1000

type Grid = Book['layoutGrid']
type GridOverride = NonNullable<Spread['layoutGrid']>

const MARGIN_FIELDS = ['top', 'bottom', 'inside', 'outside'] as const
type MarginField = (typeof MARGIN_FIELDS)[number]

function isMarginField(field: GridField): field is MarginField {
  return (MARGIN_FIELDS as readonly string[]).includes(field)
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
  return isMarginField(field) ? grid.margins[field] : grid[field]
}

/** The value one grid level (spread or master override) stores for `field`. */
export function readOverrideField(
  override: GridOverride | undefined,
  field: GridField,
): number | undefined {
  if (override === undefined) {
    return undefined
  }
  return isMarginField(field) ? override.margins?.[field] : override[field]
}

/** True when the spread overrides this single field. */
export function overridesGridField(spread: Spread, field: GridField): boolean {
  return readOverrideField(spread.layoutGrid, field) !== undefined
}

export function hasGridOverride(spread: Spread): boolean {
  return GRID_FIELDS.some((field) => overridesGridField(spread, field))
}

/** The partial grid of the spread's parent (master), if it has one. */
function parentGridOf(
  book: Book,
  spread: Spread | undefined,
): GridOverride | undefined {
  return spread === undefined
    ? undefined
    : spreadParent(book, spread)?.layoutGrid
}

/** Override levels above the book grid, lowest priority first: parent, then spread. */
function gridOverrides(book: Book, spread: Spread | undefined): GridOverride[] {
  return [parentGridOf(book, spread), spread?.layoutGrid].filter(
    (level) => level !== undefined,
  )
}

/** `base` with each override level applied per field, later levels winning. */
export function mergeGridLevels(
  base: Grid,
  overrides: readonly (GridOverride | undefined)[],
): Grid {
  const pick = (field: GridField): number =>
    overrides.reduce(
      (value, level) => readOverrideField(level, field) ?? value,
      readGridField(base, field),
    )
  return {
    columns: pick('columns'),
    rows: pick('rows'),
    columnGutterMm: pick('columnGutterMm'),
    rowGutterMm: pick('rowGutterMm'),
    margins: {
      top: pick('top'),
      bottom: pick('bottom'),
      inside: pick('inside'),
      outside: pick('outside'),
    },
  }
}

/** The book grid with the parent's, then the spread's per-field overrides applied. */
export function mergeLayoutGrid(book: Book, spread?: Spread): Grid {
  const overrides = gridOverrides(book, spread)
  return overrides.length === 0
    ? book.layoutGrid
    : mergeGridLevels(book.layoutGrid, overrides)
}

function fieldSource(
  field: GridField,
  spread: Spread | undefined,
  parentGrid: GridOverride | undefined,
): GridSource {
  if (spread !== undefined && overridesGridField(spread, field)) {
    return 'spread'
  }
  return readOverrideField(parentGrid, field) === undefined ? 'book' : 'master'
}

/** The level one field of the spread's effective grid comes from. */
export function gridFieldSource(
  book: Book,
  spread: Spread,
  field: GridField,
): GridSource {
  return fieldSource(field, spread, parentGridOf(book, spread))
}

export function effectiveGrid(
  book: Book,
  spread?: Spread,
): { values: GridValues; source: Record<GridField, GridSource> } {
  const grid = mergeLayoutGrid(book, spread)
  const parentGrid = parentGridOf(book, spread)
  const values = {} as GridValues
  const source = {} as Record<GridField, GridSource>
  for (const field of GRID_FIELDS) {
    values[field] = readGridField(grid, field)
    source[field] = fieldSource(field, spread, parentGrid)
  }
  return { values, source }
}

export interface PageGrid {
  /** Page box in spread coordinates. */
  page: RectMm
  /** Page minus margins. */
  content: RectMm
  columns: RectMm[]
  rows: RectMm[]
}

export interface ResolvedLayoutGrid {
  values: GridValues
  source: Record<GridField, GridSource>
  pages: [PageGrid] | [PageGrid, PageGrid]
}

/** Equal bands of `count` separated by `gutter`, clamped so they never go negative. */
function bands(
  start: number,
  length: number,
  count: number,
  gutter: number,
): { start: number; size: number }[] {
  const size = Math.max(0, (length - (count - 1) * gutter) / count)
  return Array.from({ length: count }, (_, i) => ({
    start: start + i * (size + gutter),
    size,
  }))
}

function computeLayoutGrid(
  book: Book,
  spreadIndex: number,
  spread: Spread | undefined,
): ResolvedLayoutGrid {
  const { values, source } = effectiveGrid(book, spread)
  const { widthMm, heightMm } = book.settings.trim
  const count = getSpreadPageCount(spreadIndex, book.spreads.length)
  const pageAt = (p: number): PageGrid => {
    // Facing pages mirror: `inside` is the spine side. A lone page past the
    // cover is the last (left-hand) one; the first / only page is right-hand.
    const leftHand = count === 2 ? p === 0 : spreadIndex > 0
    const marginLeft = leftHand ? values.outside : values.inside
    const marginRight = leftHand ? values.inside : values.outside
    const x = p * widthMm
    const content: RectMm = {
      x: x + marginLeft,
      y: values.top,
      width: Math.max(0, widthMm - marginLeft - marginRight),
      height: Math.max(0, heightMm - values.top - values.bottom),
    }
    return {
      page: { x, y: 0, width: widthMm, height: heightMm },
      content,
      columns: bands(
        content.x,
        content.width,
        values.columns,
        values.columnGutterMm,
      ).map((b) => ({
        x: b.start,
        y: content.y,
        width: b.size,
        height: content.height,
      })),
      rows: bands(
        content.y,
        content.height,
        values.rows,
        values.rowGutterMm,
      ).map((b) => ({
        x: content.x,
        y: b.start,
        width: content.width,
        height: b.size,
      })),
    }
  }
  const pages: ResolvedLayoutGrid['pages'] =
    count === 2 ? [pageAt(0), pageAt(1)] : [pageAt(0)]
  return { values, source, pages }
}

interface CacheEntry {
  grid: Grid
  parentGrid: GridOverride | undefined
  trim: Book['settings']['trim']
  spreadCount: number
  spreadIndex: number
  result: ResolvedLayoutGrid
}

const cache = new WeakMap<Spread, CacheEntry>()

/**
 * Per-page content box, column and row rects of one spread, after the
 * inheritance chain book grid → parent grid → spread override. Memoized by
 * spread reference (the entry is reused while the book grid, parent grid, trim,
 * spread count and index match).
 * `spread` defaults to the book's spread at `spreadIndex`; pass a candidate to
 * resolve a spread that is not stored yet.
 */
export function resolveLayoutGrid(
  book: Book,
  spreadIndex: number,
  spread: Spread | undefined = book.spreads[spreadIndex],
): ResolvedLayoutGrid {
  if (spread === undefined) {
    return computeLayoutGrid(book, spreadIndex, undefined)
  }
  const hit = cache.get(spread)
  const parentGrid = parentGridOf(book, spread)
  if (
    hit?.grid === book.layoutGrid &&
    hit.parentGrid === parentGrid &&
    hit.trim === book.settings.trim &&
    hit.spreadCount === book.spreads.length &&
    hit.spreadIndex === spreadIndex
  ) {
    return hit.result
  }
  const result = computeLayoutGrid(book, spreadIndex, spread)
  cache.set(spread, {
    grid: book.layoutGrid,
    parentGrid,
    trim: book.settings.trim,
    spreadCount: book.spreads.length,
    spreadIndex,
    result,
  })
  return result
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
      margins[field] = value
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
      margins[field] = value
    } else {
      next[field] = value
    }
  }
  if (Object.keys(margins).length > 0) {
    next.margins = margins
  }
  return next
}

/** `override` without `fields`; `undefined` once no field is left. */
export function clearGridOverrideFields(
  override: GridOverride | undefined,
  fields: readonly GridField[],
): GridOverride | undefined {
  const kept: GridPatch = {}
  for (const field of GRID_FIELDS) {
    const value = readOverrideField(override, field)
    if (value !== undefined && !fields.includes(field)) {
      kept[field] = value
    }
  }
  return Object.keys(kept).length === 0
    ? undefined
    : patchGridOverride(undefined, kept)
}
