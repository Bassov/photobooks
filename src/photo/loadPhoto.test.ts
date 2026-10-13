import { describe, expect, it } from 'vitest'
import { loadPhoto } from './loadPhoto'
import { UnsupportedPhotoFormatError } from './types'

describe('loadPhoto', () => {
  it('rejects image/tiff before worker work', async () => {
    const file = new File([new Uint8Array([0])], 'scan.tiff', {
      type: 'image/tiff',
    })
    await expect(loadPhoto(file)).rejects.toBeInstanceOf(
      UnsupportedPhotoFormatError,
    )
  })
})
