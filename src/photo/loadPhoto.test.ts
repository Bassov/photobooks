import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from '../../e2e/fixtures/ensurePhotoFixtures'
import { loadPhoto, resetPhotoWorker, revokePhotoPreview } from './loadPhoto'
import {
  makePhotoCardModel,
  mockWorkerFailure,
  mockWorkerRuntimeError,
  mockWorkerSuccess,
} from './photo.test-helpers'
import { UnsupportedPhotoFormatError } from './types'

describe('loadPhoto', () => {
  afterEach(() => {
    resetPhotoWorker()
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

  it('throws when worker returns ok false', async () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    mockWorkerFailure('worker blew up')

    await expect(loadPhoto(file)).rejects.toThrow('worker blew up')
  })

  it('throws when worker emits error event', async () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    mockWorkerRuntimeError('Photo worker failed')

    await expect(loadPhoto(file)).rejects.toThrow('Photo worker failed')
  })

  it('revokes preview object URL', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const model = makePhotoCardModel({ previewUrl: 'blob:to-revoke' })

    revokePhotoPreview(model)

    expect(revoke).toHaveBeenCalledWith('blob:to-revoke')
  })
})
