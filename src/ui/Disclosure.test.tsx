import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Disclosure } from './Disclosure'

describe('Disclosure', () => {
  afterEach(() => {
    cleanup()
  })

  it('starts collapsed and toggles from its heading', () => {
    render(
      <Disclosure title="Arrange">
        <p>body</p>
      </Disclosure>,
    )
    const trigger = screen.getByRole('button', { name: 'Arrange' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('body')).toBeTruthy()
  })

  it('can start expanded', () => {
    render(
      <Disclosure title="Open" defaultExpanded>
        <p>body</p>
      </Disclosure>,
    )
    expect(
      screen
        .getByRole('button', { name: 'Open' })
        .getAttribute('aria-expanded'),
    ).toBe('true')
  })
})
