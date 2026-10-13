import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canUseOpenFilePicker,
  photoInputAccept,
  pickPhotoWithFilePicker,
} from './pickPhoto'

describe('pickPhotoWithFilePicker', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'showOpenFilePicker')
    vi.restoreAllMocks()
  })

  it('returns null when showOpenFilePicker is missing', async () => {
    Reflect.deleteProperty(window, 'showOpenFilePicker')
    expect(canUseOpenFilePicker()).toBe(false)
    await expect(pickPhotoWithFilePicker()).resolves.toBeNull()
  })

  it('returns file from picker handle', async () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const showOpenFilePicker = vi.fn().mockResolvedValue([
      {
        getFile: vi.fn().mockResolvedValue(file),
      },
    ])
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: showOpenFilePicker,
    })

    await expect(pickPhotoWithFilePicker()).resolves.toBe(file)
    expect(showOpenFilePicker).toHaveBeenCalledOnce()
  })

  it('returns null when picker yields no handles', async () => {
    const showOpenFilePicker = vi.fn().mockResolvedValue([])
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: showOpenFilePicker,
    })

    await expect(pickPhotoWithFilePicker()).resolves.toBeNull()
  })

  it('returns null on AbortError', async () => {
    const showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException('User cancelled', 'AbortError'))
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: showOpenFilePicker,
    })

    await expect(pickPhotoWithFilePicker()).resolves.toBeNull()
  })

  it('exposes accept attribute for the file input', () => {
    expect(photoInputAccept()).toContain('image/jpeg')
  })

  it('rethrows non-Abort errors', async () => {
    const showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: showOpenFilePicker,
    })

    await expect(pickPhotoWithFilePicker()).rejects.toMatchObject({
      name: 'NotAllowedError',
    })
  })
})
