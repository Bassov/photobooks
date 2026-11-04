import {
  getSpreadPageCount,
  pageLabel,
  spreadParent,
  type Book,
  type Frame,
  type GridField,
  type GridPatch,
  type GridValues,
  type Spread,
} from '../core'
import type { FrameSelection, FrameSource } from './frameSelection'

export type InspectorView =
  | { kind: 'frame'; spread: Spread; spreadIndex: number; frame: Frame }
  | {
      kind: 'multi'
      spread: Spread
      spreadIndex: number
      frames: Frame[]
      set: FrameSelection
    }
  | { kind: 'spread'; spread: Spread; spreadIndex: number }
  | { kind: 'empty' }

/** What the panel paints: view kind and its spread (no crop state). */
export type InspectorPanel =
  | { kind: 'empty' }
  | { kind: 'spread'; spreadId: string }
  /** The frame's spread: what the Spread context edits. */
  | { kind: 'frame'; spreadId: string }
  /** 2 or more frames on one book spread (kit Multiple selection). */
  | { kind: 'multi'; spreadId: string; set: FrameSelection }

/** Value equality so book edits that leave the panel unchanged skip a render. */
export function sameInspectorPanel(
  a: InspectorPanel,
  b: InspectorPanel,
): boolean {
  if (a.kind === 'empty' || b.kind === 'empty') {
    return a.kind === b.kind
  }
  if (a.kind === 'multi' && b.kind === 'multi') {
    // The selection store keeps the object until the set changes.
    return a.set === b.set
  }
  return a.kind === b.kind && a.spreadId === b.spreadId
}

/**
 * 2 or more selected frames on a book spread win, then one frame, then the
 * active spread (the first one while none is active, as the kit's clamped
 * `cur`). Empty only for a book without spreads.
 */
export function inspectorView(
  book: Book,
  frameSource: FrameSource | null,
  activeSpreadId: string | null,
  selection: FrameSelection | null = null,
): InspectorView {
  const multi = multiView(book, selection)
  if (multi !== null) {
    return multi
  }
  const picked = book.spreads.findIndex(
    (spread) => spread.id === frameSource?.spreadId,
  )
  const pickedSpread = book.spreads[picked]
  const frame = pickedSpread?.frames.find(
    (item) => item.id === frameSource?.frameId,
  )
  if (pickedSpread && frame) {
    return { kind: 'frame', spread: pickedSpread, spreadIndex: picked, frame }
  }
  const at = Math.max(
    0,
    book.spreads.findIndex((spread) => spread.id === activeSpreadId),
  )
  const spread = book.spreads[at]
  return spread
    ? { kind: 'spread', spread, spreadIndex: at }
    : { kind: 'empty' }
}

