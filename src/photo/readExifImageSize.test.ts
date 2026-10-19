import assert from 'node:assert/strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'

const exifrApi = vi.hoisted(() => ({
  parse: vi.fn(),
}))

vi.mock('exifr', () => ({
  default: {
    parse: (...args: unknown[]): unknown => exifrApi.parse(...args) as unknown,
  },
}))

import { readExifImageSize } from './readExifImageSize'

describe('readExifImageSize', () => {
  beforeEach(() => {
    exifrApi.parse.mockReset()
  })

  it('returns parse result when exifr succeeds', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const buffer = readFileSync(photoFixturePaths.samplePng).buffer
    exifrApi.parse.mockResolvedValue({ ImageWidth: 30, ImageHeight: 20 })

    const result = await readExifImageSize(buffer)

    expect(result).toEqual({ ImageWidth: 30, ImageHeight: 20 })
    expect(exifrApi.parse).toHaveBeenCalledWith(buffer, {
      pick: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'],
      translateValues: false,
      reviveValues: false,
    })
  })

  it('returns {} when exifr throws Unknown file format', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const buffer = readFileSync(photoFixturePaths.sampleLossyWebp).buffer
    exifrApi.parse.mockRejectedValue(new Error('Unknown file format'))

    const result = await readExifImageSize(buffer)

    expect(result).toEqual({})
  })

  it('returns {} for non-Error throws', async () => {
    const buffer = new ArrayBuffer(8)
    exifrApi.parse.mockRejectedValue('boom')

    const result = await readExifImageSize(buffer)

    assert.deepEqual(result, {})
  })

  it('passes translateValues and reviveValues as false (not true)', async () => {
    const buffer = new ArrayBuffer(4)
    exifrApi.parse.mockResolvedValue({})

    await readExifImageSize(buffer)

    const options = exifrApi.parse.mock.calls[0]?.[1] as {
      translateValues: boolean
      reviveValues: boolean
      pick: string[]
    }
    expect(options.translateValues).toBe(false)
    expect(options.reviveValues).toBe(false)
    expect(options.pick).toEqual([
      'ImageWidth',
      'ImageHeight',
      'ExifImageWidth',
      'ExifImageHeight',
    ])
    expect(options.pick).not.toEqual([])
    expect(options.pick[0]).toBe('ImageWidth')
  })
})
