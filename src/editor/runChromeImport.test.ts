import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeImportFileError } from './importFileError.test-helpers'
import * as importPhotos from './importPhotos'
import { runChromeImport } from './runChromeImport'

describe('runChromeImport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('no-ops on an empty file list', async () => {
    const importSpy = vi.spyOn(importPhotos, 'importPhotoFiles')
    const onProgress = vi.fn()
    const onErrors = vi.fn()
    await runChromeImport([], { onProgress, onErrors })
    expect(importSpy).not.toHaveBeenCalled()
    expect(onProgress).not.toHaveBeenCalled()
    expect(onErrors).not.toHaveBeenCalled()
  })

  it('coalesces progress frames and clears progress on success', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)

    vi.spyOn(importPhotos, 'importPhotoFiles').mockImplementation(
      (_files, options) => {
        options?.onProgress?.({
          total: 2,
          completed: 1,
          errors: [],
          running: true,
        })
        options?.onProgress?.({
          total: 2,
          completed: 2,
          errors: [],
          running: true,
        })
        expect(frames).toHaveLength(1)
        frames[0]?.(0)
        return Promise.resolve({ imported: 2, errors: [] })
      },
    )

    const onProgress = vi.fn()
    const onErrors = vi.fn()
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    await runChromeImport([file], { onProgress, onErrors })
    expect(onProgress).toHaveBeenCalledWith({
      total: 2,
      completed: 2,
      errors: [],
      running: true,
    })
    expect(onProgress).toHaveBeenCalledWith(null)
    expect(onErrors).toHaveBeenCalledWith([])
    expect(cancel).not.toHaveBeenCalled()
  })

  it('cancels a pending frame and reports import errors', async () => {
    let rafId = 0
    vi.stubGlobal('requestAnimationFrame', () => {
      rafId += 1
      return rafId
    })
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)

    const errors = [
      makeImportFileError({
        name: 'bad.jpg',
        message: 'nope',
        reason: 'decode-failed',
      }),
    ]
    vi.spyOn(importPhotos, 'importPhotoFiles').mockImplementation(
      (_files, options) => {
        options?.onProgress?.({
          total: 1,
          completed: 0,
          errors: [],
          running: true,
        })
        return Promise.resolve({ imported: 0, errors })
      },
    )

    const onProgress = vi.fn()
    const onErrors = vi.fn()
    const file = new File([new Uint8Array([1])], 'bad.jpg', {
      type: 'image/jpeg',
    })
    await runChromeImport([file], { onProgress, onErrors })
    expect(cancel).toHaveBeenCalledWith(1)
    expect(onErrors).toHaveBeenCalledWith(errors)
    expect(onProgress).toHaveBeenCalledWith({
      total: 1,
      completed: 1,
      errors,
      running: false,
    })
  })
})
