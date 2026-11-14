import { describe, expect, it } from 'vitest'
import { genericPrintProfile } from '../print/genericProfile'
import {
  ADOBE_RGB_ICC,
  CAMERA_SRGB_ICC,
  colorJpeg,
  DISPLAY_P3_ICC,
} from '../testing/colorFixtures'
import { colorWarnings } from './colorPreflight'
import { readSourceColor } from './iccProfile'

const FIXTURES = {
  'srgb-tagged': colorJpeg('srgb-tagged', CAMERA_SRGB_ICC),
  untagged: colorJpeg('untagged'),
  'adobe-rgb': colorJpeg('adobe-rgb', ADOBE_RGB_ICC),
  'display-p3': colorJpeg('display-p3', DISPLAY_P3_ICC),
}

describe('colorWarnings', () => {
  it('warns exactly for the non-sRGB color fixtures on an sRGB profile', async () => {
    const sources = await Promise.all(
      Object.entries(FIXTURES).map(async ([assetId, bytes]) => ({
        assetId,
        family: (await readSourceColor(bytes)).family,
      })),
    )

    expect(colorWarnings(sources, genericPrintProfile())).toEqual([
      { assetId: 'adobe-rgb', family: 'adobe-rgb' },
      { assetId: 'display-p3', family: 'display-p3' },
    ])
  })

  it('warns for other RGB spaces but not for gray or CMYK photos', () => {
    expect(
      colorWarnings(
        [
          { assetId: 'pro-photo', family: 'other-rgb' },
          { assetId: 'gray', family: 'other' },
          { assetId: 'plain', family: 'srgb' },
        ],
        { colorSpace: 'srgb' },
      ),
    ).toEqual([{ assetId: 'pro-photo', family: 'other-rgb' }])
  })
})
