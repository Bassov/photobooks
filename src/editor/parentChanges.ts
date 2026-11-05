import {
  isTextFrame,
  onSpreadPage,
  resolveTextContent,
  spreadParent,
  type Book,
  type Frame,
  type Guide,
  type Spread,
} from '../core'

interface SpreadItemTarget {
  spreadId: string
  frameId: string
}

/** One "Changed from {parent}" row (Designer parent-overrides PO7). */
export interface ParentChange {
  /** The parent frame or guide the row resets. */
  parentItemId: string
  state: 'override' | 'hidden'
  name: string
}

const TEXT_NAME_CHARS = 24

function spreadOf(book: Book, spreadId: string): Spread | undefined {
  return book.spreads.find((spread) => spread.id === spreadId)
}

/** The book spread's local copy `target` names; undefined for own frames. */
export function overrideCopyOf(
  book: Book,
  target: SpreadItemTarget,
): (Frame & { overridesId: string }) | undefined {
  return spreadOf(book, target.spreadId)?.parentOverrides?.frames?.find(
    (frame) => frame.id === target.frameId,
  )
}

/** The parent a local copy overrides ("Override · {name}"); null otherwise. */
export function overrideParentName(
  book: Book,
  target: SpreadItemTarget,
): string | null {
  const spread = spreadOf(book, target.spreadId)
  return spread === undefined || overrideCopyOf(book, target) === undefined
    ? null
    : (spreadParent(book, spread)?.name ?? null)
}

function frameName(book: Book, spread: Spread, frame: Frame): string {
  if (isTextFrame(frame)) {
    const text = resolveTextContent(book, spread, frame).text
    return `Text “${text.slice(0, TEXT_NAME_CHARS)}”`
  }
  return frame.assetId === undefined ? 'Empty frame' : 'Photo frame'
}

/** `Guide · vertical 74.2 mm`: one decimal, a trailing .0 dropped. */
function guideName(guide: Guide): string {
  const mm = String(Number(guide.offsetMm.toFixed(1)))
  return `Guide · ${guide.orientation} ${mm} mm`
}

/** Vertical guides first, then horizontal; each by position. */
function byPosition<T extends Guide>(guides: readonly T[]): T[] {
  return guides.toSorted(
    (a, b) =>
      Number(a.orientation === 'horizontal') -
        Number(b.orientation === 'horizontal') || a.offsetMm - b.offsetMm,
  )
}

/**
 * What the spread changed from its parent, in the Designer order: overridden
 * frames, hidden frames, overridden guides, hidden guides; frames by parent z
 * (top first), guides vertical then horizontal by position. Hidden ids whose
 * parent item is gone are not listed; a copy whose parent item is gone is.
 */
export function parentChanges(book: Book, spread: Spread): ParentChange[] {
  const overrides = spread.parentOverrides
  if (overrides === undefined) {
    return []
  }
  const parent = spreadParent(book, spread)
  const parentFrames = (parent?.frames ?? []).toSorted((a, b) => b.z - a.z)
  const rank = (id: string) => {
    const at = parentFrames.findIndex((frame) => frame.id === id)
    return at === -1 ? parentFrames.length : at
  }
  const hidden = new Set(overrides.hiddenIds)
  const spreadIndex = book.spreads.indexOf(spread)
  const hiddenGuides = (parent?.guides ?? [])
    .filter((guide) => hidden.has(guide.id))
    .flatMap((guide) => onSpreadPage(book, spreadIndex, guide) ?? [])
  return [
    ...(overrides.frames ?? [])
      .toSorted((a, b) => rank(a.overridesId) - rank(b.overridesId))
      .map((copy) => ({
        parentItemId: copy.overridesId,
        state: 'override' as const,
        name: frameName(book, spread, copy),
      })),
    ...parentFrames
      .filter((frame) => hidden.has(frame.id))
      .map((frame) => ({
        parentItemId: frame.id,
        state: 'hidden' as const,
        name: frameName(book, spread, frame),
      })),
    ...byPosition(overrides.guides ?? []).map((copy) => ({
      parentItemId: copy.overridesId,
      state: 'override' as const,
      name: guideName(copy),
    })),
    ...byPosition(hiddenGuides).map((guide) => ({
      parentItemId: guide.id,
      state: 'hidden' as const,
      name: guideName(guide),
    })),
  ]
}
