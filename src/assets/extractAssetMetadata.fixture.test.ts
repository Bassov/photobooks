import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import { extractAssetMetadata } from './extractAssetMetadata'

describe('extractAssetMetadata fixture', () => {
  it('reads orientation from sample-orient6 via real exifr', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const original = readFileSync(photoFixturePaths.sampleOrient6)
    const buffer = original.buffer.slice(
      original.byteOffset,
      original.byteOffset + original.byteLength,
    )

    const result = await extractAssetMetadata(buffer, 'image/jpeg')

    expect(result.orientation).toBe(6)
    expect(result.mime).toBe('image/jpeg')
  })
})
