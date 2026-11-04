import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  derivativeTransferList,
  encodeDerivatives,
  type DerivativeWorkerResponse,
} from './encode'

interface FakeBitmap {
  width: number
  height: number
  close: ReturnType<typeof vi.fn>
}

/**
 * Canvas doubles: the "encoder" writes the canvas size, type and quality, so
 * equal inputs give equal bytes and any change gives different bytes.
 */
function stubCanvas(options: {
  width: number
  height: number
  fallbackType?: string
  noContext?: boolean
}) {
  const decoded: FakeBitmap = {
    width: options.width,
    height: options.height,
    close: vi.fn(),
  }
  const resized: FakeBitmap[] = []
  const createImageBitmap = vi.fn(
    (
      _source: unknown,
      init?: { resizeWidth?: number; resizeHeight?: number },
    ) => {
      if (init?.resizeWidth === undefined) {
        return Promise.resolve(decoded)
      }
      const bitmap = {
        width: init.resizeWidth,
        height: init.resizeHeight ?? 0,
        close: vi.fn(),
      }
      resized.push(bitmap)
      return Promise.resolve(bitmap)
    },
  )
  const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
  const getContext = vi.fn(() => (options.noContext === true ? null : ctx))
  class FakeOffscreenCanvas {
    constructor(
      readonly width: number,
      readonly height: number,
    ) {}
    getContext = getContext
    convertToBlob(init: { type: string; quality: number }): Promise<Blob> {
      const type = options.fallbackType ?? init.type
      const body = `${String(this.width)}x${String(this.height)} ${init.type} ${String(init.quality)}`
      return Promise.resolve(new Blob([body], { type }))
    }
  }
  vi.stubGlobal('createImageBitmap', createImageBitmap)
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
  return { createImageBitmap, ctx, getContext, decoded, resized }
}

const source = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
  type: 'image/jpeg',
})

