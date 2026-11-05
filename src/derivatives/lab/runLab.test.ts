import { describe, expect, it, vi, type Mock } from 'vitest'
import type { DerivativePreset } from '../plan'
import {
  labTransferList,
  runLab,
  type LabResponse,
  type LabSurface,
} from './runLab'

interface FakeSource {
  close: Mock<() => void>
}

const small: DerivativePreset = {
  id: '8-webp-q80',
  maxEdge: 8,
  mimeType: 'image/webp',
  quality: 0.8,
}
const smallJpeg: DerivativePreset = {
  ...small,
  id: '8-jpeg-q90',
  mimeType: 'image/jpeg',
  quality: 0.9,
}
const wide: DerivativePreset = { ...small, id: '16-webp-q80', maxEdge: 16 }

function solid(
  width: number,
  height: number,
  value: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4)
  rgba.fill(value)
  return rgba
}

/**
 * Doubles: the "encoder" emits `quality × 10` bytes at `maxEdge`×`maxEdge`;
 * the reference is grey 100 and a decoded blob is grey 100 + its byte count
 * for WebP, an exact copy for JPEG.
 */
function fakeSurface() {
  const source: FakeSource = { close: vi.fn() }
  const surface = {
    source: vi.fn(() => Promise.resolve(source)),
    encode: vi.fn((_source: FakeSource, preset: DerivativePreset) =>
      Promise.resolve({
        bytes: new ArrayBuffer(Math.round(preset.quality * 10)),
        mimeType: preset.mimeType,
        width: preset.maxEdge,
        height: preset.maxEdge,
      }),
    ),
    pixels: vi.fn((image: FakeSource | Blob, width: number, height: number) => {
      if (!(image instanceof Blob)) {
        return Promise.resolve(solid(width, height, 100))
      }
      const shift = image.type === 'image/jpeg' ? 0 : image.size
      return Promise.resolve(solid(width, height, 100 + shift))
    }),
  } satisfies LabSurface<FakeSource>
  return { source, surface }
}

function okVariants(response: LabResponse) {
  if (!response.ok) {
    throw new Error(response.error)
  }
  return response.variants
}

describe('runLab', () => {
  it('encodes each candidate, scores it against one reference per size', async () => {
    const { source, surface } = fakeSurface()

    const response = await runLab(
      { fixture: 'sky' },
      [small, smallJpeg, wide],
      surface,
    )

    const variants = okVariants(response)
    expect(surface.source).toHaveBeenCalledWith('sky')
    expect(surface.encode.mock.calls.map(([, p]) => p.id)).toEqual([
      '8-webp-q80',
      '8-jpeg-q90',
      '16-webp-q80',
    ])
    const referenceCalls = surface.pixels.mock.calls.filter(
      ([image]) => !(image instanceof Blob),
    )
    expect(referenceCalls).toEqual([
      [source, 8, 8],
      [source, 16, 16],
    ])
    expect(
      variants.map((v) => [
        v.fixture,
        v.preset.id,
        v.width,
        v.height,
        v.byteLength,
        v.mimeType,
        v.bytes.byteLength,
      ]),
    ).toEqual([
      ['sky', '8-webp-q80', 8, 8, 8, 'image/webp', 8],
      ['sky', '8-jpeg-q90', 8, 8, 9, 'image/jpeg', 9],
      ['sky', '16-webp-q80', 16, 16, 8, 'image/webp', 8],
    ])
    const [webp, jpeg] = variants
    expect(jpeg?.ssim).toBeCloseTo(1, 10)
    expect(jpeg?.bandStep).toBe(0)
    expect(webp?.ssim).toBeLessThan(1)
    expect(source.close).toHaveBeenCalledOnce()
  })

  it('reports an encode failure and still closes the source', async () => {
    const { source, surface } = fakeSurface()
    surface.encode.mockRejectedValueOnce(new Error('encoder gone'))

    const response = await runLab({ fixture: 'foliage' }, [small], surface)

    expect(response).toEqual({
      fixture: 'foliage',
      ok: false,
      error: 'encoder gone',
    })
    expect(source.close).toHaveBeenCalledOnce()
  })

  it('reports a non-Error throw from the fixture raster', async () => {
    const { source, surface } = fakeSurface()
    surface.source.mockRejectedValueOnce('no canvas')

    const response = await runLab({ fixture: 'shadows' }, [small], surface)

    expect(response).toEqual({
      fixture: 'shadows',
      ok: false,
      error: 'no canvas',
    })
    expect(source.close).not.toHaveBeenCalled()
  })
})

describe('labTransferList', () => {
  it('transfers every variant buffer, nothing on failure', async () => {
    const { surface } = fakeSurface()
    const response = await runLab({ fixture: 'sky' }, [small, wide], surface)

    expect(labTransferList(response)).toEqual(
      okVariants(response).map((v) => v.bytes),
    )
    expect(labTransferList(response)).toHaveLength(2)
    expect(labTransferList({ fixture: 'sky', ok: false, error: 'x' })).toEqual(
      [],
    )
  })
})
