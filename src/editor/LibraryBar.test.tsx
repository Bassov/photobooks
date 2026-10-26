import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LibraryBar } from './LibraryBar'

describe('LibraryBar', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows mark, path, and wires change/settings', () => {
    const onChange = vi.fn()
    const onSettings = vi.fn()
    render(
      <LibraryBar
        path="Memory Library"
        onChange={onChange}
        onSettings={onSettings}
        changeDisabled
        settingsDisabled
      />,
    )
    expect(screen.getByText('Photobooks')).toBeTruthy()
    expect(screen.getByTestId('library-path').textContent).toBe(
      'Memory Library',
    )
    const change = screen.getByTestId('change-library')
    const settings = screen.getByTestId('library-settings')
    expect(
      change.getAttribute('data-disabled') ??
        change.getAttribute('aria-disabled'),
    ).toBeTruthy()
    expect(
      settings.getAttribute('data-disabled') ??
        settings.getAttribute('aria-disabled'),
    ).toBeTruthy()
    fireEvent.click(change)
    fireEvent.click(settings)
    expect(onChange).not.toHaveBeenCalled()
    expect(onSettings).not.toHaveBeenCalled()
  })

  it('invokes handlers when enabled', () => {
    const onChange = vi.fn()
    const onSettings = vi.fn()
    render(
      <LibraryBar
        path="Lib"
        onChange={onChange}
        onSettings={onSettings}
        tools={<span data-testid="lib-tools">tools</span>}
      />,
    )
    expect(screen.getByTestId('lib-tools')).toBeTruthy()
    fireEvent.click(screen.getByTestId('change-library'))
    fireEvent.click(screen.getByTestId('library-settings'))
    expect(onChange).toHaveBeenCalled()
    expect(onSettings).toHaveBeenCalled()
  })
})
