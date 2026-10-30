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

describe('NumberField details', () => {
  it('exposes value, range, unit and default mm', () => {
    render(
      <NumberField
        ariaLabel="Gap"
        value={2.5}
        step={0.5}
        min={0}
        max={9}
        onChange={noop}
        className="extra"
        data-testid="n"
      />,
    )
    const input = screen.getByTestId('n')
    expect(input.getAttribute('aria-valuenow')).toBe('2.5')
    expect(input.getAttribute('aria-valuemin')).toBe('0')
    expect(input.getAttribute('aria-valuemax')).toBe('9')
    expect(input.getAttribute('aria-valuetext')).toBe('2.5 mm')
    expect(input.getAttribute('aria-label')).toBe('Gap')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBeNull()
    expect(screen.getByText('mm').getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelector('label')?.className).toContain('extra')
    expect(
      document
        .querySelector('.pb-field__unit-wrap')
        ?.hasAttribute('data-invalid'),
    ).toBe(false)
    expect(
      document
        .querySelector('.pb-field__unit-wrap')
        ?.hasAttribute('data-disabled'),
    ).toBe(false)
  })

  it('omits range attributes when unbounded and shows a custom unit', () => {
    render(<NumberField ariaLabel="x" value={1} unit="pt" onChange={noop} />)
    const input = screen.getByRole('spinbutton')
    expect(input.getAttribute('aria-valuemin')).toBeNull()
    expect(input.getAttribute('aria-valuemax')).toBeNull()
    expect(input.getAttribute('aria-valuetext')).toBe('1 pt')
    expect(screen.getByText('pt')).toBeTruthy()
  })

  it('links hint and error, marks invalid and disabled', () => {
    render(
      <NumberField
        label="Bleed"
        value={1}
        onChange={noop}
        hint="Outer edge"
        error="Too big"
        isDisabled
      />,
    )
    const input = screen.getByRole('spinbutton')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ')
    expect(ids).toHaveLength(2)
    expect(document.getElementById(ids[0] ?? '')?.textContent).toBe(
      'Outer edge',
    )
    expect(document.getElementById(ids[1] ?? '')?.textContent).toBe('Too big')
    const wrap = document.querySelector('.pb-field__unit-wrap')
    expect(wrap?.getAttribute('data-invalid')).toBe('true')
    expect(wrap?.getAttribute('data-disabled')).toBe('true')
  })

  it('links only the hint when there is no error', () => {
    render(<NumberField label="B" value={1} onChange={noop} hint="Hint" />)
    const input = screen.getByRole('spinbutton')
    const id = input.getAttribute('aria-describedby') ?? ''
    expect(id).not.toContain(' ')
    expect(document.getElementById(id)?.textContent).toBe('Hint')
  })

  it('uses 10 x step as the default Shift step and prevents default', () => {
    const onChange = vi.fn()
    render(
      <NumberField ariaLabel="x" value={0} step={0.5} onChange={onChange} />,
    )
    const input = screen.getByRole('spinbutton')
    expect(fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true })).toBe(
      false,
    )
    expect(onChange).toHaveBeenLastCalledWith(5)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(-0.5)
  })

  it('steps from the typed draft and shows step decimals', () => {
    const onChange = vi.fn()
    render(
      <NumberField ariaLabel="x" value={1} step={0.5} onChange={onChange} />,
    )
    const input = screen.getByRole<HTMLInputElement>('spinbutton')
    expect(input.value).toBe('1.0')
    fireEvent.change(input, { target: { value: '4' } })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(4.5)
  })

  it('falls back to the value when the draft is unparseable while stepping', () => {
    const onChange = vi.fn()
    render(<NumberField ariaLabel="x" value={3} onChange={onChange} />)
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: 'zz' } })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('ignores Home/End with a draft or without finite bounds', () => {
    const onChange = vi.fn()
    const { unmount } = render(
      <NumberField ariaLabel="x" value={3} onChange={onChange} />,
    )
    let input = screen.getByRole('spinbutton')
    fireEvent.keyDown(input, { key: 'Home' })
    fireEvent.keyDown(input, { key: 'End' })
    expect(onChange).not.toHaveBeenCalled()
    unmount()

    render(
      <NumberField
        ariaLabel="x"
        value={3}
        min={0}
        max={9}
        onChange={onChange}
      />,
    )
    input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Home' })
    fireEvent.keyDown(input, { key: 'End' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not report unchanged or clamped-to-same values', () => {
    const onChange = vi.fn()
    render(
      <NumberField
        ariaLabel="x"
        value={20}
        min={0}
        max={20}
        onChange={onChange}
      />,
    )
    const input = screen.getByRole<HTMLInputElement>('spinbutton')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'End' })
    fireEvent.change(input, { target: { value: '50' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
    expect(input.value).toBe('20')
  })

  it('Enter and blur without a draft are no-ops; other keys do nothing', () => {
    const onChange = vi.fn()
    render(<NumberField ariaLabel="x" value={3} onChange={onChange} />)
    const input = screen.getByRole<HTMLInputElement>('spinbutton')
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    fireEvent.keyDown(input, { key: 'a' })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '7' } })
    expect(input.value).toBe('7')
  })

  it('accepts a decimal comma on Enter', () => {
    const onChange = vi.fn()
    render(
      <NumberField ariaLabel="x" value={3} step={0.5} onChange={onChange} />,
    )
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '2,5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(2.5)
  })
})

