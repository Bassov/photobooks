import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Select } from './Select'

afterEach(cleanup)

describe('Select groups', () => {
  it('puts consecutive options of a group in one optgroup, ungrouped ones bare', () => {
    render(
      <Select
        aria-label="Printer"
        value="b"
        onChange={() => undefined}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', group: 'Shops' },
          { value: 'c', label: 'C', group: 'Shops' },
          { value: 'd', label: 'D', group: 'Custom' },
          { value: 'e', label: 'E', group: 'Custom' },
          { value: 'f', label: 'F' },
        ]}
      />,
    )
    const select = screen.getByLabelText('Printer')
    expect(
      [...select.children].map((node) =>
        node instanceof HTMLOptGroupElement
          ? `${node.label}: ${[...node.children].map((o) => o.textContent).join(' ')}`
          : node.textContent,
      ),
    ).toEqual(['A', 'Shops: B C', 'Custom: D E', 'F'])
  })
})
