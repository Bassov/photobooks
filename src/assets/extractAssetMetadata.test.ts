import { describe, expect, it, vi } from 'vitest'

import {
  extractAssetMetadata,
  mapExifToAssetMetadata,
} from './extractAssetMetadata'

const exifrApi = vi.hoisted(() => ({
  parse: vi.fn(),
}))

vi.mock('exifr', () => ({
  default: {
    parse: (...args: unknown[]): unknown => exifrApi.parse(...args) as unknown,
  },
}))

describe('mapExifToAssetMetadata', () => {
  it('maps orientation, dims, capture, color, camera, and GPS without consent', () => {
    const result = mapExifToAssetMetadata(
      {
        Orientation: 6,
        ImageWidth: 40,
        ImageHeight: 20,
        DateTimeOriginal: new Date('2020-01-02T03:04:05.000Z'),
        ColorSpace: 1,
        ProfileDescription: 'Display P3',
        Make: 'Acme',
        Model: 'Cam X',
        LensModel: '35mm',
        ImageDescription: 'Title',
        XPComment: 'Caption',
        Keywords: ['a', 'b'],
        latitude: 37.77,
        longitude: -122.42,
      },
      'image/jpeg',
    )

    expect(result).toEqual({
      widthPx: 20,
      heightPx: 40,
      orientation: 6,
      capturedAt: '2020-01-02T03:04:05.000Z',
      colorSpace: 'sRGB',
      iccProfileName: 'Display P3',
      mime: 'image/jpeg',
      meta: {
        title: 'Title',
        caption: 'Caption',
        camera: 'Acme Cam X',
        lens: '35mm',
        keywords: ['a', 'b'],
        gps: { lat: 37.77, lon: -122.42 },
      },
    })
  })

  it('omits absent optional fields rather than inventing placeholders', () => {
    expect(mapExifToAssetMetadata({})).toEqual({ orientation: 1 })
  })

  it('ignores non-finite GPS coordinates', () => {
    expect(
      mapExifToAssetMetadata({
        latitude: Number.NaN,
        longitude: -122,
      }).meta,
    ).toBeUndefined()
  })
})

describe('extractAssetMetadata', () => {
  it('returns mapped fields from exifr.parse including GPS', async () => {
    exifrApi.parse.mockReset()
    exifrApi.parse.mockResolvedValue({
      Orientation: 1,
      ImageWidth: 10,
      ImageHeight: 8,
      latitude: 1.5,
      longitude: 2.5,
    })

    const result = await extractAssetMetadata(new ArrayBuffer(8), 'image/jpeg')

    expect(exifrApi.parse).toHaveBeenCalled()
    expect(result.meta?.gps).toEqual({ lat: 1.5, lon: 2.5 })
    expect(result.widthPx).toBe(10)
    expect(result.heightPx).toBe(8)
    expect(result.mime).toBe('image/jpeg')
  })

  it('returns orientation 1 when exifr.parse throws', async () => {
    exifrApi.parse.mockReset()
    exifrApi.parse.mockRejectedValue(new Error('parse failed'))

    await expect(extractAssetMetadata(new ArrayBuffer(1))).resolves.toEqual({
      orientation: 1,
    })
  })
})
