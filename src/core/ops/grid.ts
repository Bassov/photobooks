import {
  GRID_FIELDS,
  clearGridOverrideFields,
  gridFieldSource,
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
import { applyTemplate } from '../templates/apply'
import { isTemplateId } from '../templates/types'
import { updateSpread } from '../update'

type GridOverride = NonNullable<Spread['layoutGrid']>

/** Templated spreads regenerate their frames from the new grid; placements stay. */
export function realign(book: Book, spreadIds: readonly string[]): Book {
  return book.spreads.reduce(
    (acc, { id, templateId }) =>
      spreadIds.includes(id) &&
      templateId !== undefined &&
      isTemplateId(templateId)
        ? applyTemplate(acc, id, templateId)
        : acc,
    book,
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
  // Re-resolve only spreads that read a changed field from the book.
  const affected = book.spreads
    .filter((spread) =>
      changed.some((field) => gridFieldSource(book, spread, field) === 'book'),
    )
    .map((spread) => spread.id)
  return realign({ ...book, layoutGrid }, affected)
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
  return realign(next, gridReaders(next, id, changed))
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
