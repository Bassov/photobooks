import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { UnsupportedBrowserScreen } from './UnsupportedBrowserScreen'
import { UNSUPPORTED_BROWSER_MESSAGE } from './browserSupport'

describe('UnsupportedBrowserScreen', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the Chromium-required message', () => {
    render(<UnsupportedBrowserScreen />)
    expect(screen.getByTestId('unsupported-browser')).toBeTruthy()
    expect(screen.getByText(UNSUPPORTED_BROWSER_MESSAGE)).toBeTruthy()
  })
})
