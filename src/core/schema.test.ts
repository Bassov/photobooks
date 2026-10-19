import { describe, expect, it } from 'vitest'
import { bookSchema, CURRENT_SCHEMA_VERSION } from './index'
import { makeBook, makeBookWithAsset } from './testing/fixtures'
import assert from 'node:assert/strict'

describe('bookSchema', () => {
  it('parses a minimal valid book', () => {
    const result = bookSchema.safeParse(makeBook())
    expect(result.success).toBe(true)
    assert.equal(result.success, true)
    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('parses a book with placed asset and crop', () => {
    const result = bookSchema.safeParse(makeBookWithAsset())
    expect(result.success).toBe(true)
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
})
