import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DerivativePreset } from '../plan'

const preset: DerivativePreset = {
  id: '8-webp-q80',
  maxEdge: 8,
  mimeType: 'image/webp',
  quality: 0.8,
}

vi.mock('./fixtures', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./fixtures')>()),
  LAB_SOURCE: { width: 16, height: 16 },
}))
vi.mock('./candidates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./candidates')>()),
  LAB_CANDIDATES: [
    { id: '8-webp-q80', maxEdge: 8, mimeType: 'image/webp', quality: 0.8 },
  ],
}))
vi.mock('../encode', () => ({
  encodePreset: vi.fn(),
}))

import { encodePreset } from '../encode'
import type { LabResponse } from './runLab'

interface FakeBitmap {
  from: unknown
  close: ReturnType<typeof vi.fn>
}

/** Canvas doubles: every readback is flat grey 100. */
function stubCanvas(options: { noContext?: boolean } = {}) {
  const bitmaps: FakeBitmap[] = []
  const createImageBitmap = vi.fn((from: unknown) => {
    const bitmap = { from, close: vi.fn() }
    bitmaps.push(bitmap)
    return Promise.resolve(bitmap)
  })
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(100),
    })),
  }
  const getContext = vi.fn(() => (options.noContext === true ? null : ctx))
  const canvases: [number, number][] = []
  class FakeOffscreenCanvas {
    constructor(width: number, height: number) {
      canvases.push([width, height])
    }
    getContext = getContext
  }
  class FakeImageData {
    constructor(
      readonly data: Uint8ClampedArray,
      readonly width: number,
      readonly height: number,
    ) {}
  }
  vi.stubGlobal('createImageBitmap', createImageBitmap)
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
  vi.stubGlobal('ImageData', FakeImageData)
  return { bitmaps, canvases, createImageBitmap, ctx, getContext }
}

async function postToWorker(): Promise<{
  response: LabResponse
  transfer: Transferable[] | undefined
}> {
  const postMessage = vi.fn()
  Object.defineProperty(globalThis, 'postMessage', {
    configurable: true,
    value: postMessage,
  })
  await import('./lab.worker')
  const handler = (
    globalThis as typeof globalThis & {
      onmessage: ((event: MessageEvent) => void) | null
    }
  ).onmessage
  handler?.(new MessageEvent('message', { data: { fixture: 'sky' } }))
  await vi.waitFor(() => {
    expect(postMessage).toHaveBeenCalledOnce()
  })
  const [response, init] = postMessage.mock.calls[0] as [
    LabResponse,
    { transfer?: Transferable[] },
  ]
  return { response, transfer: init.transfer }
}

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(globalThis, 'onmessage')
})

describe('lab.worker', () => {
  it('rasters the fixture, encodes with the product encoder, reads both back', async () => {
    const { bitmaps, canvases, createImageBitmap, ctx, getContext } =
      stubCanvas()
    const bytes = new ArrayBuffer(5)
    vi.mocked(encodePreset).mockResolvedValue({
      presetId: preset.id,
      cacheId: 'drv',
      bytes,
      mimeType: 'image/webp',
      width: 8,
      height: 8,
      outputHash: '',
      ms: 0,
    })

    const { response, transfer } = await postToWorker()

    expect(response.ok).toBe(true)
    expect(transfer).toEqual([bytes])
    const [source, reference, decoded] = bitmaps
    const raster = createImageBitmap.mock.calls[0]?.[0] as {
      data: Uint8ClampedArray
      width: number
      height: number
    }
    expect([raster.width, raster.height, raster.data.length]).toEqual([
      16,
      16,
      16 * 16 * 4,
    ])
    expect(vi.mocked(encodePreset)).toHaveBeenCalledWith(source, preset)
    expect(createImageBitmap.mock.calls[1]).toEqual([
      source,
      { resizeWidth: 8, resizeHeight: 8, resizeQuality: 'high' },
    ])
    expect(createImageBitmap.mock.calls[2]).toEqual([expect.any(Blob)])
    expect(canvases).toEqual([
      [8, 8],
      [8, 8],
    ])
    expect(getContext).toHaveBeenCalledWith('2d', { colorSpace: 'srgb' })
    expect(ctx.drawImage.mock.calls).toEqual([
      [reference, 0, 0],
      [decoded, 0, 0],
    ])
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 8, 8)
    for (const bitmap of bitmaps) {
      expect(bitmap.close).toHaveBeenCalledOnce()
    }
  })

  it('fails without a 2d context and still closes every bitmap', async () => {
    const { bitmaps } = stubCanvas({ noContext: true })
    vi.mocked(encodePreset).mockResolvedValue({
      presetId: preset.id,
      cacheId: 'drv',
      bytes: new ArrayBuffer(1),
      mimeType: 'image/webp',
      width: 8,
      height: 8,
      outputHash: '',
      ms: 0,
    })

    const { response, transfer } = await postToWorker()

    expect(response).toEqual({
      fixture: 'sky',
      ok: false,
      error: 'OffscreenCanvas 2d context unavailable',
    })
    expect(transfer).toEqual([])
    expect(bitmaps).toHaveLength(2)
    for (const bitmap of bitmaps) {
      expect(bitmap.close).toHaveBeenCalledOnce()
    }
  })
})
