import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PhotoCard } from './PhotoCard'
import { makePhotoCardModel } from './photo.test-helpers'

describe('PhotoCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders preview and metadata from the model', () => {
    const photo = makePhotoCardModel({
      name: 'beach.jpg',
      correctedWidth: 20,
      correctedHeight: 40,
      aspectLabel: '1:2',
      sizeLabel: '2.0 KB',
      previewUrl: 'blob:preview',
      orientation: 6,
    })

    render(<PhotoCard photo={photo} />)

    const card = screen.getByTestId('photo-card')
    expect(card.getAttribute('data-orientation')).toBe('6')
    const preview = screen.getByTestId('photo-preview')
    expect(preview.getAttribute('src')).toBe('blob:preview')
    expect(preview.getAttribute('alt')).toBe('beach.jpg')
    expect(screen.getByTestId('photo-dimensions').textContent).toBe('20×40')
    expect(screen.getByTestId('photo-aspect').textContent).toBe('1:2')
    expect(screen.getByTestId('photo-size').textContent).toBe('2.0 KB')
  })
})
