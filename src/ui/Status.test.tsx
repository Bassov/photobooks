import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Status } from './Status'

describe('Status', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a polite live region by default', () => {
    render(<Status>Saved</Status>)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-live')).toBe('polite')
    expect(el.getAttribute('data-politeness')).toBe('polite')
    expect(el.textContent).toBe('Saved')
  })

  it('renders an assertive alert live region', () => {
    render(<Status politeness="assertive">Import failed</Status>)
    const el = screen.getByRole('alert')
    expect(el.getAttribute('aria-live')).toBe('assertive')
    expect(el.getAttribute('data-politeness')).toBe('assertive')
    expect(el.textContent).toBe('Import failed')
  })
})
