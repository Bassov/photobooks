import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CheckingLabel } from './hostingBits'

afterEach(cleanup)

describe('CheckingLabel', () => {
  it('draws the kit 14 px turning loader before the label (M117)', () => {
    const { container } = render(<CheckingLabel />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('data-size')).toBe('14')
    expect(svg?.getAttribute('data-icon')).toBe('loader')
    expect(svg?.getAttribute('class')).toBe('pb-icon export-site-spin')
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe(
      'M21 12a9 9 0 1 1-6.219-8.56',
    )
    expect(container.textContent).toBe('Checking…')
  })
})
