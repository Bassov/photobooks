/** Chip text shown on the hovered drop-target frame (editor CSS reads it). */
export function dropChipLabel(filled: boolean): string {
  return filled ? 'Release to replace' : 'Release to place'
}
