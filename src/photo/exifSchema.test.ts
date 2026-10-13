import { describe, expect, it } from 'vitest'
import { exifParseSchema } from './exifSchema'

describe('exifParseSchema', () => {
  it('accepts valid orientation and size fields', () => {
    const parsed = exifParseSchema.parse({
      Orientation: 6,
      ImageWidth: 40,
      ImageHeight: 20,
      ExifImageWidth: 40,
      ExifImageHeight: 20,
    })

    expect(parsed).toEqual({
      Orientation: 6,
      ImageWidth: 40,
      ImageHeight: 20,
      ExifImageWidth: 40,
      ExifImageHeight: 20,
    })
  })

  it('accepts empty object', () => {
    expect(exifParseSchema.parse({})).toEqual({})
  })

  it('rejects invalid orientation', () => {
    expect(() => exifParseSchema.parse({ Orientation: 9 })).toThrow()
  })

  it('rejects non-positive dimensions', () => {
    expect(() => exifParseSchema.parse({ ImageWidth: 0 })).toThrow()
  })
})
