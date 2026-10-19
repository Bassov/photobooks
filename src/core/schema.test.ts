import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { bookSchema, CURRENT_SCHEMA_VERSION } from './index'
import { makeBook, makeBookWithAsset } from './testing/fixtures'

const FULL_META_ASSET = {
  sourceRootId: 'root-1',
  relativePath: 'vacation/IMG_001.jpg',
  byteSize: 1024,
  mtimeMs: 1_700_000_000_000,
  contentHash:
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  widthPx: 4000,
  heightPx: 3000,
  orientation: 1,
  capturedAt: '2024-06-01T12:00:00Z',
  colorSpace: 'sRGB',
  iccProfileName: 'sRGB IEC61966-2.1',
  mime: 'image/jpeg',
  meta: {
    title: 'Sunset',
    caption: 'On the pier',
    keywords: ['summer', 'beach'],
    camera: 'Canon EOS R5',
    lens: 'RF 24-70',
    gps: { lat: 37.77, lon: -122.42 },
  },
}

describe('bookSchema', () => {
  it('parses a minimal valid book', () => {
    const result = bookSchema.safeParse(makeBook())
    expect(result.success).toBe(true)
    assert.equal(result.success, true)
    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.data.title).toBeUndefined()
  })

  it('parses a book with placed asset and crop', () => {
    const result = bookSchema.safeParse(makeBookWithAsset())
    expect(result.success).toBe(true)
  })

  it('retains a non-empty book title', () => {
    const result = bookSchema.safeParse(makeBook({ title: 'Summer' }))
    expect(result.success).toBe(true)
    assert.equal(result.success, true)
    expect(result.data.title).toBe('Summer')
  })

  it('parses a full metadata asset record', () => {
    const result = bookSchema.safeParse(
      makeBook({
        assets: { a: FULL_META_ASSET },
        gallery: ['a'],
      }),
    )
    expect(result.success).toBe(true)
    assert.equal(result.success, true)
    expect(result.data.assets.a).toEqual(FULL_META_ASSET)
  })

  it('rejects crop zoom below 1', () => {
    const book = makeBookWithAsset()
    const spread = book.spreads[0]
    const frame = spread?.frames[0]
    assert(
      frame !== undefined && spread !== undefined,
      'expected fixture frame',
    )
    const invalid = {
      ...book,
      spreads: [
        {
          ...spread,
          frames: [
            { ...frame, crop: { zoom: 0.5, center: { x: 0.5, y: 0.5 } } },
          ],
        },
      ],
    }
    expect(bookSchema.safeParse(invalid).success).toBe(false)
  })

  it.each([
    [{ orientation: 0 }],
    [{ orientation: 9 }],
    [{ orientation: 1.5 }],
    [{ widthPx: 0 }],
    [{ heightPx: -1 }],
    [{ capturedAt: '' }],
    [{ colorSpace: '' }],
    [{ iccProfileName: '' }],
    [{ mime: '' }],
    [{ meta: { title: '' } }],
    [{ meta: { caption: '' } }],
    [{ meta: { camera: '' } }],
    [{ meta: { lens: '' } }],
    [{ meta: { keywords: [''] } }],
    [{ meta: { gps: { lat: Number.NaN, lon: 0 } } }],
    [{ meta: { gps: { lat: 0, lon: Number.POSITIVE_INFINITY } } }],
  ])('rejects malformed metadata field %j', (asset) => {
    expect(
      bookSchema.safeParse(
        makeBook({
          assets: { a: asset },
          gallery: ['a'],
        }),
      ).success,
    ).toBe(false)
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'accepts EXIF orientation %i',
    (orientation) => {
      expect(
        bookSchema.safeParse(
          makeBook({
            assets: { a: { orientation } },
            gallery: ['a'],
          }),
        ).success,
      ).toBe(true)
    },
  )

  it('rejects duplicate gallery ids with message and path', () => {
    const result = bookSchema.safeParse(
      makeBook({
        assets: { a: {} },
        gallery: ['a', 'a'],
      }),
    )
    expect(result.success).toBe(false)
    assert.equal(result.success, false)
    const issue = result.error.issues.find(
      (entry) => entry.message === 'Gallery ids must be unique',
    )
    expect(issue).toMatchObject({
      code: 'custom',
      message: 'Gallery ids must be unique',
      path: ['gallery', 1],
    })
  })
})
