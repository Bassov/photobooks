/** Kit `PageLabels`: left/right page number under a regular spread. */
export function pageLabelTexts(spreadIndex: number): [string, string] {
  if (spreadIndex === 0) return ['', '1']
  return [String(spreadIndex * 2), String(spreadIndex * 2 + 1)]
}

/** Labels live in the slot's bottom padding (24 px × zoom); hide when clipped. */
export const PAGE_LABELS_MIN_ZOOM = 0.85

export function pageLabelsFit(zoom: number): boolean {
  return zoom >= PAGE_LABELS_MIN_ZOOM
}
