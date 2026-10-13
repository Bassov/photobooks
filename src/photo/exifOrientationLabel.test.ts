import { describe, expect, it } from 'vitest'
import { exifOrientationFromLabel } from './exifOrientationLabel'

describe('exifOrientationFromLabel', () => {
  it('maps known EXIF orientation labels', () => {
    expect(exifOrientationFromLabel('Rotate 90 CW')).toBe(6)
    expect(exifOrientationFromLabel('Horizontal (normal)')).toBe(1)
  })

  it('returns undefined for unknown labels', () => {
    expect(exifOrientationFromLabel('not-a-label')).toBeUndefined()
  })
})
