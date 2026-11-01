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

  it('marks the whole section, trigger included, as crop-keep when asked', () => {
    render(
      <Disclosure title="Fit & crop" data-testid="d" data-crop-keep="">
        <p>body</p>
      </Disclosure>,
    )
    const trigger = screen.getByRole('button', { name: 'Fit & crop' })
    expect(trigger.closest('[data-crop-keep]')).toBe(screen.getByTestId('d'))
    cleanup()
    render(
      <Disclosure title="Arrange" data-testid="d">
        <p>body</p>
      </Disclosure>,
    )
    expect(screen.getByTestId('d').hasAttribute('data-crop-keep')).toBe(false)
  })

  // Kit SectionHeader: summary while collapsed, header actions while open.
  it('shows the summary only collapsed and the right slot only expanded', () => {
    render(
      <Disclosure
        title="Layout"
        defaultExpanded
        summary="Full bleed"
        right={<span data-testid="action">+</span>}
        data-testid="layout"
      >
        <p>body</p>
      </Disclosure>,
    )
    expect(screen.queryByTestId('layout-summary')).toBeNull()
    expect(screen.getByTestId('action')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Layout/ }))
    expect(screen.getByTestId('layout-summary').textContent).toBe('Full bleed')
    expect(screen.queryByTestId('action')).toBeNull()
  })

  it('renders a summary without a test id when the section has none', () => {
    render(
      <Disclosure title="Grid" summary="Off">
        <p>body</p>
      </Disclosure>,
    )
    const summary = screen.getByText('Off')
    expect(summary.className).toBe('pb-disclosure__summary')
    expect(summary.hasAttribute('data-testid')).toBe(false)
  })
})
