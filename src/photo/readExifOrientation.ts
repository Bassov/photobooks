import exifr from 'exifr'
import { exifOrientationFromLabel } from './exifOrientationLabel'
import type { ExifOrientation } from './types'

/** Best-effort EXIF orientation 1..8; soft-fails to 1. */
export async function readExifOrientation(
  buffer: ArrayBuffer,
): Promise<ExifOrientation> {
  try {
    const raw: unknown = await exifr.orientation(buffer)
    if (typeof raw === 'number' && raw >= 1 && raw <= 8) {
      return raw as ExifOrientation
    }
    if (typeof raw === 'string') {
      const mapped = exifOrientationFromLabel(raw)
      if (mapped !== undefined) {
        return mapped
      }
    }
    const parsed: unknown = await exifr.parse(buffer, {
      pick: ['Orientation'],
      translateValues: false,
      reviveValues: false,
    })
    if (parsed && typeof parsed === 'object') {
      const value = (parsed as { Orientation?: unknown }).Orientation
      if (typeof value === 'number' && value >= 1 && value <= 8) {
        return value as ExifOrientation
      }
    }
  } catch {
    // Fall through.
  }
  return 1
}
