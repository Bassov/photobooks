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

const gpsRaw = {
  Orientation: 1,
  ImageWidth: 10,
  ImageHeight: 8,
  latitude: 1.5,
  longitude: 2.5,
} as const

describe('mapExifToAssetMetadata', () => {
  it('maps orientation, dims, capture, color, and camera without GPS by default', () => {
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
      },
    })
    expect(result.meta?.gps).toBeUndefined()
  })

  it('includes meta.gps when includeGps is true and coordinates are finite', () => {
    const result = mapExifToAssetMetadata(
      { ...gpsRaw },
      { includeGps: true, mimeHint: 'image/jpeg' },
    )
    expect(result.meta?.gps).toEqual({ lat: 1.5, lon: 2.5 })
  })

  it('omits meta.gps when includeGps is omitted even if EXIF has coordinates', () => {
    const result = mapExifToAssetMetadata(
      { ...gpsRaw },
      { mimeHint: 'image/jpeg' },
    )
    expect(result.meta?.gps).toBeUndefined()
    expect(result.widthPx).toBe(10)
  })

  it('omits absent optional fields rather than inventing placeholders', () => {
    expect(mapExifToAssetMetadata({})).toEqual({ orientation: 1 })
  })

  it('ignores non-finite GPS coordinates even with opt-in', () => {
    expect(
      mapExifToAssetMetadata(
        {
          latitude: Number.NaN,
          longitude: -122,
        },
        { includeGps: true },
      ).meta,
    ).toBeUndefined()
  })

  it('ignores non-number GPS and infinite coordinates with opt-in', () => {
    expect(
      mapExifToAssetMetadata(
        { latitude: '37.7', longitude: -122 },
        { includeGps: true },
      ).meta?.gps,
    ).toBeUndefined()
    expect(
      mapExifToAssetMetadata(
        { latitude: Number.POSITIVE_INFINITY, longitude: -122 },
        { includeGps: true },
      ).meta?.gps,
    ).toBeUndefined()
  })

  it('reads nested gps.latitude/longitude when top-level coords are absent', () => {
    expect(
      mapExifToAssetMetadata(
        { gps: { latitude: 10, longitude: 20 } },
        { includeGps: true },
      ).meta?.gps,
    ).toEqual({ lat: 10, lon: 20 })
  })

  it('omits GPS when nested gps object is missing a finite coordinate', () => {
    expect(
      mapExifToAssetMetadata({ gps: { latitude: 10 } }, { includeGps: true })
        .meta?.gps,
    ).toBeUndefined()
    expect(
      mapExifToAssetMetadata(
        { latitude: 10, gps: { longitude: Number.NaN } },
        { includeGps: true },
      ).meta?.gps,
    ).toBeUndefined()
  })

  it('uses ExifImageWidth/Height when ImageWidth/Height are absent', () => {
    expect(
      mapExifToAssetMetadata({
        ExifImageWidth: 30,
        ExifImageHeight: 10,
        Orientation: 1,
      }),
    ).toMatchObject({ widthPx: 30, heightPx: 10 })
  })

  it('maps make-only or model-only camera strings', () => {
    expect(mapExifToAssetMetadata({ Make: 'Acme' }).meta?.camera).toBe('Acme')
    expect(mapExifToAssetMetadata({ Model: 'X1' }).meta?.camera).toBe('X1')
  })

  it('accepts capturedAt string values and rejects invalid Date', () => {
    expect(
      mapExifToAssetMetadata({ DateTimeOriginal: '2020:01:02 03:04:05' })
        .capturedAt,
    ).toBe('2020:01:02 03:04:05')
    expect(
      mapExifToAssetMetadata({ DateTimeOriginal: new Date(Number.NaN) })
        .capturedAt,
    ).toBeUndefined()
  })

  it('trims string fields and omits whitespace-only strings', () => {
    const result = mapExifToAssetMetadata({
      ImageDescription: '  Title  ',
      XPComment: '   ',
      Make: '  Acme ',
      Model: ' ',
      LensModel: '\t',
      ProfileDescription: '  P3 ',
    })
    expect(result.meta).toEqual({ title: 'Title', camera: 'Acme' })
    expect(result.iccProfileName).toBe('P3')
  })

  it('rejects non-integer and non-positive pixel sizes', () => {
    expect(mapExifToAssetMetadata({ ImageWidth: 1.5, ImageHeight: 8 })).toEqual(
      { orientation: 1 },
    )
    expect(mapExifToAssetMetadata({ ImageWidth: 0, ImageHeight: 8 })).toEqual({
      orientation: 1,
    })
    expect(mapExifToAssetMetadata({ ImageWidth: -2, ImageHeight: 8 })).toEqual({
      orientation: 1,
    })
  })

  it('accepts 1px dims and orientation boundaries 1 and 8', () => {
    expect(
      mapExifToAssetMetadata({
        ImageWidth: 1,
        ImageHeight: 1,
        Orientation: 1,
      }),
    ).toMatchObject({ widthPx: 1, heightPx: 1, orientation: 1 })
    expect(mapExifToAssetMetadata({ Orientation: 8 }).orientation).toBe(8)
    expect(mapExifToAssetMetadata({ Orientation: 0 }).orientation).toBe(1)
    expect(mapExifToAssetMetadata({ Orientation: 9 }).orientation).toBe(1)
  })

  it('maps ColorSpace numeric codes and string fallback', () => {
    expect(mapExifToAssetMetadata({ ColorSpace: 65535 }).colorSpace).toBe(
      'Uncalibrated',
    )
    expect(mapExifToAssetMetadata({ ColorSpace: 42 }).colorSpace).toBe('42')
    expect(
      mapExifToAssetMetadata({ ColorSpace: ' Adobe RGB ' }).colorSpace,
    ).toBe('Adobe RGB')
  })

  it('maps keyword arrays and subject strings', () => {
    expect(
      mapExifToAssetMetadata({ Keywords: [' a ', '', 'b'], subject: '  c  ' })
        .meta?.keywords,
    ).toEqual(['a', 'b', 'c'])
  })

  it('uses CreateDate when DateTimeOriginal is absent', () => {
    expect(
      mapExifToAssetMetadata({
        CreateDate: new Date('2021-02-03T04:05:06.000Z'),
      }).capturedAt,
    ).toBe('2021-02-03T04:05:06.000Z')
  })

  it('maps orientation from EXIF string labels', () => {
    expect(
      mapExifToAssetMetadata({ Orientation: 'Rotate 90 CW' }).orientation,
    ).toBe(6)
  })
})

