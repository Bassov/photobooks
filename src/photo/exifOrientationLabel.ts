import type { ExifOrientation } from './types'

const ORIENTATION_LABELS = {
  'Horizontal (normal)': 1,
  'Mirror horizontal': 2,
  'Rotate 180': 3,
  'Mirror vertical': 4,
  'Mirror horizontal and rotate 270 CW': 5,
  'Rotate 90 CW': 6,
  'Mirror horizontal and rotate 90 CW': 7,
  'Rotate 270 CW': 8,
} as const satisfies Record<string, ExifOrientation>

export function exifOrientationFromLabel(
  label: string,
): ExifOrientation | undefined {
  if (!(label in ORIENTATION_LABELS)) {
    return undefined
  }
  return ORIENTATION_LABELS[label as keyof typeof ORIENTATION_LABELS]
}
