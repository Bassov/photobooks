import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Badge } from './Badge'

describe('Badge', () => {
  afterEach(() => {
    cleanup()
  })

  it('applies color, size, type, and optional dot', () => {
    const { rerender } = render(<Badge>Saved</Badge>)
    let el = screen.getByText('Saved')
    expect(el.className).toContain('pb-badge--gray')
    expect(el.className).toContain('pb-badge--sm')
    expect(el.className).toContain('pb-badge--rect')
    expect(el.getAttribute('data-dot')).toBeNull()

    rerender(
      <Badge color="error" size="lg" type="pill-color" dot>
        Error
      </Badge>,
    )
    el = screen.getByText('Error')
    expect(el.className).toContain('pb-badge--error')
    expect(el.className).toContain('pb-badge--lg')
    expect(el.className).toContain('pb-badge--pill')
    expect(el.getAttribute('data-dot')).toBe('true')
    expect(el.querySelector('.pb-badge-dot')).toBeTruthy()
  })
})
