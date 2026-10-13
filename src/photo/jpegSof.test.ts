import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import { readJpegSofSize, stripJpegExif } from './jpegSof'
import exifr from 'exifr'

describe('jpegSof', () => {
  it('reads SOF size and strips EXIF from orientation fixture', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    const size = readJpegSofSize(
      original.buffer.slice(
        original.byteOffset,
        original.byteOffset + original.byteLength,
      ),
    )
    expect(size).toEqual({ width: 40, height: 20 })
    expect(await exifr.orientation(original)).toBe(6)

    const stripped = stripJpegExif(
      original.buffer.slice(
        original.byteOffset,
        original.byteOffset + original.byteLength,
      ),
    )
    expect(await exifr.orientation(stripped)).toBeUndefined()
    expect(readJpegSofSize(stripped)).toEqual({ width: 40, height: 20 })
  })
})