describe('TextField details', () => {
  it('is a text input, forwards props and calls onKeyDown', () => {
    const onKeyDown = vi.fn()
    render(
      <TextField
        label="T"
        value="v"
        onChange={noop}
        onKeyDown={onKeyDown}
        placeholder="p"
        className="c"
        disabled
      />,
    )
    const input = screen.getByLabelText<HTMLInputElement>('T')
    expect(input.type).toBe('text')
    expect(input.placeholder).toBe('p')
    expect(input.disabled).toBe(true)
    expect(input.className).toContain('pb-field__control')
    expect(input.className).toContain('c')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBeNull()
    fireEvent.keyDown(input, { key: 'a' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })

  it('submits only on Enter outside composition', () => {
    const onSubmit = vi.fn()
    render(<TextField label="T" value="" onChange={noop} onSubmit={onSubmit} />)
    const input = screen.getByLabelText('T')
    fireEvent.keyDown(input, { key: 'a' })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('Enter without onSubmit is safe', () => {
    render(<TextField label="T" value="" onChange={noop} />)
    fireEvent.keyDown(screen.getByLabelText('T'), { key: 'Enter' })
  })

  it('links hint and error together', () => {
    render(<TextField label="T" value="" onChange={noop} hint="H" error="E" />)
    const ids = (
      screen.getByLabelText(/T/).getAttribute('aria-describedby') ?? ''
    ).split(' ')
    expect(ids).toHaveLength(2)
    expect(document.getElementById(ids[0] ?? '')?.textContent).toBe('H')
    expect(document.getElementById(ids[1] ?? '')?.textContent).toBe('E')
  })

  it('links only the hint', () => {
    render(<TextField label="T" value="" onChange={noop} hint="H" />)
    const id = screen.getByLabelText(/T/).getAttribute('aria-describedby')
    expect(document.getElementById(id ?? '')?.textContent).toBe('H')
    expect(id).not.toContain(' ')
  })
})

describe('Select details', () => {
  const options = [{ value: 'a', label: 'A' }]

  it('has no label, description or invalid flag by default', () => {
    render(<Select value="a" onChange={noop} options={options} />)
    const select = screen.getByRole('combobox')
    expect(select.getAttribute('aria-invalid')).toBeNull()
    expect(select.getAttribute('aria-describedby')).toBeNull()
    expect(document.querySelector('.pb-field__label')).toBeNull()
    expect(document.querySelector('.pb-field__hint')).toBeNull()
    expect(document.querySelector('.pb-field__error')).toBeNull()
    expect(select.className).toContain('pb-select')
    expect(select.className).toContain('pb-field__control')
  })

  it('links hint and error, forwards className and disabled', () => {
    render(
      <Select
        label="S"
        value="a"
        onChange={noop}
        options={options}
        hint="H"
        error="E"
        className="c"
        disabled
      />,
    )
    const select = screen.getByLabelText<HTMLSelectElement>(/S/)
    expect(select.getAttribute('aria-invalid')).toBe('true')
    expect(select.className).toContain('c')
    expect(select.disabled).toBe(true)
    expect(select.value).toBe('a')
    const ids = (select.getAttribute('aria-describedby') ?? '').split(' ')
    expect(ids).toHaveLength(2)
    expect(document.getElementById(ids[0] ?? '')?.textContent).toBe('H')
    expect(document.getElementById(ids[1] ?? '')?.textContent).toBe('E')
  })

  it('links only the hint', () => {
    render(
      <Select label="S" value="a" onChange={noop} options={options} hint="H" />,
    )
    const id = screen.getByRole('combobox').getAttribute('aria-describedby')
    expect(id).not.toContain(' ')
    expect(document.getElementById(id ?? '')?.textContent).toBe('H')
  })
})

describe('Checkbox details', () => {
  it('reports unchecking and shows the check icon only when checked', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Checkbox checked onChange={onChange} data-testid="cb" className="c">
        L
      </Checkbox>,
    )
    const box = screen.getByTestId<HTMLInputElement>('cb')
    expect(box.checked).toBe(true)
    expect(box.getAttribute('aria-invalid')).toBeNull()
    expect(box.disabled).toBe(false)
    expect(document.querySelector('.pb-check__box svg')).not.toBeNull()
    expect(document.querySelector('.pb-check__bar')).toBeNull()
    expect(document.querySelector('label')?.className).toContain('c')
    expect(document.querySelector('label')?.hasAttribute('data-disabled')).toBe(
      false,
    )
    fireEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(false)
    rerender(
      <Checkbox checked={false} onChange={onChange}>
        L
      </Checkbox>,
    )
    expect(document.querySelector('.pb-check__box')?.children).toHaveLength(0)
  })

  it('draws a bar when indeterminate and clears the flag afterwards', () => {
    const { rerender } = render(
      <Checkbox checked onChange={noop} isIndeterminate>
        L
      </Checkbox>,
    )
    expect(document.querySelector('.pb-check__bar')).not.toBeNull()
    expect(document.querySelector('.pb-check__box svg')).toBeNull()
    rerender(
      <Checkbox checked onChange={noop}>
        L
      </Checkbox>,
    )
    expect(screen.getByRole<HTMLInputElement>('checkbox').indeterminate).toBe(
      false,
    )
  })

  it('marks disabled and invalid', () => {
    render(
      <Checkbox checked={false} onChange={noop} isDisabled isInvalid>
        L
      </Checkbox>,
    )
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(document.querySelector('label')?.getAttribute('data-disabled')).toBe(
      'true',
    )
  })
})

describe('FieldGroup details', () => {
  it('stacks by default, wraps in row mode, forwards class and test id', () => {
    const { rerender } = render(
      <FieldGroup data-testid="g">
        <span>x</span>
      </FieldGroup>,
    )
    const group = screen.getByTestId('g')
    expect(group.className).toBe('pb-field-group')
    expect(group.querySelector('legend')).toBeNull()
    rerender(
      <FieldGroup data-testid="g" row className="extra" legend="L">
        <span>x</span>
      </FieldGroup>,
    )
    expect(screen.getByTestId('g').className).toBe(
      'pb-field-group pb-field-group--row extra',
    )
    expect(screen.getByText('L').tagName).toBe('LEGEND')
  })
})

describe('FieldFrame', () => {
  it('omits label, hint and error when absent', () => {
    render(<TextField value="" onChange={noop} />)
    expect(document.querySelector('.pb-field__label')).toBeNull()
    expect(document.querySelector('.pb-field__hint')).toBeNull()
    expect(document.querySelector('.pb-field__error')).toBeNull()
  })
})
