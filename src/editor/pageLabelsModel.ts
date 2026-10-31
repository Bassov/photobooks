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
