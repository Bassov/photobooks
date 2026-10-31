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

/**
 * Labels live in the slot's bottom padding (the gap): 6 px under the spread
 * plus a 16 px line. A shorter gap hides them rather than overlap the next
 * spread.
 */
export const PAGE_LABELS_MIN_GAP_PX = 22

export function pageLabelsFit(gapPx: number): boolean {
  return gapPx >= PAGE_LABELS_MIN_GAP_PX
}
