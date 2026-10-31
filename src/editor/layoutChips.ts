/** Kit photo-count chips (uikit/src/sandbox/context-inspector.tsx:93-94). */
export const LAYOUT_CHIPS = [
  ['all', 'Any'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['4', '4+'],
] as const

export type LayoutChipId = (typeof LAYOUT_CHIPS)[number][0]

/** Any matches all; N matches exactly N photo slots; 4+ matches four or more. */
export function matchesChip(slots: number, chip: LayoutChipId): boolean {
  if (chip === 'all') {
    return true
  }
  return chip === '4' ? slots >= 4 : slots === Number(chip)
}
