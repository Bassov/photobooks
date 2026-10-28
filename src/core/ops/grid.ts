import {
  GRID_FIELDS,
  overridesGridField,
  patchBookGrid,
  patchGridOverride,
  readGridField,
  spreadOverrideValue,
  type GridPatch,
} from '../grid/layoutGrid'
import type { Book } from '../schema'
import { applyTemplate } from '../templates/apply'
import { isTemplateId } from '../templates/types'
import { updateSpread } from '../update'

/** Templated spreads regenerate their frames from the new grid; placements stay. */
function realign(book: Book, spreadIds: readonly string[]): Book {
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
      changed.some((field) => !overridesGridField(spread, field)),
    )
    .map((spread) => spread.id)
  return realign({ ...book, layoutGrid }, affected)
}

export function setSpreadGrid(
  book: Book,
  spreadId: string,
  patch: GridPatch,
): Book {
  const next = updateSpread(book, spreadId, (spread) => {
    const layoutGrid = patchGridOverride(spread.layoutGrid, patch)
    const candidate = { ...spread, layoutGrid }
    const unchanged = GRID_FIELDS.every(
      (field) =>
        spreadOverrideValue(candidate, field) ===
        spreadOverrideValue(spread, field),
    )
    return unchanged ? spread : candidate
  })
  return realign(next, [spreadId])
}

export function resetSpreadGrid(book: Book, spreadId: string): Book {
  const next = updateSpread(book, spreadId, (spread) => {
    if (spread.layoutGrid === undefined) {
      return spread
    }
    const rest = { ...spread }
    delete rest.layoutGrid
    return rest
  })
  return realign(next, [spreadId])
}
