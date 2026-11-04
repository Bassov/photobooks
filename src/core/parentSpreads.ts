import { mergeGridLevels } from './grid/layoutGrid'
import { omitKey } from './omitKey'
import { realignResolvedGrids } from './ops/grid'
import type { Guide } from './ops/guides'
import type {
  Book,
  Frame,
  ParentOverrides,
  ParentSpread,
  Spread,
} from './schema'
import { spreadParent } from './spreadParent'
import { updateSpread } from './update'

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

export { spreadParent }

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
 * fall back to None, and the spreads whose grid changes re-align.
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
  return realignResolvedGrids(book, keepOverridesOnParentChange(book, next))
}

/**
 * The book default parent (`null` = none); an unknown id or the current
 * default leaves the book. Stored `parentId` values stay; the spreads
 * whose grid changes re-align.
 */
export function setDefaultParent(book: Book, id: string | null): Book {
  if (
    (id ?? undefined) === book.defaultParentId ||
    (id !== null && !book.parents?.some((parent) => parent.id === id))
  ) {
    return book
  }
  const next =
    id === null
      ? omitKey(book, 'defaultParentId')
      : { ...book, defaultParentId: id }
  return realignResolvedGrids(book, keepOverridesOnParentChange(book, next))
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

function byZ<T extends Frame>(frames: readonly T[]): T[] {
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

/** First `copy-<n>` not in `taken`. */
function nextCopyId(taken: ReadonlySet<string>): string {
  let n = 1
  while (taken.has(`copy-${String(n)}`)) {
    n += 1
  }
  return `copy-${String(n)}`
}

/** `parentOverrides` = `next` minus empty lists; nothing left → the field is gone. */
function withOverrides(spread: Spread, next: ParentOverrides): Spread {
  const kept: ParentOverrides = {}
  if (next.hiddenIds !== undefined && next.hiddenIds.length > 0) {
    kept.hiddenIds = next.hiddenIds
  }
  if (next.frames !== undefined && next.frames.length > 0) {
    kept.frames = next.frames
  }
  if (next.guides !== undefined && next.guides.length > 0) {
    kept.guides = next.guides
  }
  const rest = omitKey(spread, 'parentOverrides')
  return Object.keys(kept).length === 0
    ? rest
    : { ...rest, parentOverrides: kept }
}

/**
 * Copy the resolved parent item `parentItemId` into the spread's local copies
 * (`id`, else the first free `copy-<n>`); the resolver then paints the copy
 * instead. An unknown, hidden or already overridden item or a taken `id`
 * leaves the book.
 */
function overrideParentItem(
  book: Book,
  spreadId: string,
  parentItemId: string,
  id: string | undefined,
  kind: 'frames' | 'guides',
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const items: readonly { id: string }[] =
      spreadParent(book, spread)?.[kind] ?? []
    const source = items.find((item) => item.id === parentItemId)
    if (source === undefined || suppressedIds(spread).has(parentItemId)) {
      return spread
    }
    const overrides = spread.parentOverrides ?? {}
    const own: readonly { id: string }[] =
      kind === 'frames' ? spread.frames : (spread.guides ?? [])
    const taken = new Set(
      [...items, ...own, ...(overrides[kind] ?? [])].map((item) => item.id),
    )
    const copyId = id ?? nextCopyId(taken)
    if (taken.has(copyId)) {
      return spread
    }
    const copy = { ...source, id: copyId, overridesId: parentItemId }
    return {
      ...spread,
      parentOverrides: {
        ...overrides,
        [kind]: [...(overrides[kind] ?? []), copy],
      },
    }
  })
}

/** Override a parent frame on the spread: a local copy the spread edits on its own. */
export function overrideParentFrame(
  book: Book,
  spreadId: string,
  parentFrameId: string,
  id?: string,
): Book {
  return overrideParentItem(book, spreadId, parentFrameId, id, 'frames')
}

/** Override a parent guide on the spread: a local copy the spread edits on its own. */
export function overrideParentGuide(
  book: Book,
  spreadId: string,
  parentGuideId: string,
  id?: string,
): Book {
  return overrideParentItem(book, spreadId, parentGuideId, id, 'guides')
}

