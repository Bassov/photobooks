import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import { stubImageDecoder } from './photo.test-helpers'
import {
  decodeJpegScaled,
  decoderDesiredSize,
  frameResidualOrientation,
} from './scaledDecode'

/** Raw 40x20 JPEG with EXIF Orientation 6. */
function orient6Jpeg(type = 'image/jpeg'): File {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  const bytes = readFileSync(photoFixturePaths.sampleOrient6)
  return new File([bytes], 'sample-orient6.jpg', { type })
}

function frameWith(fields: Record<string, unknown>): VideoFrame {
  return fields as unknown as VideoFrame
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('decoderDesiredSize', () => {
  it('asks for the 1/8 step for a 320 thumb of a 24 MP photo', () => {
    expect(decoderDesiredSize(6000, 4000, 320)).toEqual({
      desiredWidth: 750,
      desiredHeight: 500,
    })
  })

  it('asks for the 1/4 step when 1/8 would fall below 1280', () => {
    expect(decoderDesiredSize(6000, 4000, 1280)).toEqual({
      desiredWidth: 1500,
      desiredHeight: 1000,
    })
    expect(decoderDesiredSize(4000, 6000, 1280)).toEqual({
      desiredWidth: 1000,
      desiredHeight: 1500,
    })
  })

  it('keeps a step that lands exactly on the target', () => {
    expect(decoderDesiredSize(2560, 1700, 1280)).toEqual({
      desiredWidth: 1280,
      desiredHeight: 850,
    })
    expect(decoderDesiredSize(2560, 1700, 320)).toEqual({
      desiredWidth: 320,
      desiredHeight: 213,
    })
  })

  it('rounds odd sizes up so the step covers the target', () => {
    expect(decoderDesiredSize(2561, 1707, 320)).toEqual({
      desiredWidth: 321,
      desiredHeight: 214,
    })
  })

  it('decodes at full size when no step reaches the target', () => {
    expect(decoderDesiredSize(2000, 1000, 1280)).toEqual({
      desiredWidth: 2000,
      desiredHeight: 1000,
    })
    expect(decoderDesiredSize(300, 200, 320)).toEqual({
      desiredWidth: 300,
      desiredHeight: 200,
    })
  })
})

describe('frameResidualOrientation', () => {
  it('needs nothing for EXIF 1, even without frame rotation info', () => {
    expect(frameResidualOrientation(frameWith({}), 1)).toBe(1)
  })

  it('needs nothing when the frame already carries the rotation or flip', () => {
    expect(
      frameResidualOrientation(frameWith({ rotation: 90, flip: false }), 6),
    ).toBe(1)
    expect(
      frameResidualOrientation(frameWith({ rotation: 0, flip: true }), 2),
    ).toBe(1)
  })

  it('applies the EXIF value when the frame reports no transform', () => {
    expect(
      frameResidualOrientation(frameWith({ rotation: 0, flip: false }), 6),
    ).toBe(6)
  })

  it('is unknown when the runtime does not report rotation', () => {
    expect(frameResidualOrientation(frameWith({}), 6)).toBeNull()
  })
})

describe('decodeJpegScaled', () => {
  it('streams the file into ImageDecoder at the desired size', async () => {
    const file = orient6Jpeg()
    const fullRead = vi.spyOn(file, 'arrayBuffer')
    const { inits, decoderClose, frame } = stubImageDecoder({
      displayWidth: 20,
      displayHeight: 40,
      rotation: 90,
    })

    const scaled = await decodeJpegScaled(file, 320)

    expect(inits).toHaveLength(1)
    expect(inits[0]?.type).toBe('image/jpeg')
    expect(inits[0]?.data).toBeInstanceOf(ReadableStream)
    expect(inits[0]?.desiredWidth).toBe(40)
    expect(inits[0]?.desiredHeight).toBe(20)
    expect(decoderClose).toHaveBeenCalledTimes(1)
    expect(fullRead).not.toHaveBeenCalled()
    expect(scaled).toEqual({
      frame,
      width: 40,
      height: 20,
      orientation: 6,
      residualOrientation: 1,
    })
    expect(frame.close).not.toHaveBeenCalled()
  })

  it('accepts the image/jpg alias', async () => {
    const { inits } = stubImageDecoder({ rotation: 90 })

    await decodeJpegScaled(orient6Jpeg('image/jpg'), 320)

    expect(inits).toHaveLength(1)
  })

  it('skips non-JPEG types', async () => {
    const { inits } = stubImageDecoder()

    expect(await decodeJpegScaled(orient6Jpeg('image/png'), 320)).toBe(
      undefined,
    )
    expect(inits).toHaveLength(0)
  })

  it('skips when the runtime has no ImageDecoder', async () => {
    vi.stubGlobal('ImageDecoder', undefined)

    expect(await decodeJpegScaled(orient6Jpeg(), 320)).toBe(undefined)
  })

  it('skips when ImageDecoder does not support JPEG', async () => {
    const { inits } = stubImageDecoder({ supported: false })

    expect(await decodeJpegScaled(orient6Jpeg(), 320)).toBe(undefined)
    expect(inits).toHaveLength(0)
  })

  it('skips when the head has no SOF', async () => {
    const { inits } = stubImageDecoder()
    const noSof = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xd9])],
      'x.jpg',
      {
        type: 'image/jpeg',
      },
    )

    expect(await decodeJpegScaled(noSof, 320)).toBe(undefined)
    expect(inits).toHaveLength(0)
  })

  it('closes the frame and skips when its orientation is unknown', async () => {
    const { frame } = stubImageDecoder()

    expect(await decodeJpegScaled(orient6Jpeg(), 320)).toBe(undefined)
    expect(frame.close).toHaveBeenCalledTimes(1)
  })

  it('closes the decoder and rethrows when decode fails', async () => {
    const { decoderClose } = stubImageDecoder({
      decodeError: new Error('decode failed'),
    })

    await expect(decodeJpegScaled(orient6Jpeg(), 320)).rejects.toThrow(
      'decode failed',
    )
    expect(decoderClose).toHaveBeenCalledTimes(1)
  })
})