describe('extractAssetMetadata', () => {
  it('includes GPS only when includeGps opt-in is true', async () => {
    exifrApi.parse.mockReset()
    exifrApi.parse.mockResolvedValue({ ...gpsRaw })

    const withOptIn = await extractAssetMetadata(new ArrayBuffer(8), {
      mimeHint: 'image/jpeg',
      includeGps: true,
    })
    expect(withOptIn.meta?.gps).toEqual({ lat: 1.5, lon: 2.5 })
    expect(exifrApi.parse).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({
        translateValues: true,
        reviveValues: true,
        gps: true,
        icc: true,
        exif: true,
        mergeOutput: true,
      }),
    )

    const withoutOptIn = await extractAssetMetadata(new ArrayBuffer(8), {
      mimeHint: 'image/jpeg',
    })
    expect(withoutOptIn.meta?.gps).toBeUndefined()
  })

  it('defaults includeGps off when mimeHint is passed as a string', async () => {
    exifrApi.parse.mockReset()
    exifrApi.parse.mockResolvedValue({ ...gpsRaw })

    const result = await extractAssetMetadata(new ArrayBuffer(8), 'image/jpeg')
    expect(result.meta?.gps).toBeUndefined()
    expect(result.mime).toBe('image/jpeg')
  })

  it('returns orientation 1 when exifr.parse throws', async () => {
    exifrApi.parse.mockReset()
    exifrApi.parse.mockRejectedValue(new Error('parse failed'))

    await expect(extractAssetMetadata(new ArrayBuffer(1))).resolves.toEqual({
      orientation: 1,
    })
  })

  it('ignores non-object exifr.parse results', async () => {
    exifrApi.parse.mockReset()
    exifrApi.parse.mockResolvedValue(42)

    await expect(extractAssetMetadata(new ArrayBuffer(1))).resolves.toEqual({
      orientation: 1,
    })
  })

  it('ignores null and array exifr.parse results', async () => {
    exifrApi.parse.mockReset()
    exifrApi.parse.mockResolvedValue(null)
    await expect(extractAssetMetadata(new ArrayBuffer(1))).resolves.toEqual({
      orientation: 1,
    })

    exifrApi.parse.mockResolvedValue([1, 2])
    await expect(extractAssetMetadata(new ArrayBuffer(1))).resolves.toEqual({
      orientation: 1,
    })
  })
})

describe('mapExifToAssetMetadata edge coverage', () => {
  it('rejects non-number finite checks and unknown orientation labels', () => {
    expect(
      mapExifToAssetMetadata({ ImageWidth: '10', ImageHeight: 8 }).widthPx,
    ).toBeUndefined()
    expect(
      mapExifToAssetMetadata({ Orientation: 'not-a-label' }).orientation,
    ).toBe(1)
  })

  it('prefers top-level GPS over nested when both are present', () => {
    expect(
      mapExifToAssetMetadata(
        {
          latitude: 1,
          longitude: 2,
          gps: { latitude: 9, longitude: 8 },
        },
        { includeGps: true },
      ).meta?.gps,
    ).toEqual({ lat: 1, lon: 2 })
  })

  it('uses nested gps.longitude when only longitude is nested', () => {
    expect(
      mapExifToAssetMetadata(
        { latitude: 3, gps: { longitude: 4 } },
        { includeGps: true },
      ).meta?.gps,
    ).toEqual({ lat: 3, lon: 4 })
  })

  it('omits each optional field independently when absent', () => {
    expect(mapExifToAssetMetadata({ Orientation: 1 })).toEqual({
      orientation: 1,
    })
    expect(
      mapExifToAssetMetadata({ Orientation: 1, ColorSpace: 1 }).colorSpace,
    ).toBe('sRGB')
    expect(
      mapExifToAssetMetadata({
        Orientation: 1,
        ICCProfileName: 'ICC',
      }).iccProfileName,
    ).toBe('ICC')
    expect(
      mapExifToAssetMetadata({ Orientation: 1 }, { mimeHint: 'image/png' })
        .mime,
    ).toBe('image/png')
    expect(
      mapExifToAssetMetadata({
        Orientation: 1,
        DateTimeOriginal: new Date('2020-01-01T00:00:00.000Z'),
      }).capturedAt,
    ).toBe('2020-01-01T00:00:00.000Z')
  })

  it('maps Keywords string source and skips empty keyword parts', () => {
    expect(
      mapExifToAssetMetadata({ Keywords: '  solo  ' }).meta?.keywords,
    ).toEqual(['solo'])
    expect(
      mapExifToAssetMetadata({ Keywords: ['', '  '] }).meta?.keywords,
    ).toBeUndefined()
  })
})
