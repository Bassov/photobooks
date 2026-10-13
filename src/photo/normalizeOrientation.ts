import type { ExifOrientation, OrientationTransform } from './types'

export function normalizeOrientation(
  orientation: ExifOrientation,
  width: number,
  height: number,
): OrientationTransform {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('width and height must be positive finite numbers')
  }

  const swap = orientation >= 5
  const correctedW = swap ? height : width
  const correctedH = swap ? width : height

  switch (orientation) {
    case 1:
      return { rotation: 0, flipX: false, flipY: false, correctedW, correctedH }
    case 2:
      return { rotation: 0, flipX: true, flipY: false, correctedW, correctedH }
    case 3:
      return {
        rotation: 180,
        flipX: false,
        flipY: false,
        correctedW,
        correctedH,
      }
    case 4:
      return { rotation: 0, flipX: false, flipY: true, correctedW, correctedH }
    case 5:
      return { rotation: 90, flipX: true, flipY: false, correctedW, correctedH }
    case 6:
      return {
        rotation: 90,
        flipX: false,
        flipY: false,
        correctedW,
        correctedH,
      }
    case 7:
      return {
        rotation: 270,
        flipX: true,
        flipY: false,
        correctedW,
        correctedH,
      }
    case 8:
      return {
        rotation: 270,
        flipX: false,
        flipY: false,
        correctedW,
        correctedH,
      }
  }
}
