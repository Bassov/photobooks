import { describe, expect, it } from 'vitest'
import { acceptedPhotoAcceptAttr, isAcceptedPhotoMime } from './mime'

describe('isAcceptedPhotoMime', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'IMAGE/JPEG'])(
    'accepts %s',
    (mime) => {
      expect(isAcceptedPhotoMime(mime)).toBe(true)
    },
  )

  it.each([
    'image/tiff',
    'image/gif',
    'application/pdf',
    '',
    'image/heic',
    'image/heif',
  ])('rejects %s', (mime) => {
    expect(isAcceptedPhotoMime(mime)).toBe(false)
  })
})

describe('acceptedPhotoAcceptAttr', () => {
  it('lists jpeg png webp and HEIC for picker visibility', () => {
    expect(acceptedPhotoAcceptAttr()).toBe(
      'image/jpeg,image/png,image/webp,.heic,.heif,image/heic,image/heif',
    )
  })
})
