import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makePhotoCardModel } from './photo.test-helpers'
import { UnsupportedPhotoFormatError } from './types'

vi.mock('./loadPhoto', () => ({
  loadPhoto: vi.fn(),
  revokePhotoPreview: vi.fn(),
}))

vi.mock('./pickPhoto', () => ({
  photoInputAccept: () => 'image/jpeg,image/png,image/webp',
  pickPhotoWithFilePicker: vi.fn(),
}))

import { loadPhoto, revokePhotoPreview } from './loadPhoto'
import { pickPhotoWithFilePicker } from './pickPhoto'
import { useOpenPhoto } from './useOpenPhoto'

describe('useOpenPhoto', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('loads a picked file and sets photo', async () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const model = makePhotoCardModel()
    vi.mocked(pickPhotoWithFilePicker).mockResolvedValue(file)
    vi.mocked(loadPhoto).mockResolvedValue(model)

    const { result } = renderHook(() => useOpenPhoto())

    await act(async () => {
      await result.current.onOpenPhoto()
    })

    await waitFor(() => {
      expect(result.current.photo).toEqual(model)
      expect(result.current.error).toBeNull()
      expect(result.current.busy).toBe(false)
    })
  })

  it('falls back to file input click when picker returns null', async () => {
    vi.mocked(pickPhotoWithFilePicker).mockResolvedValue(null)
    const { result } = renderHook(() => useOpenPhoto())
    const click = vi.fn()
    Object.defineProperty(result.current.inputRef, 'current', {
      configurable: true,
      value: { click },
    })

    await act(async () => {
      await result.current.onOpenPhoto()
    })

    expect(click).toHaveBeenCalledOnce()
    expect(loadPhoto).not.toHaveBeenCalled()
  })

  it('sets unsupported format error', async () => {
    const file = new File([new Uint8Array([1])], 'a.tiff', {
      type: 'image/tiff',
    })
    vi.mocked(pickPhotoWithFilePicker).mockResolvedValue(file)
    vi.mocked(loadPhoto).mockRejectedValue(
      new UnsupportedPhotoFormatError('image/tiff'),
    )

    const { result } = renderHook(() => useOpenPhoto())

    await act(async () => {
      await result.current.onOpenPhoto()
    })

    await waitFor(() => {
      expect(result.current.photo).toBeNull()
      expect(result.current.error).toBe('Unsupported format: image/tiff')
    })
  })

  it('sets generic Error message and unknown fallback', async () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    vi.mocked(pickPhotoWithFilePicker).mockResolvedValue(file)
    vi.mocked(loadPhoto).mockRejectedValue(new Error('nope'))

    const { result } = renderHook(() => useOpenPhoto())

    await act(async () => {
      await result.current.onOpenPhoto()
    })

    await waitFor(() => {
      expect(result.current.error).toBe('nope')
    })

    vi.mocked(loadPhoto).mockRejectedValue('weird')
    await act(async () => {
      await result.current.onOpenPhoto()
    })

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load photo')
    })
  })

  it('loads from file input change and clears value', async () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const model = makePhotoCardModel({ name: 'from-input.jpg' })
    vi.mocked(loadPhoto).mockResolvedValue(model)

    const { result } = renderHook(() => useOpenPhoto())
    const input = document.createElement('input')
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    act(() => {
      result.current.onFileInputChange({
        target: input,
      } as unknown as ChangeEvent<HTMLInputElement>)
    })

    await waitFor(() => {
      expect(result.current.photo?.name).toBe('from-input.jpg')
    })
    expect(input.value).toBe('')
  })

  it('ignores empty file selection', () => {
    const { result } = renderHook(() => useOpenPhoto())
    const input = document.createElement('input')
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [],
    })

    act(() => {
      result.current.onFileInputChange({
        target: input,
      } as unknown as ChangeEvent<HTMLInputElement>)
    })

    expect(loadPhoto).not.toHaveBeenCalled()
  })

  it('revokes previous preview when photo changes', async () => {
    const first = makePhotoCardModel({ previewUrl: 'blob:first' })
    const second = makePhotoCardModel({ previewUrl: 'blob:second' })
    const file = new File([new Uint8Array([1])], 'a.jpg', {
      type: 'image/jpeg',
    })
    vi.mocked(pickPhotoWithFilePicker).mockResolvedValue(file)
    vi.mocked(loadPhoto)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)

    const { result } = renderHook(() => useOpenPhoto())

    await act(async () => {
      await result.current.onOpenPhoto()
    })
    await waitFor(() => {
      expect(result.current.photo?.previewUrl).toBe('blob:first')
    })

    await act(async () => {
      await result.current.onOpenPhoto()
    })
    await waitFor(() => {
      expect(result.current.photo?.previewUrl).toBe('blob:second')
    })

    expect(revokePhotoPreview).toHaveBeenCalledWith(first)
  })
})
