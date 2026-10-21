import { describe, expect, it } from 'vitest'
import {
  acceptedPhotoAcceptAttr,
  isAcceptedPhotoMime,
  isHeicLikeFile,
} from './mime'

describe('isAcceptedPhotoMime', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'IMAGE/JPEG'])(
    'accepts %s',
    (mime) => {
      expect(isAcceptedPhotoMime(mime)).toBe(true)
    },
  )

  it.each(['image/tiff', 'image/gif', 'application/pdf', ''])(
    'rejects %s',
    (mime) => {
      expect(isAcceptedPhotoMime(mime)).toBe(false)
    },
  )
})

describe('acceptedPhotoAcceptAttr', () => {
  it('lists jpeg png webp', () => {
    expect(acceptedPhotoAcceptAttr()).toBe('image/jpeg,image/png,image/webp')
  })
})

describe('isHeicLikeFile', () => {
  it('detects HEIC by mime and extension', () => {
    expect(
      isHeicLikeFile({ name: 'scan.HEIC', type: 'application/octet-stream' }),
    ).toBe(true)
    expect(isHeicLikeFile({ name: 'a.heif', type: '' })).toBe(true)
    expect(isHeicLikeFile({ name: 'a.jpg', type: 'image/heic' })).toBe(true)
    expect(isHeicLikeFile({ name: 'a.jpg', type: 'image/heif' })).toBe(true)
    expect(isHeicLikeFile({ name: 'a.jpg', type: 'image/heic-sequence' })).toBe(
      true,
    )
    expect(isHeicLikeFile({ name: 'a.jpg', type: 'image/heif-sequence' })).toBe(
      true,
    )
    expect(isHeicLikeFile({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false)
    expect(isHeicLikeFile({ name: 'a.png', type: 'image/png' })).toBe(false)
  })
})
