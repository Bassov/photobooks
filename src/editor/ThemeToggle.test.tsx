import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getProductTheme, setTheme } from '../ui/preferredTheme'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => {
  cleanup()
  setTheme('b', document.documentElement, null)
})

describe('ThemeToggle', () => {
  it('toggles root data-theme between b and b-dark', () => {
    render(<ThemeToggle />)

    const toggle = screen.getByTestId('app-theme-toggle')
    expect(toggle.getAttribute('aria-label')).toBe('Dark theme')

    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('b-dark')
    expect(getProductTheme()).toBe('b-dark')
    expect(toggle.getAttribute('aria-label')).toBe('Light theme')

    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('b')
    expect(getProductTheme()).toBe('b')
  })
})
