import { mergeGridLevels } from './grid/layoutGrid'
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
