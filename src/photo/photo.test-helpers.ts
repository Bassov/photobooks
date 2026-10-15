import { vi } from 'vitest'
import type { PhotoWorkerSuccess } from './processPhoto'
import type { PhotoCardModel } from './types'

export function makePhotoCardModel(
  overrides: Partial<PhotoCardModel> = {},
): PhotoCardModel {
  return {
    name: 'sample.jpg',
    mimeType: 'image/jpeg',
    byteLength: 1024,
    width: 40,
    height: 20,
    correctedWidth: 20,
    correctedHeight: 40,
    orientation: 6,
    aspectLabel: '1:2',
    sizeLabel: '1.0 KB',
    previewUrl: 'blob:mock-preview',
    ...overrides,
  }
}

export function mockWorkerSuccess(
  response: Omit<PhotoWorkerSuccess, 'id'>,
): void {
  class MockWorker {
    private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

    addEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void {
      const set = this.listeners.get(type) ?? new Set()
      set.add(listener)
      this.listeners.set(type, set)
    }

    removeEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void {
      this.listeners.get(type)?.delete(listener)
    }

    postMessage(data: { id: string }): void {
      const payload: PhotoWorkerSuccess = { ...response, id: data.id }
      queueMicrotask(() => {
        const event = { data: payload } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event)
        }
      })
    }

    terminate(): void {
      this.listeners.clear()
    }
  }

  vi.stubGlobal('Worker', MockWorker)
}

export function mockWorkerFailure(error: string): void {
  class MockWorker {
    private listeners = new Map<string, Set<(event: MessageEvent) => void>>()

    addEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void {
      const set = this.listeners.get(type) ?? new Set()
      set.add(listener)
      this.listeners.set(type, set)
    }

    removeEventListener(
      type: string,
      listener: (event: MessageEvent) => void,
    ): void {
      this.listeners.get(type)?.delete(listener)
    }

    postMessage(data: { id: string }): void {
      queueMicrotask(() => {
        const event = {
          data: { id: data.id, ok: false, error },
        } as MessageEvent
        for (const listener of this.listeners.get('message') ?? []) {
          listener(event)
        }
      })
    }

    terminate(): void {
      this.listeners.clear()
    }
  }

  vi.stubGlobal('Worker', MockWorker)
}

export function mockWorkerRuntimeError(message: string): void {
  class MockWorker {
    private listeners = new Map<
      string,
      Set<(event: Event | MessageEvent) => void>
    >()

    addEventListener(
      type: string,
      listener: (event: Event | MessageEvent) => void,
    ): void {
      const set = this.listeners.get(type) ?? new Set()
      set.add(listener)
      this.listeners.set(type, set)
    }

    removeEventListener(
      type: string,
      listener: (event: Event | MessageEvent) => void,
    ): void {
      this.listeners.get(type)?.delete(listener)
    }

    postMessage(): void {
      queueMicrotask(() => {
        const event = { message } as ErrorEvent
        for (const listener of this.listeners.get('error') ?? []) {
          listener(event)
        }
      })
    }

    terminate(): void {
      this.listeners.clear()
    }
  }

  vi.stubGlobal('Worker', MockWorker)
}

export function stubImageDecodeApis(options?: {
  width?: number
  height?: number
  previewBytes?: ArrayBuffer
  onCanvas?: (width: number, height: number) => void
}): void {
  const width = options?.width ?? 40
  const height = options?.height ?? 20
  const previewBytes =
    options?.previewBytes ?? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer

  const bitmap = {
    width,
    height,
    close: vi.fn(),
  }

  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))

  class MockOffscreenCanvas {
    width: number
    height: number

    constructor(w: number, h: number) {
      this.width = w
      this.height = h
      options?.onCanvas?.(w, h)
    }

    getContext(): {
      scale: ReturnType<typeof vi.fn>
      translate: ReturnType<typeof vi.fn>
      rotate: ReturnType<typeof vi.fn>
      drawImage: ReturnType<typeof vi.fn>
    } {
      return {
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        drawImage: vi.fn(),
      }
    }

    convertToBlob(): Promise<Blob> {
      return Promise.resolve(new Blob([previewBytes], { type: 'image/jpeg' }))
    }
  }

  vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)
}
