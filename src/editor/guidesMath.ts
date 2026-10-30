import { GUIDE_OVERSHOOT_MM } from '../core'

export type GuideOrientation = 'horizontal' | 'vertical'

export type GuideDrop = 'commit' | 'remove' | 'cancel'

/** Offset in mm along the guide's axis for a client pointer coordinate (0.1 mm steps). */
export function guideOffsetMm(
  pointerPx: number,
  originPx: number,
  pxPerMm: number,
): number {
  return Math.round(((pointerPx - originPx) / pxPerMm) * 10) / 10
}

/** True while the offset is on the spread or within the overshoot margin around it. */
export function guideInRange(offsetMm: number, extentMm: number): boolean {
  return (
    offsetMm > -GUIDE_OVERSHOOT_MM && offsetMm < extentMm + GUIDE_OVERSHOOT_MM
  )
}

/**
 * What releasing a guide drag does. Dropping back on the ruler or far off the
 * spread removes an existing guide and abandons a new one.
 */
export function guideDropOutcome(input: {
  offsetMm: number
  extentMm: number
  overRuler: boolean
  existing: boolean
}): GuideDrop {
  if (input.overRuler || !guideInRange(input.offsetMm, input.extentMm)) {
    return input.existing ? 'remove' : 'cancel'
  }
  return 'commit'
}
