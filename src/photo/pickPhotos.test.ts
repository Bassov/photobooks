import { describe, expect, it } from 'vitest'
import { partitionImportFiles } from './pickPhotos'

describe('partitionImportFiles', () => {
  it('keeps jpeg/png/webp and rejects tiff without dropping accepted', () => {
    const jpeg = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const tiff = new File([new Uint8Array([1])], 'scan.tiff', {
      type: 'image/tiff',
    })
    const png = new File([new Uint8Array([1])], 'b.png', { type: 'image/png' })
    const { accepted, rejected } = partitionImportFiles([jpeg, tiff, png])
    expect(accepted).toEqual([jpeg, png])
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.file).toBe(tiff)
    expect(rejected[0]?.reason).toMatch(/Unsupported/i)
  })
})
