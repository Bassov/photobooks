/**
 * Designer cycle-layouts CL3 (Owner Q-27; kit twin `uikit/src/sandbox/layout-cycle.tsx`):
 * step the active spread through the picker layouts with its photo-frame count.
 */
import {
  isTextFrame,
  type Book,
  type SavedTemplate,
  type Spread,
} from '../core'
import { getBookStoreSnapshot } from './bookStore'
import {
  applyLayout,
  cycleSet,
  pickerLayouts,
  stepLayout,
  type LayoutItem,
} from './layoutCatalog'
import { getCropTarget, subscribeCropMode } from './cropMode'
import { getLeftPanelTab, subscribeLeftPanelTab } from './leftPanelTabStore'
import { getLiveGeometry, subscribeLiveGeometry } from './liveGeometry'
import { getSavedTemplates } from './savedTemplates'
import { getTextEdit, subscribeTextEdit } from './textEditStore'

const CUSTOM_LAYOUT_NAME = 'Custom'
const CHANGE_LAYOUT_LABEL = 'Change layout'

export interface LayoutCycleState {
  /** Picker layouts with the spread's photo-frame count, in picker order. */
  set: LayoutItem[]
  /** The current layout's index in `set`; -1 = Custom. */
  index: number
  name: string
}

/** D3: the spread's own photo frames, filled or empty (not text). */
function photoSlotCount(spread: Spread): number {
  return spread.frames.filter((frame) => !isTextFrame(frame)).length
}

export function layoutCycleOf(
  book: Book,
  spreadIndex: number,
  mine: readonly SavedTemplate[],
): LayoutCycleState {
  const spread = book.spreads[spreadIndex]
  if (spread === undefined) {
    return { set: [], index: -1, name: CUSTOM_LAYOUT_NAME }
  }
  const { items, aliases } = pickerLayouts(book, spreadIndex, spread, mine)
  const set = cycleSet(items, photoSlotCount(spread))
  const stored = spread.templateId
  // No stored id looks up nothing and stays undefined (Custom).
  const lookup: ReadonlyMap<string | undefined, string> = aliases
  const current = lookup.get(stored) ?? stored
  const index = set.findIndex((item) => item.id === current)
  return {
    set,
    index,
    name: set[index]?.name ?? CUSTOM_LAYOUT_NAME,
  }
}

/**
 * Editor states that hide the pill and mute the keys (Spec "Shown only
 * when"): Masters, a crop, a text edit, a live frame move / resize / rotate.
 * Asset drag, marquee and Preview are read from the DOM (CSS / keys).
 */
export function layoutCycleBlocked(): boolean {
  return (
    getLeftPanelTab() !== 'pages' ||
    getCropTarget() !== null ||
    getTextEdit() !== null ||
    getLiveGeometry() !== null
  )
}

export function subscribeLayoutCycleBlocked(listener: () => void): () => void {
  const offs = [
    subscribeLeftPanelTab(listener),
    subscribeCropMode(listener),
    subscribeTextEdit(listener),
    subscribeLiveGeometry(listener),
  ]
  return () => {
    for (const off of offs) {
      off()
    }
  }
}

/** D5: presses on one spread share one history step. */
function cycleHistoryKey(spreadId: string): string {
  return `cycleLayout:${spreadId}`
}

/**
 * Apply the previous / next layout of the set to a spread with the picker's
 * op; false when the spread has no cycle (unknown, no photo frame, set < 2).
 */
export function cycleLayout(spreadId: string, dir: 1 | -1): boolean {
  const { book } = getBookStoreSnapshot()
  const spreadIndex = book.spreads.findIndex((spread) => spread.id === spreadId)
  const { set, index } = layoutCycleOf(book, spreadIndex, getSavedTemplates())
  const next = set.length < 2 ? undefined : stepLayout(set, set[index]?.id, dir)
  if (next === undefined) {
    return false
  }
  applyLayout(spreadId, next.id, {
    historyKey: cycleHistoryKey(spreadId),
    label: CHANGE_LAYOUT_LABEL,
  })
  return true
}
