import { mergeGridLevels } from './grid/layoutGrid'
import { omitKey } from './omitKey'
import type { Guide } from './ops/guides'
import type { Book, Frame, ParentSpread, Spread } from './schema'

/** Where a resolved item comes from: the parent, a spread-local copy of a parent item, or the spread itself. */
export type ParentLayer = 'parent' | 'override' | 'spread'

export interface ResolvedFrame {
  frame: Frame
  layer: ParentLayer
}

export interface ResolvedGuide {
  guide: Guide
  layer: ParentLayer
}

/**
 * The spread's parent: `parentId` when set, else the book default; `null`
 * (None) or an id with no parent resolves to none.
 */
export function spreadParent(
  book: Book,
  spread: Spread,
): ParentSpread | undefined {
  const id =
    spread.parentId === undefined ? book.defaultParentId : spread.parentId
  return book.parents?.find((parent) => parent.id === id)
}

/** Spread index a parent edits and paints at: any value below 0 is two pages. */
export const PARENT_SPREAD_INDEX = -1

const parentViews = new WeakMap<ParentSpread, Spread>()

/**
 * A parent as a spread (its items, guides and partial grid, no parent of its
 * own) so Masters mode edits and paints it through the spread paths. One view
 * per parent object: paint caches key on its identity.
 */
export function parentAsSpread(parent: ParentSpread): Spread {
  const cached = parentViews.get(parent)
  if (cached !== undefined) {
    return cached
  }
  const view: Spread = {
    id: parent.id,
    parentId: null,
    frames: parent.frames,
    guides: parent.guides,
    ...(parent.layoutGrid === undefined
      ? {}
      : { layoutGrid: parent.layoutGrid }),
  }
  parentViews.set(parent, view)
  return view
}

/** The spread with `id` and its index, else the parent with `id` as a spread. */
export function editableSpread(
  book: Book,
  id: string,
): { spread: Spread; index: number } | undefined {
  const index = book.spreads.findIndex((spread) => spread.id === id)
  const spread = book.spreads[index]
  if (spread !== undefined) {
    return { spread, index }
  }
  const parent = book.parents?.find((item) => item.id === id)
  return parent === undefined
    ? undefined
    : { spread: parentAsSpread(parent), index: PARENT_SPREAD_INDEX }
}

/** First `Master <letter>` (A–Z, then numbered) no parent is named. */
function nextParentName(parents: readonly ParentSpread[]): string {
  const taken = new Set(parents.map((parent) => parent.name))
  for (let n = 0; ; n += 1) {
    const suffix = n < 26 ? String.fromCharCode(65 + n) : String(n - 25)
    const name = `Master ${suffix}`
    if (!taken.has(name)) {
      return name
    }
  }
}

/** First `parent-<n>` used by no spread and no parent. */
export function nextParentId(book: Book): string {
  let n = (book.parents?.length ?? 0) + 1
  while (editableSpread(book, `parent-${String(n)}`) !== undefined) {
    n += 1
  }
  return `parent-${String(n)}`
}

/** New empty parent at the end of the list; an `id` taken by a spread or parent leaves the book. */
export function addParent(book: Book, id = nextParentId(book)): Book {
  if (editableSpread(book, id) !== undefined) {
    return book
  }
  const parents = book.parents ?? []
  const parent: ParentSpread = {
    id,
    name: nextParentName(parents),
    frames: [],
    guides: [],
  }
  return { ...book, parents: [...parents, parent] }
}

/** Parent `id` replaced by `update(parent)`; an unknown id or the same object leaves the book. */
export function updateParentSpread(
  book: Book,
  id: string,
  update: (parent: ParentSpread) => ParentSpread,
): Book {
  if (book.parents === undefined) {
    return book
  }
  const index = book.parents.findIndex((parent) => parent.id === id)
  const current = book.parents[index]
  if (current === undefined) {
    return book
  }
  const next = update(current)
  if (next === current) {
    return book
  }
  const parents = book.parents.slice()
  parents[index] = next
  return { ...book, parents }
}

/** Trimmed, non-empty name; the same or a blank name leaves the book. */
export function renameParent(book: Book, id: string, name: string): Book {
  const next = name.trim()
  return updateParentSpread(book, id, (current) =>
    next === '' || next === current.name ? current : { ...current, name: next },
  )
}

/**
 * Delete a parent: spreads that stored its id and a matching book default
 * fall back to None.
 */
export function removeParent(book: Book, id: string): Book {
  const parents = book.parents
  if (!parents?.some((parent) => parent.id === id)) {
    return book
  }
  const next: Book = {
    ...book,
    parents: parents.filter((parent) => parent.id !== id),
  }
  if (next.defaultParentId === id) {
    delete next.defaultParentId
  }
  // Stored like setSpreadParent: absent already means None without a default.
  const none = (spread: Spread): Spread =>
    next.defaultParentId === undefined
      ? omitKey(spread, 'parentId')
      : { ...spread, parentId: null }
  next.spreads = book.spreads.map((spread) =>
    spread.parentId === id ? none(spread) : spread,
  )
  return next
}

/** Grid chain: book grid → parent partial grid → spread override. */
export function resolveParentGrid(
  book: Book,
  spread: Spread,
): Book['layoutGrid'] {
  return mergeGridLevels(book.layoutGrid, [
    spreadParent(book, spread)?.layoutGrid,
    spread.layoutGrid,
  ])
}

/** Parent ids the spread hides or replaces with a local copy. */
function suppressedIds(spread: Spread): ReadonlySet<string | undefined> {
  const overrides = spread.parentOverrides
  return new Set(
    [
      overrides?.hiddenIds,
      overrides?.frames?.map((copy) => copy.overridesId),
      overrides?.guides?.map((copy) => copy.overridesId),
    ].flat(),
  )
}

function byZ(frames: readonly Frame[]): Frame[] {
  return frames.toSorted((a, b) => a.z - b.z)
}

/**
 * Paint order (bottom first): parent frames minus hidden / overridden, then
 * the spread's local copies, then the spread's own frames; each layer by `z`.
 */
export function resolveParentFrames(
  book: Book,
  spread: Spread,
): ResolvedFrame[] {
  const suppressed = suppressedIds(spread)
  const inherited = (spreadParent(book, spread)?.frames ?? []).filter(
    (frame) => !suppressed.has(frame.id),
  )
  return [
    ...byZ(inherited).map((frame) => ({ frame, layer: 'parent' as const })),
    ...byZ(spread.parentOverrides?.frames ?? []).map((frame) => ({
      frame,
      layer: 'override' as const,
    })),
    ...byZ(spread.frames).map((frame) => ({ frame, layer: 'spread' as const })),
  ]
}

/** Parent guides minus hidden / overridden, then local copies, then the spread's own. */
export function resolveParentGuides(
  book: Book,
  spread: Spread,
): ResolvedGuide[] {
  const suppressed = suppressedIds(spread)
  const inherited = (spreadParent(book, spread)?.guides ?? []).filter(
    (guide) => !suppressed.has(guide.id),
  )
  return [
    ...inherited.map((guide) => ({ guide, layer: 'parent' as const })),
    ...(spread.parentOverrides?.guides ?? []).map((guide) => ({
      guide,
      layer: 'override' as const,
    })),
    ...(spread.guides ?? []).map((guide) => ({
      guide,
      layer: 'spread' as const,
    })),
  ]
}
