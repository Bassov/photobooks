import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CreateBookDialog } from './CreateBookDialog'

/** Open the kit Page size listbox and pick an option by its visible name. */
async function choosePreset(name: string | RegExp): Promise<void> {
  fireEvent.click(screen.getByTestId('create-preset'))
  fireEvent.click(await screen.findByRole('option', { name }))
}

describe('CreateBookDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('cancel does not create', () => {
    const onCreate = vi.fn()
    const onCancel = vi.fn()
    render(<CreateBookDialog isOpen onCancel={onCancel} onCreate={onCreate} />)
    expect(screen.getByTestId('create-book-dialog')).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('creates with A5 portrait trim by default', () => {
    const onCreate = vi.fn()
    render(
      <CreateBookDialog
        isOpen
        onCancel={() => undefined}
        onCreate={onCreate}
      />,
    )
    fireEvent.change(screen.getByTestId('create-title'), {
      target: { value: 'Trip' },
    })
    fireEvent.click(screen.getByTestId('create-book'))
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Trip',
      trim: { widthMm: 148, heightMm: 210 },
    })
  })

  it('maps landscape orientation for A5', () => {
    const onCreate = vi.fn()
    render(
      <CreateBookDialog
        isOpen
        onCancel={() => undefined}
        onCreate={onCreate}
      />,
    )
    fireEvent.click(screen.getByLabelText('Landscape'))
    fireEvent.click(screen.getByTestId('create-book'))
    expect(onCreate).toHaveBeenCalledWith({
      title: '',
      trim: { widthMm: 210, heightMm: 148 },
    })
  })

  it('maps custom cm to trim mm', async () => {
    const onCreate = vi.fn()
    render(
      <CreateBookDialog
        isOpen
        onCancel={() => undefined}
        onCreate={onCreate}
      />,
    )
    await choosePreset('Custom size…')
    expect(screen.getByTestId('create-custom')).toBeTruthy()
    fireEvent.change(screen.getByTestId('create-custom-w'), {
      target: { value: '18' },
    })
    fireEvent.change(screen.getByTestId('create-custom-h'), {
      target: { value: '24' },
    })
    fireEvent.blur(screen.getByTestId('create-custom-w'))
    fireEvent.blur(screen.getByTestId('create-custom-h'))
    fireEvent.click(screen.getByTestId('create-book'))
    expect(onCreate).toHaveBeenCalledWith({
      title: '',
      trim: { widthMm: 180, heightMm: 240 },
    })
  })

  it('Enter in title creates', () => {
    const onCreate = vi.fn()
    render(
      <CreateBookDialog
        isOpen
        onCancel={() => undefined}
        onCreate={onCreate}
      />,
    )
    fireEvent.change(screen.getByTestId('create-title'), {
      target: { value: 'Enter' },
    })
    fireEvent.keyDown(screen.getByTestId('create-title'), { key: 'Enter' })
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Enter',
      trim: { widthMm: 148, heightMm: 210 },
    })
  })

  it('Escape dismisses via onOpenChange', () => {
    const onCancel = vi.fn()
    render(
      <CreateBookDialog
        isOpen
        onCancel={onCancel}
        onCreate={() => undefined}
      />,
    )
    fireEvent.keyDown(screen.getByTestId('create-book-dialog'), {
      key: 'Escape',
    })
    expect(onCancel).toHaveBeenCalled()
  })

  it('resets fields after create and ignores non-positive custom cm', async () => {
    const onCreate = vi.fn()
    render(
      <CreateBookDialog
        isOpen
        onCancel={() => undefined}
        onCreate={onCreate}
      />,
    )
    fireEvent.change(screen.getByTestId('create-title'), {
      target: { value: 'One' },
    })
    fireEvent.click(screen.getByTestId('create-book'))
    expect(onCreate).toHaveBeenCalled()
    expect(screen.getByTestId('create-title')).toHaveProperty('value', '')

    await choosePreset('Custom size…')
    const width = screen.getByTestId('create-custom-w')
    fireEvent.change(width, { target: { value: 'abc' } })
    fireEvent.blur(width)
    expect(width).toHaveProperty('value', '18')
    fireEvent.change(width, { target: { value: '50' } })
    fireEvent.blur(width)
    expect(width).toHaveProperty('value', '42')
  })

  it('updates the custom size hint while typing, without blur', async () => {
    render(
      <CreateBookDialog
        isOpen
        onCancel={() => undefined}
        onCreate={() => undefined}
      />,
    )
    await choosePreset('Custom size…')
    const width = screen.getByTestId('create-custom-w')
    const height = screen.getByTestId('create-custom-h')
    const hint = () => screen.getByTestId('create-custom').textContent
    fireEvent.change(width, { target: { value: '19' } })
    fireEvent.blur(width)
    // Kit step 0.1 but no trailing zero: 19, not 19.0.
    expect(width).toHaveProperty('value', '19')
    fireEvent.focus(height)
    fireEvent.change(height, { target: { value: '2' } })
    expect(hint()).toContain('19 × 10 cm')
    fireEvent.change(height, { target: { value: '23' } })
    expect(hint()).toContain('19 × 23 cm')
    expect(height).toHaveProperty('value', '23')
  })

  it('updates orientation labels and disables confirm when createDisabled', async () => {
    render(
      <CreateBookDialog
        isOpen
        createDisabled
        onCancel={() => undefined}
        onCreate={() => undefined}
      />,
    )
    expect(screen.getByTestId('create-orientation')).toBeTruthy()
    fireEvent.click(screen.getByTestId('create-preset'))
    const a5 = await screen.findByRole('option', { name: /A5 · 14\.8/ })
    expect(a5).toBeTruthy()
    fireEvent.click(a5)
    fireEvent.click(screen.getByLabelText('Landscape'))
    fireEvent.click(screen.getByTestId('create-preset'))
    expect(await screen.findByRole('option', { name: /A5 · 21/ })).toBeTruthy()
    const confirm = screen.getByTestId('create-book')
    expect(
      confirm.getAttribute('data-disabled') ??
        confirm.getAttribute('aria-disabled'),
    ).toBeTruthy()
  })
})
