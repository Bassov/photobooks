import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SpecimenPage } from './SpecimenPage'

describe('SpecimenPage', () => {
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
})
