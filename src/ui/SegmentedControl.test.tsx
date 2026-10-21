import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

const items = [
  { id: 'fill', label: 'Fill' },
  { id: 'fit', label: 'Fit' },
  { id: 'original', label: 'Original' },
]

describe('SegmentedControl', () => {
  afterEach(() => {
    cleanup()
  })

  it('reports selection changes through onChange', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        label="Fit"
        defaultValue="fill"
        onChange={onChange}
        items={items}
        className="seg"
      />,
    )
    const group = screen.getByRole('radiogroup', { name: 'Fit' })
    expect(group.className).toBe('pb-segmented pb-segmented--md seg')
    expect(group.className).toContain('pb-segmented')
    expect(
      screen.getByRole('radio', { name: 'Fill' }).getAttribute('data-selected'),
    ).toBe('true')

    fireEvent.click(screen.getByRole('radio', { name: 'Fit' }))
    expect(onChange).toHaveBeenCalledWith('fit')
  })

  it('supports controlled value, sm size, and item ariaLabel', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SegmentedControl
        label="Units"
        size="sm"
        value="mm"
        onChange={onChange}
        items={[
          { id: 'mm', label: 'mm' },
          { id: 'cm', label: <span>cm</span>, ariaLabel: 'Centimetres' },
        ]}
      />,
    )
    expect(
      screen.getByRole('radiogroup', { name: 'Units' }).className,
    ).toContain('pb-segmented--sm')
    expect(screen.getByRole('radio', { name: 'Centimetres' })).toBeTruthy()
    expect(
      screen.getByRole('radio', { name: 'mm' }).getAttribute('data-selected'),
    ).toBe('true')

    fireEvent.click(screen.getByRole('radio', { name: 'Centimetres' }))
    expect(onChange).toHaveBeenCalledWith('cm')

    rerender(
      <SegmentedControl
        label="Units"
        size="sm"
        value="cm"
        onChange={onChange}
        items={[
          { id: 'mm', label: 'mm' },
          { id: 'cm', label: <span>cm</span>, ariaLabel: 'Centimetres' },
        ]}
      />,
    )
    expect(
      screen
        .getByRole('radio', { name: 'Centimetres' })
        .getAttribute('data-selected'),
    ).toBe('true')
  })

  it('rejects an empty items list', () => {
    expect(() => render(<SegmentedControl label="Empty" items={[]} />)).toThrow(
      /at least one item/,
    )
  })
})
