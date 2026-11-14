import type { PrintProfile } from '../print/profileSchema'
import type { ColorFamily } from './iccProfile'

export interface SourceColorEntry {
  assetId: string
  /** `readSourceColor(bytes).family`. */
  family: ColorFamily
}

export interface ColorWarning {
  assetId: string
  /** The photo's RGB space, other than the print profile's. */
  family: Exclude<ColorFamily, 'other'>
}

const PRINT_FAMILY: Readonly<Record<PrintProfile['colorSpace'], ColorFamily>> =
  {
    srgb: 'srgb',
  }

/**
 * Photos in another RGB space than the print profile's (Adobe RGB, Display P3
 * … on an sRGB printer): their saturated colors shift or clip on paper.
 * Gray and CMYK photos are not RGB and get no warning.
 */
export function colorWarnings(
  sources: readonly SourceColorEntry[],
  profile: Pick<PrintProfile, 'colorSpace'>,
): ColorWarning[] {
  const target = PRINT_FAMILY[profile.colorSpace]
  return sources.flatMap(({ assetId, family }) =>
    family === target || family === 'other' ? [] : [{ assetId, family }],
  )
}