function okOutputs(response: DerivativeWorkerResponse) {
  if (!response.ok) {
    throw new Error(response.error)
  }
  return response.outputs
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('encodeDerivatives', () => {
  it('decodes once with EXIF orientation and encodes each preset as sRGB', async () => {
    const { createImageBitmap, ctx, getContext, decoded, resized } = stubCanvas(
      { width: 6000, height: 4000 },
    )

    const response = await encodeDerivatives({
      id: 'r1',
      source,
      presetIds: ['site-share', 'site-thumb'],
    })

    const outputs = okOutputs(response)
    expect(response.id).toBe('r1')
    expect(createImageBitmap).toHaveBeenNthCalledWith(1, source, {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
    })
    expect(createImageBitmap).toHaveBeenNthCalledWith(2, decoded, {
      resizeWidth: 480,
      resizeHeight: 320,
      resizeQuality: 'high',
    })
    expect(getContext).toHaveBeenNthCalledWith(1, '2d', {
      alpha: true,
      colorSpace: 'srgb',
    })
    expect(getContext).toHaveBeenNthCalledWith(2, '2d', {
      alpha: false,
      colorSpace: 'srgb',
    })
    expect(
      outputs.map((o) => [
        o.presetId,
        o.cacheId,
        o.mimeType,
        o.width,
        o.height,
      ]),
    ).toEqual([
      ['site-thumb', 'drv-site-thumb-480-webp-q80', 'image/webp', 480, 320],
      ['site-share', 'drv-site-share-1600-jpeg-q85', 'image/jpeg', 1600, 1067],
    ])
    // JPEG has no alpha: transparent pixels land on white, WebP keeps them.
    expect(ctx.fillRect).toHaveBeenCalledTimes(1)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1067)
    expect(ctx.fillStyle).toBe('#ffffff')
    expect(ctx.drawImage).toHaveBeenCalledWith(resized[0], 0, 0)
    for (const bitmap of [decoded, ...resized]) {
      expect(bitmap.close).toHaveBeenCalledTimes(1)
    }
    expect(response.ok && response.decodeMs).toBeGreaterThanOrEqual(0)
    expect(outputs.every((o) => o.ms >= 0)).toBe(true)
  })

  it('same input twice gives the same SHA-256; another preset differs', async () => {
    stubCanvas({ width: 3000, height: 2000 })
    const request = {
      id: 'a',
      source,
      presetIds: ['site-display', 'site-share'],
    }

    const first = okOutputs(await encodeDerivatives(request))
    const second = okOutputs(await encodeDerivatives(request))

    expect(first.map((o) => o.outputHash)).toEqual(
      second.map((o) => o.outputHash),
    )
    expect(first[0]?.outputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(first[0]?.outputHash).not.toBe(first[1]?.outputHash)
    const text = await new Blob([first[0]?.bytes ?? new ArrayBuffer(0)]).text()
    expect(text).toBe('1600x1067 image/webp 0.82')
  })

  it('draws a source below the preset edge without resizing it', async () => {
    const { createImageBitmap, ctx, decoded } = stubCanvas({
      width: 400,
      height: 300,
    })

    const outputs = okOutputs(
      await encodeDerivatives({ id: 'b', source, presetIds: ['site-thumb'] }),
    )

    expect(createImageBitmap).toHaveBeenCalledTimes(1)
    expect(ctx.drawImage).toHaveBeenCalledWith(decoded, 0, 0)
    expect(outputs[0]).toMatchObject({ width: 400, height: 300 })
    expect(decoded.close).toHaveBeenCalledTimes(1)
  })

  it.each([
    [1, 4000, 1, 480],
    [4000, 1, 480, 1],
  ])(
    'resizes a %ix%i strip whose short edge stays put',
    async (width, height, outW, outH) => {
      const { createImageBitmap } = stubCanvas({ width, height })

      const outputs = okOutputs(
        await encodeDerivatives({ id: 's', source, presetIds: ['site-thumb'] }),
      )

      expect(createImageBitmap).toHaveBeenCalledTimes(2)
      expect(outputs[0]).toMatchObject({ width: outW, height: outH })
    },
  )

  it('times decode and each preset within the call', async () => {
    stubCanvas({ width: 2000, height: 1000 })
    const before = performance.now()

    const response = await encodeDerivatives({
      id: 't',
      source,
      presetIds: ['site-thumb', 'site-display'],
    })

    const elapsed = performance.now() - before
    const outputs = okOutputs(response)
    expect(response.ok && response.decodeMs).toBeLessThanOrEqual(elapsed)
    for (const output of outputs) {
      expect(output.ms).toBeLessThanOrEqual(elapsed)
    }
  })

  it('rejects a non-Blob source and unknown preset ids before decoding', async () => {
    const { createImageBitmap } = stubCanvas({ width: 10, height: 10 })

    const notBlob = await encodeDerivatives({
      id: 'c',
      source: 'x' as unknown as Blob,
      presetIds: ['site-thumb'],
    })
    const unknown = await encodeDerivatives({
      id: 'd',
      source,
      presetIds: ['site-huge'],
    })

    expect(notBlob).toEqual({
      id: 'c',
      ok: false,
      error: 'Derivative source must be a Blob',
    })
    expect(unknown).toEqual({
      id: 'd',
      ok: false,
      error: 'Unknown derivative preset: site-huge',
    })
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('reports a decode failure', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('bad'))),
    )

    expect(
      await encodeDerivatives({ id: 'e', source, presetIds: ['site-thumb'] }),
    ).toEqual({ id: 'e', ok: false, error: 'Derivative decode failed' })
  })

  it('fails when the encoder falls back to another type', async () => {
    const { decoded } = stubCanvas({
      width: 10,
      height: 10,
      fallbackType: 'image/png',
    })

    expect(
      await encodeDerivatives({ id: 'f', source, presetIds: ['site-thumb'] }),
    ).toEqual({
      id: 'f',
      ok: false,
      error: 'Encoder returned image/png for image/webp',
    })
    expect(decoded.close).toHaveBeenCalledTimes(1)
  })

  it('fails without a 2d context and still closes every bitmap', async () => {
    const { decoded, resized } = stubCanvas({
      width: 1000,
      height: 1000,
      noContext: true,
    })

    expect(
      await encodeDerivatives({ id: 'g', source, presetIds: ['site-thumb'] }),
    ).toEqual({
      id: 'g',
      ok: false,
      error: 'OffscreenCanvas 2d context unavailable',
    })
    expect(decoded.close).toHaveBeenCalledTimes(1)
    expect(resized[0]?.close).toHaveBeenCalledTimes(1)
  })
})

describe('derivativeTransferList', () => {
  it('transfers every output buffer, nothing on failure', () => {
    const bytes = new ArrayBuffer(2)
    expect(
      derivativeTransferList({
        id: 'x',
        ok: true,
        decodeMs: 1,
        outputs: [
          {
            presetId: 'site-thumb',
            cacheId: 'k',
            bytes,
            mimeType: 'image/webp',
            width: 1,
            height: 1,
            outputHash: 'h',
            ms: 1,
          },
        ],
      }),
    ).toEqual([bytes])
    expect(derivativeTransferList({ id: 'y', ok: false, error: 'e' })).toEqual(
      [],
    )
  })
})

describe('derivative.worker shell', () => {
  afterEach(() => {
    vi.resetModules()
    Reflect.deleteProperty(globalThis, 'onmessage')
  })

  it('posts the encode result with its buffers transferred', async () => {
    stubCanvas({ width: 100, height: 50 })
    const postMessage = vi.fn()
    vi.stubGlobal('postMessage', postMessage)

    await import('./derivative.worker')
    const scope = globalThis as typeof globalThis & {
      onmessage: (event: MessageEvent) => void
    }
    scope.onmessage({
      data: { id: 'w1', source, presetIds: ['site-thumb'] },
    } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(1)
    })
    const [message, options] = postMessage.mock.calls[0] as [
      DerivativeWorkerResponse,
      { transfer: Transferable[] },
    ]
    expect(message.ok).toBe(true)
    expect(options.transfer).toEqual(derivativeTransferList(message))
    expect(options.transfer).toHaveLength(1)
  })
})
