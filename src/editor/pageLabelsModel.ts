/**
 * Kit `PageLabels`: left/right page number under a regular spread. A single
 * page (page 1, a single last page) has one number, centred under it.
 */
export function pageLabelTexts(
  spreadIndex: number,
  pages: 1 | 2 = 2,
): [string, string] {
  if (spreadIndex === 0) return ['', '1']
  const left = String(spreadIndex * 2)
  return pages === 1 ? [left, ''] : [left, String(spreadIndex * 2 + 1)]
}

/** Screen px from the page's bottom edge to the label top, at every zoom. */
export const PAGE_LABEL_OFFSET_PX = 8

/** Label font size and line box in screen px; does not scale with zoom. */
export const PAGE_LABEL_LINE_PX = 11

/**
 * Labels live in the gap at a constant screen size; a gap shorter than the
 * offset plus the line hides them rather than overlap the next spread.
 */
export const PAGE_LABELS_MIN_GAP_PX = PAGE_LABEL_OFFSET_PX + PAGE_LABEL_LINE_PX

export function pageLabelsFit(gapPx: number): boolean {
  return gapPx >= PAGE_LABELS_MIN_GAP_PX
}

/** "Drop here for a new spread" pill height in screen px (kit `GapDrop` `h-8`). */
export const NEW_SPREAD_PILL_HEIGHT_PX = 32

/**
 * Screen px the pill centre sits below the gap's centre: it is centred
 * between the page-number line bottom and the next spread's top, i.e.
 * 19 + (gap − 19) / 2 = gap / 2 + 19 / 2 under the page (Owner Must M56,
 * round 8).
 */
export const NEW_SPREAD_PILL_SHIFT_PX = PAGE_LABELS_MIN_GAP_PX / 2

/**
 * The pill keeps a constant screen size and clears the page numbers above
 * it (and the same room below): a shorter gap hides it.
 */
export const NEW_SPREAD_PILL_MIN_GAP_PX =
  NEW_SPREAD_PILL_HEIGHT_PX + 2 * PAGE_LABELS_MIN_GAP_PX

export function newSpreadPillFits(gapPx: number): boolean {
  return gapPx >= NEW_SPREAD_PILL_MIN_GAP_PX
}
