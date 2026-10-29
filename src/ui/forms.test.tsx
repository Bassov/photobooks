import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox'
import { FieldGroup } from './Field'
import { NumberField } from './NumberField'
import { Select } from './Select'
import { TextField } from './TextField'

const noop = () => undefined

afterEach(cleanup)

function Num(props: {
  min?: number
  max?: number
  onChange?: (n: number) => void
}) {
  const [v, setV] = useState(5)
  return (
    <NumberField
      ariaLabel="Bleed"
      value={v}
      min={props.min ?? 0}
      max={props.max ?? 20}
      onChange={(n) => {
        setV(n)
        props.onChange?.(n)
      }}
    />
  )
}

describe('NumberField', () => {
  it('steps by 1 on arrows and by 10 with Shift', () => {
    render(<Num />)
    const input = screen.getByRole('spinbutton', { name: 'Bleed' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect((input as HTMLInputElement).value).toBe('6')
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true })
    expect((input as HTMLInputElement).value).toBe('16')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect((input as HTMLInputElement).value).toBe('15')
  })

  it('clamps stepping at min and max', () => {
    render(<Num />)
    const input = screen.getByRole<HTMLInputElement>('spinbutton')
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true })
    expect(input.value).toBe('20')
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })
    expect(input.value).toBe('0')
  })

  it('Home/End jump to the bounds', () => {
    render(<Num />)
    const input = screen.getByRole<HTMLInputElement>('spinbutton')
    fireEvent.keyDown(input, { key: 'End' })
    expect(input.value).toBe('20')
    fireEvent.keyDown(input, { key: 'Home' })
    expect(input.value).toBe('0')
  })

  it('clamps typed text on blur and on Enter', () => {
    const onChange = vi.fn()
    render(<Num onChange={onChange} />)
    const input = screen.getByRole<HTMLInputElement>('spinbutton')
    fireEvent.change(input, { target: { value: '99' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(20)
    fireEvent.change(input, { target: { value: '-4,5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('reverts unparseable text and on Escape', () => {
    const onChange = vi.fn()
    render(<Num onChange={onChange} />)
    const input = screen.getByRole<HTMLInputElement>('spinbutton')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.blur(input)
    expect(input.value).toBe('5')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('5')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes unit and range to assistive tech and honors custom steps', () => {
    const onChange = vi.fn()
    render(
      <NumberField
        label="Gap"
        value={1}
        step={0.5}
        shiftStep={2}
        min={0}
        max={3}
        onChange={onChange}
      />,
    )
    const input = screen.getByRole('spinbutton', { name: /Gap/ })
    expect(input.getAttribute('aria-valuetext')).toBe('1.0 mm')
    expect(input.getAttribute('aria-valuemax')).toBe('3')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(1.5)
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('is inert when disabled', () => {
    render(<NumberField ariaLabel="x" value={1} onChange={noop} isDisabled />)
    expect(screen.getByRole<HTMLInputElement>('spinbutton').disabled).toBe(true)
  })
})

describe('TextField', () => {
  it('reports changes and Enter submits', () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    render(
      <TextField
        label="Title"
        value="a"
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    )
    const input = screen.getByLabelText('Title')
    fireEvent.change(input, { target: { value: 'ab' } })
    expect(onChange).toHaveBeenCalledWith('ab')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('links error text and marks invalid', () => {
    render(
      <TextField label="Title" value="" onChange={noop} error="Required" />,
    )
    const input = screen.getByLabelText(/Title/)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const id = input.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(id)?.textContent).toBe('Required')
  })
})

describe('Select', () => {
  it('lists options and reports the chosen value', () => {
    const onChange = vi.fn()
    render(
      <Select
        label="Size"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', isDisabled: true },
          { value: 'c', label: 'C' },
        ]}
      />,
    )
    const select = screen.getByLabelText<HTMLSelectElement>('Size')
    expect(select.options).toHaveLength(3)
    expect(select.options[1]?.disabled).toBe(true)
    fireEvent.change(select, { target: { value: 'c' } })
    expect(onChange).toHaveBeenCalledWith('c')
  })
})

describe('Checkbox', () => {
  it('toggles on click and Space-equivalent change', () => {
    const onChange = vi.fn()
    render(
      <Checkbox checked={false} onChange={onChange}>
        Guides
      </Checkbox>,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Guides' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('sets the indeterminate property and disables', () => {
    render(
      <Checkbox checked onChange={noop} isIndeterminate isDisabled>
        Mixed
      </Checkbox>,
    )
    const box = screen.getByRole<HTMLInputElement>('checkbox')
    expect(box.indeterminate).toBe(true)
    expect(box.disabled).toBe(true)
  })
})

describe('FieldGroup', () => {
  it('renders a labelled group', () => {
    render(
      <FieldGroup legend="Margins">
        <Checkbox checked onChange={noop}>
          x
        </Checkbox>
      </FieldGroup>,
    )
    expect(screen.getByRole('group', { name: 'Margins' })).toBeTruthy()
  })
})
