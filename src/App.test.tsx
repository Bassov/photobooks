import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makePhotoCardModel } from './photo/photo.test-helpers'
import type { PhotoCardModel } from './photo/types'

const useOpenPhotoMock = vi.fn()

vi.mock('./photo/useOpenPhoto', () => ({
  useOpenPhoto: (): unknown => useOpenPhotoMock() as unknown,
}))

import App from './App'

function stubOpenPhoto(overrides: {
  photo?: PhotoCardModel | null
  error?: string | null
  busy?: boolean
  onOpenPhoto?: () => Promise<void>
}): {
  onOpenPhoto: ReturnType<typeof vi.fn>
} {
  const onOpenPhoto = overrides.onOpenPhoto ?? vi.fn()
  useOpenPhotoMock.mockReturnValue({
    inputId: 'photo-input',
    inputRef: { current: null },
    photo: overrides.photo ?? null,
    error: overrides.error ?? null,
    busy: overrides.busy ?? false,
    accept: 'image/jpeg',
    onOpenPhoto,
    onFileInputChange: vi.fn(),
  })
  return { onOpenPhoto: onOpenPhoto as ReturnType<typeof vi.fn> }
}

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows idle open-photo CTA and invokes open handler', () => {
    const { onOpenPhoto } = stubOpenPhoto({})
    render(<App />)

    expect(screen.getByRole('button', { name: 'Open photo' })).toBeTruthy()
    expect(screen.queryByTestId('photo-card')).toBeNull()
    expect(screen.queryByTestId('photo-error')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open photo' }))
    expect(onOpenPhoto).toHaveBeenCalledOnce()
  })

  it('shows loading label when busy', () => {
    stubOpenPhoto({ busy: true })
    render(<App />)

    const button = screen.getByRole('button', { name: 'Loading…' })
    expect(button).toBeTruthy()
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows error alert', () => {
    stubOpenPhoto({ error: 'Unsupported format: image/tiff' })
    render(<App />)

    expect(screen.getByTestId('photo-error').textContent).toBe(
      'Unsupported format: image/tiff',
    )
  })

  it('shows photo card when a photo is loaded', () => {
    stubOpenPhoto({
      photo: makePhotoCardModel({
        correctedWidth: 20,
        correctedHeight: 40,
        aspectLabel: '1:2',
        sizeLabel: '1.0 KB',
      }),
    })
    render(<App />)

    expect(screen.getByTestId('photo-card')).toBeTruthy()
    expect(screen.getByTestId('photo-dimensions').textContent).toBe('20×40')
  })
})
