import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import { loadPhoto } from './loadPhoto'
import type { PhotoWorkerSuccess } from './photo.worker'
import { UnsupportedPhotoFormatError } from './types'

function mockWorkerSuccess(response: Omit<PhotoWorkerSuccess, 'id'>): void {
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
  }

  vi.stubGlobal('Worker', MockWorker)
}

describe('loadPhoto', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects image/tiff before worker work', async () => {
    const file = new File([new Uint8Array([0])], 'scan.tiff', {
      type: 'image/tiff',
    })
    await expect(loadPhoto(file)).rejects.toBeInstanceOf(
      UnsupportedPhotoFormatError,
    )
  })

  it('maps worker success into PhotoCardModel via public API', async () => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
    const bytes = readFileSync(photoFixturePaths.sampleOrient6)
    const file = new File([bytes], 'sample-orient6.jpg', {
      type: 'image/jpeg',
    })

    const previewBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer
    mockWorkerSuccess({
      ok: true,
      name: file.name,
      mimeType: file.type,
      byteLength: file.size,
      width: 40,
      height: 20,
      correctedWidth: 20,
      correctedHeight: 40,
      orientation: 6,
      previewBuffer,
      previewMimeType: 'image/jpeg',
    })

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const model = await loadPhoto(file)
    expect(model.correctedWidth).toBe(20)
    expect(model.correctedHeight).toBe(40)
    expect(model.aspectLabel).toBe('1:2')
    expect(model.orientation).toBe(6)
    expect(model.previewUrl).toBe('blob:mock-preview')
    expect(createObjectURL).toHaveBeenCalledOnce()
  })
})