/** Overrides without the copies and the hidden entry of `parentItemId`. */
function withoutItem(
  overrides: ParentOverrides,
  parentItemId: string,
): ParentOverrides {
  const other = ({ overridesId }: { overridesId: string }) =>
    overridesId !== parentItemId
  return {
    hiddenIds: overrides.hiddenIds?.filter((id) => id !== parentItemId),
    frames: overrides.frames?.filter(other),
    guides: overrides.guides?.filter(other),
  }
}

/**
 * Hide a parent frame or guide on the spread ("not on this spread"): its
 * copy, if any, goes and the id joins `hiddenIds`. An id that is neither a
 * parent item nor copied, or one already hidden, leaves the book.
 */
export function hideParentItem(
  book: Book,
  spreadId: string,
  parentItemId: string,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const overrides = spread.parentOverrides ?? {}
    const parent = spreadParent(book, spread)
    const copied = [
      ...(overrides.frames ?? []),
      ...(overrides.guides ?? []),
    ].some((copy) => copy.overridesId === parentItemId)
    const inherited = [
      ...(parent?.frames ?? []),
      ...(parent?.guides ?? []),
    ].some((item) => item.id === parentItemId)
    const hidden = overrides.hiddenIds?.includes(parentItemId) === true
    if (!copied && (hidden || !inherited)) {
      return spread
    }
    const next = withoutItem(overrides, parentItemId)
    return withOverrides(spread, {
      ...next,
      hiddenIds: [...(next.hiddenIds ?? []), parentItemId],
    })
  })
}

/** Back to the parent for one item: its copy and hidden entry go. Untouched → unchanged. */
export function resetParentItem(
  book: Book,
  spreadId: string,
  parentItemId: string,
): Book {
  return updateSpread(book, spreadId, (spread) =>
    spread.parentOverrides === undefined ||
    !suppressedIds(spread).has(parentItemId)
      ? spread
      : withOverrides(
          spread,
          withoutItem(spread.parentOverrides, parentItemId),
        ),
  )
}

/** Back to the parent for every item: `parentOverrides` goes. */
export function resetSpreadToParent(book: Book, spreadId: string): Book {
  return updateSpread(book, spreadId, (spread) =>
    spread.parentOverrides === undefined
      ? spread
      : omitKey(spread, 'parentOverrides'),
  )
}

/** `item` without `overridesId`, renamed to a free `copy-<n>` when its id is taken. */
function asOwn<T extends { id: string; overridesId: string }>(
  item: T,
  taken: Set<string>,
): Omit<T, 'overridesId'> {
  const own = omitKey(item, 'overridesId')
  const id = taken.has(item.id) ? nextCopyId(taken) : item.id
  taken.add(id)
  return { ...own, id }
}

/**
 * Keep the spread's work when its parent changes: local copies become own
 * frames beneath every own frame (relative order kept; the template goes),
 * copied guides become own guides and hidden ids are dropped.
 */
export function keepOverridesAsOwn(spread: Spread): Spread {
  const overrides = spread.parentOverrides
  if (overrides === undefined) {
    return spread
  }
  let next = omitKey(spread, 'parentOverrides')
  const copies = byZ(overrides.frames ?? [])
  if (copies.length > 0) {
    const taken = new Set(spread.frames.map((frame) => frame.id))
    const bottom = Math.min(...spread.frames.map((frame) => frame.z))
    const frames = copies.map((copy, rank) => ({
      ...asOwn(copy, taken),
      z: spread.frames.length === 0 ? copy.z : bottom - copies.length + rank,
    }))
    next = omitKey(
      { ...next, frames: [...frames, ...spread.frames] },
      'templateId',
    )
  }
  const guides = overrides.guides ?? []
  if (guides.length > 0) {
    const own = next.guides ?? []
    const taken = new Set(own.map((guide) => guide.id))
    next = {
      ...next,
      guides: [...own, ...guides.map((guide) => asOwn(guide, taken))],
    }
  }
  return next
}

/** `after` with the work kept on every spread whose resolved parent differs from `before`. */
function keepOverridesOnParentChange(before: Book, after: Book): Book {
  const spreads = after.spreads.map((spread, index) => {
    const prev = before.spreads[index]
    return spread.parentOverrides === undefined ||
      (prev !== undefined &&
        spreadParent(before, prev)?.id === spreadParent(after, spread)?.id)
      ? spread
      : keepOverridesAsOwn(spread)
  })
  return spreads.some((spread, index) => spread !== after.spreads[index])
    ? { ...after, spreads }
    : after
}