function multiView(
  book: Book,
  selection: FrameSelection | null,
): InspectorView | null {
  if (selection === null) {
    return null
  }
  const at = book.spreads.findIndex((item) => item.id === selection.spreadId)
  const spread = book.spreads[at]
  if (spread === undefined) {
    return null
  }
  const frames = spread.frames.filter((frame) =>
    selection.frameIds.includes(frame.id),
  )
  return frames.length < 2
    ? null
    : { kind: 'multi', spread, spreadIndex: at, frames, set: selection }
}

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`

/**
 * Kit Multiple selection meta (Designer Spec): "N frames · " plus the
 * non-zero parts of photos / empty / text, e.g. "3 frames · 2 photos, 1 empty".
 */
export function multiSummary(frames: readonly Frame[]): string {
  const text = frames.filter((frame) => frame.kind === 'text').length
  // Text frames never carry a photo.
  const photos = frames.filter((frame) => frame.assetId !== undefined).length
  const empty = frames.length - text - photos
  const parts = [
    photos > 0 ? plural(photos, 'photo', 'photos') : '',
    empty > 0 ? `${String(empty)} empty` : '',
    text > 0 ? `${String(text)} text` : '',
  ].filter((part) => part !== '')
  return `${plural(frames.length, 'frame', 'frames')} · ${parts.join(', ')}`
}

export const ALIGN_REASON = 'Needs 2 unlocked frames'
export const DISTRIBUTE_REASON = 'Select 3 or more unlocked frames'

/** Align needs 2 unlocked frames, Distribute 3; a reason when it cannot run. */
export function alignState(frames: readonly Frame[]): {
  locked: number
  alignReason: string | undefined
  distributeReason: string | undefined
} {
  const locked = frames.filter((frame) => frame.locked === true).length
  const unlocked = frames.length - locked
  return {
    locked,
    alignReason: unlocked >= 2 ? undefined : ALIGN_REASON,
    distributeReason: unlocked >= 3 ? undefined : DISTRIBUTE_REASON,
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * Align & distribute caption: "Selection W × H mm" over the box of every
 * selected frame (Position & size precision), plus " · L locked, skipped"
 * only when some are locked.
 */
export function selectionCaption(frames: readonly Frame[]): string {
  if (frames.length === 0) {
    return ''
  }
  const left = Math.min(...frames.map((frame) => frame.rect.x))
  const top = Math.min(...frames.map((frame) => frame.rect.y))
  const right = Math.max(
    ...frames.map((frame) => frame.rect.x + frame.rect.width),
  )
  const bottom = Math.max(
    ...frames.map((frame) => frame.rect.y + frame.rect.height),
  )
  const size = `Selection ${String(round1(right - left))} × ${String(round1(bottom - top))} mm`
  const { locked } = alignState(frames)
  return locked > 0 ? `${size} · ${String(locked)} locked, skipped` : size
}

/** Pages of every spread resolving to the parent: 2 per spread, 1 for a lone first / last page. */
export function parentUsage(book: Book, parentId: string): number {
  let pages = 0
  book.spreads.forEach((spread, index) => {
    if (spreadParent(book, spread)?.id === parentId) {
      pages += getSpreadPageCount(index, book.spreads.length)
    }
  })
  return pages
}

const MARGIN_FIELDS: readonly GridField[] = [
  'top',
  'bottom',
  'inside',
  'outside',
]

function isMargin(field: GridField): boolean {
  return MARGIN_FIELDS.includes(field)
}

/** One committed master grid value as a patch; a linked margin writes all four. */
export function masterGridPatch(
  field: GridField,
  value: number,
  linked: boolean,
): GridPatch {
  return linked && isMargin(field)
    ? { top: value, bottom: value, inside: value, outside: value }
    : { [field]: value }
}

/** The margin link starts on when all four margins match. */
export function marginsEqual(values: GridValues): boolean {
  return MARGIN_FIELDS.every((field) => values[field] === values.top)
}

/** Spread link-on (Designer GP5): only margins that differ from Top; null when none. */
export function linkMarginsPatch(values: GridValues): GridPatch | null {
  const differing = MARGIN_FIELDS.filter(
    (field) => values[field] !== values.top,
  )
  return differing.length === 0
    ? null
    : Object.fromEntries(differing.map((field) => [field, values.top]))
}

/** The fields one ↺ resets (Designer GP3): all four margins while linked. */
export function resetGridFields(
  field: GridField,
  linked: boolean,
): readonly GridField[] {
  return linked && isMargin(field) ? MARGIN_FIELDS : [field]
}

/** Master head subline (Designer MS1): "Used by N pages" / "Used by 1 page" / "Not used yet". */
export function parentUsageLabel(pages: number): string {
  if (pages === 0) {
    return 'Not used yet'
  }
  return pages === 1 ? 'Used by 1 page' : `Used by ${String(pages)} pages`
}

/** Kit spread label (uikit/src/sandbox/context-inspector.tsx:59): "Page 1" first. */
export function spreadLabel(index: number): string {
  return index === 0 ? 'Page 1' : `Pages ${pageLabel(index)}`
}

/** Kit Spread header (context-inspector.tsx:59): "Pages 2–3 · 1 empty". */
export function spreadSummary(book: Book, spreadId: string): string {
  const index = book.spreads.findIndex((item) => item.id === spreadId)
  const spread = book.spreads[index]
  if (spread === undefined) {
    return ''
  }
  // Kit counts empty image frames only; text frames never carry a photo.
  const empty = spread.frames.filter(
    (item) => item.kind !== 'text' && item.assetId === undefined,
  ).length
  return `${spreadLabel(index)} · ${String(empty)} empty`
}
