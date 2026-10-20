import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ICON_NAMES } from './Icon'
import { SpecimenPage } from './SpecimenPage'

describe('SpecimenPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders token specimen sections', () => {
    render(<SpecimenPage />)
    expect(screen.getByTestId('specimen')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '?specimen' })).toBeTruthy()
    expect(screen.getByText('Semantic colour roles')).toBeTruthy()
    expect(screen.getByText('chrome')).toBeTruthy()
    expect(
      screen.getByText('Type scale · Inter + Lora (self-hosted)'),
    ).toBeTruthy()
    expect(screen.getByText('Radius')).toBeTruthy()
    expect(screen.getByText('Spacing · 4 px base')).toBeTruthy()
  })

  it('renders icon specimen with size tokens', () => {
    const { container } = render(<SpecimenPage />)

    const iconsSection = container.querySelector(
      '[data-testid="specimen-icons"]',
    )
    expect(iconsSection).toBeTruthy()
    expect(
      iconsSection?.querySelector('#specimen-icons-heading')?.textContent,
    ).toMatch(/Icon set/i)
    for (const name of ICON_NAMES) {
      expect(iconsSection?.querySelector(`[data-icon="${name}"]`)).toBeTruthy()
    }

    const size16 = screen.getByRole('button', { name: 'Icon size 16' })
    const size20 = screen.getByRole('button', { name: 'Icon size 20' })
    expect(size16.getAttribute('aria-pressed')).toBe('true')
    expect(size16.className).toContain('specimen-icon-size-active')
    expect(size20.getAttribute('aria-pressed')).toBe('false')
    expect(size20.className).not.toContain('specimen-icon-size-active')

    fireEvent.click(size20)
    expect(size20.getAttribute('aria-pressed')).toBe('true')
    expect(size20.className).toContain('specimen-icon-size-active')
    expect(size16.getAttribute('aria-pressed')).toBe('false')
    expect(size16.className).not.toContain('specimen-icon-size-active')

    const icons = iconsSection?.querySelectorAll('svg[data-icon]')
    expect(icons?.length).toBe(ICON_NAMES.length)
    expect(icons?.[0]?.getAttribute('data-size')).toBe('20')
  })
})
