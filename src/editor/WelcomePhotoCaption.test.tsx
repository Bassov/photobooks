import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { WelcomePhotoCaption } from './WelcomePhotoCaption'

describe('WelcomePhotoCaption', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders plain CC BY-SA caption for a known id', () => {
    render(<WelcomePhotoCaption id="c18" testid="screen-credit" />)
    const credit = screen.getByTestId('screen-credit')
    expect(credit.getAttribute('data-photo')).toBe('c18')
    expect(credit.textContent).toMatch(/Dietmar Rabich/)
    expect(credit.textContent).toMatch(/CC BY-SA 4\.0/)
    expect(credit.textContent).toMatch(/modified/)
  })

  it('renders nothing for an unknown photo id', () => {
    const { container } = render(<WelcomePhotoCaption id="missing" />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('photo-credit')).toBeNull()
  })
})
