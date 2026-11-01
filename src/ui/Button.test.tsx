import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

const buttonCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Button.css'),
  'utf8',
)

describe('Button', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders default / secondary / ghost variants and sizes', () => {
    const { rerender } = render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.className).toBe('pb-button pb-button--default pb-button--md')

    rerender(
      <Button variant="secondary" size="sm" className="extra">
        Cancel
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toBe(
      'pb-button pb-button--secondary pb-button--sm extra',
    )

    rerender(<Button variant="ghost">Quiet</Button>)
    expect(screen.getByRole('button', { name: 'Quiet' }).className).toBe(
      'pb-button pb-button--ghost pb-button--md',
    )

    rerender(<Button variant="outline">Crop</Button>)
    expect(screen.getByRole('button', { name: 'Crop' }).className).toBe(
      'pb-button pb-button--outline pb-button--md',
    )
    expect(buttonCss).toMatch(
      /\.pb-button--outline \{[^}]*background: var\(--field\)/,
    )

    rerender(<Button variant="destructive">Remove</Button>)
    expect(screen.getByRole('button', { name: 'Remove' }).className).toBe(
      'pb-button pb-button--destructive pb-button--md',
    )
  })

  it('invokes onPress and respects isDisabled', () => {
    const onPress = vi.fn()
    const { rerender } = render(<Button onPress={onPress}>Go</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onPress).toHaveBeenCalledTimes(1)

    rerender(
      <Button onPress={onPress} isDisabled>
        Go
      </Button>,
    )
    const disabled = screen.getByRole('button', { name: 'Go' })
    expect(disabled.getAttribute('data-disabled')).not.toBeNull()
    fireEvent.click(disabled)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('marks pending buttons with data-pending', () => {
    render(<Button isPending>Saving…</Button>)
    expect(
      screen
        .getByRole('button', { name: 'Saving…' })
        .getAttribute('data-pending'),
    ).toBe('true')
  })

  it('keeps author colors under dark color-scheme and solid disabled fills', () => {
    expect(buttonCss).toMatch(/\.pb-button\s*\{[^}]*appearance:\s*none/s)
    expect(buttonCss).toMatch(
      /\.pb-button\[data-disabled\],\s*\.pb-button\[data-pending\]\s*\{[^}]*background:\s*var\(--muted\)/s,
    )
    expect(buttonCss).not.toMatch(
      /\.pb-button\[data-disabled\],\s*\.pb-button\[data-pending\]\s*\{[^}]*opacity:\s*0\.5/s,
    )
  })

  // Kit button.tsx box model (r11 M70): no border, md px-4, sm px-3;
  // secondary = kit outline + shadow-xs, no border ring.
  it('matches the kit box model and the borderless secondary variant', () => {
    expect(buttonCss).toMatch(/\.pb-button\s*\{[^}]*border:\s*0 solid/s)
    expect(buttonCss).toMatch(
      /\.pb-button--md\s*\{[^}]*padding:\s*0 calc\(var\(--spacing\) \* 4\)/s,
    )
    expect(buttonCss).toMatch(
      /\.pb-button--sm\s*\{[^}]*padding:\s*0 calc\(var\(--spacing\) \* 3\)/s,
    )
    const secondary = /\.pb-button--secondary\s*\{([^}]*)\}/s.exec(buttonCss)
    expect(secondary?.[1]).toMatch(/box-shadow:\s*var\(--shadow-xs\)/)
    expect(secondary?.[1]).not.toMatch(/border/)
    expect(buttonCss).not.toMatch(/border-color:\s*var\(--border\)/)
  })
})
