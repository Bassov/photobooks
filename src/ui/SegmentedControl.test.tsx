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

  it('names the group by a visible label and tags the group and segments', () => {
    render(
      <>
        <span id="seg-label">Scale</span>
        <SegmentedControl
          label="Fit"
          labelledBy="seg-label"
          testId="seg"
          items={[
            { id: 'a', label: 'A', testId: 'seg-a' },
            { id: 'b', label: 'B' },
          ]}
        />
      </>,
    )
    const group = screen.getByRole('radiogroup', { name: 'Scale' })
    expect(group.getAttribute('aria-label')).toBeNull()
    expect(group.dataset.testid).toBe('seg')
    expect(screen.getByTestId('seg-a').tagName).toBe('LABEL')
    expect(screen.getByTestId('seg-a').textContent).toBe('A')
  })

  it('keeps aria-label and no test ids by default', () => {
    render(<SegmentedControl label="Fit" items={items} />)
    const group = screen.getByRole('radiogroup', { name: 'Fit' })
    expect(group.getAttribute('aria-labelledby')).toBeNull()
    expect(group.hasAttribute('data-testid')).toBe(false)
    expect(group.querySelector('[data-testid]')).toBeNull()
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
    expect(
      screen.getByRole('radio', { name: 'Fill' }).closest('label')?.className,
    ).toContain('pb-segmented__segment--selected')

    fireEvent.click(screen.getByRole('radio', { name: 'Fit' }))
    expect(onChange).toHaveBeenCalledWith('fit')
  })

  // The raised kit pill for --selected lives in SegmentedControl.css (M67).

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
