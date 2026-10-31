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

/** Labels live in the slot's bottom padding (44 px); hidden below this zoom. */
export const PAGE_LABELS_MIN_ZOOM = 0.85

export function pageLabelsFit(zoom: number): boolean {
  return zoom >= PAGE_LABELS_MIN_ZOOM
}
