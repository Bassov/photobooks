import {
  GRID_FIELDS,
  clearGridOverrideFields,
  gridFieldSource,
  mergeLayoutGrid,
  overridesGridField,
  patchBookGrid,
  patchGridOverride,
  readGridField,
  readOverrideField,
  type GridField,
  type GridPatch,
} from '../grid/layoutGrid'
import { omitKey } from '../omitKey'
import type { Book, Spread } from '../schema'
import { spreadParent } from '../spreadParent'
import { templatedSpread } from '../templates/apply'
import { isTemplateId } from '../templates/types'
import { updateSpread } from '../update'

type GridOverride = NonNullable<Spread['layoutGrid']>

/** Template geometry reads margins and gutters; columns and rows only draw the overlay. */
const FRAME_FIELDS: ReadonlySet<GridField> = new Set([
  'top',
  'bottom',
  'inside',
  'outside',
  'columnGutterMm',
  'rowGutterMm',
])

/**
 * Templated spreads regenerate their frames from the new grid in one pass;
 * placements stay, and unchanged spreads and frames keep their objects.
 */
export function realign(book: Book, spreadIds: readonly string[]): Book {
  const ids = new Set(spreadIds)
  const spreads = book.spreads.map((spread, index) => {
    const { templateId } = spread
    return ids.has(spread.id) &&
      templateId !== undefined &&
      isTemplateId(templateId)
      ? templatedSpread(book, index, spread, templateId)
      : spread
  })
  return spreads.some((spread, index) => spread !== book.spreads[index])
    ? { ...book, spreads }
    : book
}

/**
 * Re-aligns the spreads of `after` whose resolved margins or gutters differ
 * from `before` (a parent deleted or a new book default); both books keep
 * the same spread order.
 */
export function realignResolvedGrids(before: Book, after: Book): Book {
  const moved = after.spreads.filter((spread, index) => {
    const from = mergeLayoutGrid(before, before.spreads[index])
    const to = mergeLayoutGrid(after, spread)
    return [...FRAME_FIELDS].some(
      (field) => readGridField(from, field) !== readGridField(to, field),
    )
  })
  return realign(
    after,
    moved.map((spread) => spread.id),
  )
}

export function setBookGrid(book: Book, patch: GridPatch): Book {
  const layoutGrid = patchBookGrid(book.layoutGrid, patch)
  const changed = GRID_FIELDS.filter(
    (field) =>
      readGridField(layoutGrid, field) !==
      readGridField(book.layoutGrid, field),
  )
  if (changed.length === 0) {
    return book
  }
  const next = { ...book, layoutGrid }
  const moving = changed.filter((field) => FRAME_FIELDS.has(field))
  if (moving.length === 0) {
    return next
  }
  // Re-resolve only spreads that read a moving field from the book.
  const affected = book.spreads
    .filter((spread) =>
      moving.some((field) => gridFieldSource(book, spread, field) === 'book'),
    )
    .map((spread) => spread.id)
  return realign(next, affected)
}

/**
 * Spreads that read a changed field from the edited level: the spread `id`
 * itself, or for a master every spread using it that does not override one.
 */
function gridReaders(
  book: Book,
  id: string,
  changed: readonly GridField[],
): string[] {
  if (book.spreads.some((spread) => spread.id === id)) {
    return [id]
  }
  return book.spreads
    .filter(
      (spread) =>
        spreadParent(book, spread)?.id === id &&
        changed.some((field) => !overridesGridField(spread, field)),
    )
    .map((spread) => spread.id)
}

/**
 * Edits the grid override of a spread or a master and re-aligns the spreads
 * reading a changed field from it; no changed field → the same book.
 */
function editGridOverride(
  book: Book,
  id: string,
  edit: (override: GridOverride | undefined) => GridOverride | undefined,
): Book {
  const owner =
    book.spreads.find((spread) => spread.id === id) ??
    book.parents?.find((parent) => parent.id === id)
  if (owner === undefined) {
    return book
  }
  const layoutGrid = edit(owner.layoutGrid)
  const changed = GRID_FIELDS.filter(
    (field) =>
      readOverrideField(layoutGrid, field) !==
      readOverrideField(owner.layoutGrid, field),
  )
  if (changed.length === 0) {
    return book
  }
  const next = updateSpread(book, id, (spread) =>
    layoutGrid === undefined
      ? omitKey(spread, 'layoutGrid')
      : { ...spread, layoutGrid },
  )
  const moving = changed.filter((field) => FRAME_FIELDS.has(field))
  return moving.length === 0
    ? next
    : realign(next, gridReaders(next, id, moving))
}

export function setSpreadGrid(
  book: Book,
  spreadId: string,
  patch: GridPatch,
): Book {
  return editGridOverride(book, spreadId, (override) =>
    patchGridOverride(override, patch),
  )
}

export function resetSpreadGrid(book: Book, spreadId: string): Book {
  return editGridOverride(book, spreadId, () => undefined)
}

/** Drops single overrides; the spread reads those fields from its parent again. */
export function resetSpreadGridFields(
  book: Book,
  spreadId: string,
  fields: readonly GridField[],
): Book {
  return editGridOverride(book, spreadId, (override) =>
    clearGridOverrideFields(override, fields),
  )
}
