import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./processPhoto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./processPhoto')>()),
  processPhotoRequest: vi.fn(),
}))

vi.mock('../assets/extractAssetMetadata', () => ({
  extractAssetMetadata: vi.fn(),
}))

import { extractAssetMetadata } from '../assets/extractAssetMetadata'
import { processPhotoRequest } from './processPhoto'

async function workerHandler(): Promise<{
  handler: (event: MessageEvent) => void
  postMessage: ReturnType<typeof vi.fn>
}> {
  const postMessage = vi.fn()
  Object.defineProperty(globalThis, 'postMessage', {
    configurable: true,
    value: postMessage,
  })
  await import('./photo.worker')
  const handler = (
    globalThis as typeof globalThis & {
      onmessage: ((event: MessageEvent) => void) | null
    }
  ).onmessage
  if (handler === null) {
    throw new Error('photo.worker did not install onmessage')
  }
  return { handler, postMessage }
}

describe('photo.worker shell', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    Reflect.deleteProperty(globalThis, 'onmessage')
  })

  it('posts success with transferred preview buffer', async () => {
    const previewBuffer = new ArrayBuffer(4)
    vi.mocked(processPhotoRequest).mockResolvedValue({
      id: '1',
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 1,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer,
      previewMimeType: 'image/jpeg',
    })

    const postMessage = vi.fn()
    Object.defineProperty(globalThis, 'postMessage', {
      configurable: true,
      value: postMessage,
    })

    await import('./photo.worker')
    const handler = (
      globalThis as typeof globalThis & {
        onmessage: ((event: MessageEvent) => void) | null
      }
    ).onmessage
    expect(handler).toBeTypeOf('function')

    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    handler?.({ data: { id: '1', file } } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, id: '1' }),
      { transfer: [previewBuffer] },
    )
  })

  it('transfers sourceBuffer with the preview instead of cloning it', async () => {
    const previewBuffer = new ArrayBuffer(4)
    const sourceBuffer = new ArrayBuffer(16)
    vi.mocked(processPhotoRequest).mockResolvedValue({
      id: '3',
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 16,
      width: 1,
      height: 1,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      previewBuffer,
      previewMimeType: 'image/webp',
      sourceBuffer,
    })

    const postMessage = vi.fn()
    Object.defineProperty(globalThis, 'postMessage', {
      configurable: true,
      value: postMessage,
    })

    await import('./photo.worker')
    const handler = (
      globalThis as typeof globalThis & {
        onmessage: ((event: MessageEvent) => void) | null
      }
    ).onmessage
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    handler?.({ data: { id: '3', file, returnSource: true } } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, id: '3', sourceBuffer }),
      { transfer: [previewBuffer, sourceBuffer] },
    )
  })

  it('posts failure without transfer', async () => {
    vi.mocked(processPhotoRequest).mockResolvedValue({
      id: '2',
      ok: false,
      error: 'nope',
    })

    const postMessage = vi.fn()
    Object.defineProperty(globalThis, 'postMessage', {
      configurable: true,
      value: postMessage,
    })

    await import('./photo.worker')
    const handler = (
      globalThis as typeof globalThis & {
        onmessage: ((event: MessageEvent) => void) | null
      }
    ).onmessage

    handler?.({
      data: {
        id: '2',
        file: new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
      },
    } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(postMessage).toHaveBeenCalledWith({
      id: '2',
      ok: false,
      error: 'nope',
    })
  })

  it('extracts metadata with the mime hint and GPS opt-in', async () => {
    const metadata = { capturedAt: null } as unknown as Awaited<
      ReturnType<typeof extractAssetMetadata>
    >
    vi.mocked(extractAssetMetadata).mockResolvedValue(metadata)
    const { handler, postMessage } = await workerHandler()
    const buffer = new ArrayBuffer(4)

    handler({
      data: {
        id: 'm1',
        kind: 'metadata',
        buffer,
        mimeType: 'image/jpeg',
        includeGps: true,
      },
    } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(processPhotoRequest).not.toHaveBeenCalled()
    expect(extractAssetMetadata).toHaveBeenCalledWith(buffer, {
      includeGps: true,
      mimeHint: 'image/jpeg',
    })
    expect(postMessage).toHaveBeenCalledWith({ id: 'm1', ok: true, metadata })
  })

  it('extracts metadata without GPS or mime hint by default', async () => {
    vi.mocked(extractAssetMetadata).mockResolvedValue({})
    const { handler, postMessage } = await workerHandler()
    const buffer = new ArrayBuffer(4)

    handler({ data: { id: 'm2', kind: 'metadata', buffer } } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledOnce()
    })
    expect(extractAssetMetadata).toHaveBeenCalledWith(buffer, {
      includeGps: false,
    })
  })

  it('posts metadata failures with the error message or a fallback', async () => {
    vi.mocked(extractAssetMetadata)
      .mockRejectedValueOnce(new Error('bad exif'))
      .mockRejectedValueOnce('not an error')
    const { handler, postMessage } = await workerHandler()
    const buffer = new ArrayBuffer(4)

    handler({ data: { id: 'f1', kind: 'metadata', buffer } } as MessageEvent)
    handler({ data: { id: 'f2', kind: 'metadata', buffer } } as MessageEvent)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(2)
    })
    expect(postMessage).toHaveBeenCalledWith({
      id: 'f1',
      ok: false,
      error: 'bad exif',
    })
    expect(postMessage).toHaveBeenCalledWith({
      id: 'f2',
      ok: false,
      error: 'Metadata extract failed',
    })
  })
})
