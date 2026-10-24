import { describe, expect, it } from 'vitest'
import { partitionImportFiles } from './pickPhotos'
import { acceptedPhotoAcceptAttr, isAcceptedPhotoMime } from './mime'

describe('isAcceptedPhotoMime', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'IMAGE/JPEG',
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
  ])('accepts %s', (mime) => {
    expect(isAcceptedPhotoMime(mime)).toBe(true)
  })

  it.each(['image/tiff', 'image/gif', 'application/pdf', ''])(
    'rejects %s',
    (mime) => {
      expect(isAcceptedPhotoMime(mime)).toBe(false)
    },
  )
})

describe('isAcceptedPhotoMime import gate', () => {
  it('accepts jpeg by MIME without any file extension', () => {
    const jpeg = new File([new Uint8Array([1])], 'no-extension', {
      type: 'image/jpeg',
    })
    const { accepted, rejected } = partitionImportFiles([jpeg])
    expect(accepted).toEqual([jpeg])
    expect(rejected).toEqual([])
  })

  it('accepts webp by MIME without a known extension', () => {
    const webp = new File([new Uint8Array([1])], 'blob.bin', {
      type: 'image/webp',
    })
    const { accepted, rejected } = partitionImportFiles([webp])
    expect(accepted).toEqual([webp])
    expect(rejected).toEqual([])
  })
})

describe('acceptedPhotoAcceptAttr', () => {
  it('lists jpeg png webp and HEIC for picker visibility', () => {
    expect(acceptedPhotoAcceptAttr()).toBe(
      'image/jpeg,image/png,image/webp,.heic,.heif,image/heic,image/heif',
    )
  })
})
