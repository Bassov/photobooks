import {
  getSpreadPageCount,
  spreadParent,
  type Book,
  type Frame,
  type GridField,
  type GridPatch,
  type GridValues,
  type Spread,
} from '../core'
import { pageLabel } from './editorChromePanels'
import type { FrameSource } from './frameSelection'

export type InspectorView =
  | { kind: 'frame'; spread: Spread; spreadIndex: number; frame: Frame }
  | { kind: 'spread'; spread: Spread; spreadIndex: number }
  | { kind: 'empty' }

/** What the panel paints: view kind and its spread (no crop state). */
export type InspectorPanel =
  | { kind: 'empty' }
  | { kind: 'spread'; spreadId: string }
  /** The frame's spread: what the Spread context edits. */
  | { kind: 'frame'; spreadId: string }

/** Value equality so book edits that leave the panel unchanged skip a render. */
export function sameInspectorPanel(
  a: InspectorPanel,
  b: InspectorPanel,
): boolean {
  if (a.kind === 'empty' || b.kind === 'empty') {
    return a.kind === b.kind
  }
  return a.kind === b.kind && a.spreadId === b.spreadId
}

/** Frame wins, then the active spread (unless Esc dismissed it), else empty. */
export function inspectorView(
  book: Book,
  frameSource: FrameSource | null,
  activeSpreadId: string | null,
  dismissedSpreadId: string | null,
): InspectorView {
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
  const at = book.spreads.findIndex((spread) => spread.id === activeSpreadId)
  const spread = book.spreads[at]
  if (spread && activeSpreadId !== dismissedSpreadId) {
    return { kind: 'spread', spread, spreadIndex: at }
  }
  return { kind: 'empty' }
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
