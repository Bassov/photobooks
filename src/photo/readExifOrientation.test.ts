import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readExifOrientation } from './readExifOrientation'

const exifrApi = vi.hoisted(() => ({
  orientation: vi.fn(),
  parse: vi.fn(),
}))

vi.mock('exifr', () => ({
  default: {
    orientation: (...args: unknown[]): unknown =>
      exifrApi.orientation(...args) as unknown,
    parse: (...args: unknown[]): unknown => exifrApi.parse(...args) as unknown,
  },
}))

describe('readExifOrientation', () => {
  beforeEach(() => {
    exifrApi.orientation.mockReset()
    exifrApi.parse.mockReset()
    exifrApi.orientation.mockResolvedValue(1)
    exifrApi.parse.mockResolvedValue({})
  })

  it('returns numeric orientation 1..8', async () => {
    exifrApi.orientation.mockResolvedValue(6)
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(6)
  })

  it('prefers exifr.orientation over parse when both differ', async () => {
    exifrApi.orientation.mockResolvedValue(1)
    exifrApi.parse.mockResolvedValue({ Orientation: 8 })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(1)
  })

  it('ignores truthy non-object parse payloads', async () => {
    exifrApi.orientation.mockResolvedValue(undefined)
    exifrApi.parse.mockResolvedValue(5)
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(1)
  })

  it('accepts orientation 1 and 8 from exifr.orientation', async () => {
    exifrApi.orientation.mockResolvedValue(1)
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(1)
    exifrApi.orientation.mockResolvedValue(8)
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(8)
  })

  it('ignores numeric strings from exifr.orientation', async () => {
    exifrApi.orientation.mockResolvedValue('6')
    exifrApi.parse.mockResolvedValue({ Orientation: 5 })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(5)
  })

  it('maps string orientation labels', async () => {
    exifrApi.orientation.mockResolvedValue('Rotate 90 CW')
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(6)
  })

  it('falls back to Orientation from parse when label is unknown', async () => {
    exifrApi.orientation.mockResolvedValue('not a real label')
    exifrApi.parse.mockResolvedValue({ Orientation: 3 })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(3)
  })

  it('defaults to 1 when orientation throws', async () => {
    exifrApi.orientation.mockRejectedValue(new Error('exifr failed'))
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(1)
  })

  it('ignores out-of-range numeric orientation from parse', async () => {
    exifrApi.orientation.mockResolvedValue('nope')
    exifrApi.parse.mockResolvedValue({ Orientation: 99 })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(1)
  })

  it('ignores non-object parse results', async () => {
    exifrApi.orientation.mockResolvedValue('nope')
    exifrApi.parse.mockResolvedValue(null)
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(1)
  })

  it('ignores orientation 9 from exifr.orientation', async () => {
    exifrApi.orientation.mockResolvedValue(9)
    exifrApi.parse.mockResolvedValue({ Orientation: 2 })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(2)
  })

  it('ignores out-of-range numeric orientation from exifr.orientation', async () => {
    exifrApi.orientation.mockResolvedValue(0)
    exifrApi.parse.mockResolvedValue({ Orientation: 4 })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(4)
  })

  it('reads Orientation from parse with translateValues and reviveValues off', async () => {
    exifrApi.orientation.mockResolvedValue(undefined)
    exifrApi.parse.mockResolvedValue({ Orientation: 8 })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(8)
    expect(exifrApi.parse).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({
        pick: ['Orientation'],
        translateValues: false,
        reviveValues: false,
      }),
    )
  })

  it('accepts Orientation 8 from parse at the upper bound', async () => {
    exifrApi.orientation.mockResolvedValue(undefined)
    exifrApi.parse.mockResolvedValue({ Orientation: 8 })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(8)
  })

  it('ignores non-numeric Orientation on a parsed object', async () => {
    exifrApi.orientation.mockResolvedValue('nope')
    exifrApi.parse.mockResolvedValue({ Orientation: '6' })
    await expect(readExifOrientation(new ArrayBuffer(8))).resolves.toBe(1)
  })
})
