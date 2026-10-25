import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./processPhoto', () => ({
  processPhotoRequest: vi.fn(),
}))

import { processPhotoRequest } from './processPhoto'

describe('photo.worker shell', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    Reflect.deleteProperty(globalThis, 'onmessage')
  })

  it('posts success with transferred preview, working, and source buffers', async () => {
    const previewBuffer = new ArrayBuffer(4)
    const workingBuffer = new ArrayBuffer(8)
    const sourceBuffer = new ArrayBuffer(16)
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
      workingBuffer,
      workingMimeType: 'image/webp',
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
      { transfer: [previewBuffer, workingBuffer, sourceBuffer] },
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
})
