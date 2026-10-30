import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ICON_NAMES } from './Icon'
import { SpecimenPage } from './SpecimenPage'

describe('SpecimenPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders token specimen sections', () => {
    render(<SpecimenPage />)
    expect(screen.getByTestId('specimen')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '?specimen' })).toBeTruthy()
    expect(screen.getByTestId('specimen-tw-bridge')).toBeTruthy()
    expect(screen.getByTestId('tw-bg-chrome').className).toContain('bg-chrome')
    expect(screen.getByTestId('tw-bg-sel').className).toContain('bg-sel')
    expect(screen.getByTestId('tw-text-muted').className).toContain(
      'text-muted-foreground',
    )
    expect(screen.getByText('Semantic colour roles')).toBeTruthy()
    expect(screen.getByText('chrome')).toBeTruthy()
    expect(
      screen.getByText('Type scale · Inter + Lora (self-hosted)'),
    ).toBeTruthy()
    expect(screen.getByText('Radius')).toBeTruthy()
    expect(screen.getByText('Spacing · 4 px base')).toBeTruthy()
  })

  it('renders actions specimen with Button and Toolbar', () => {
    render(<SpecimenPage />)
    const actions = screen.getByTestId('specimen-actions')
    expect(actions).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: /Actions · Button/i }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Undo (Ctrl+Z)' }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('toolbar', { name: 'Editor tools' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Fit' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Units' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'mm' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'cm' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'in' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Original' })).toBeTruthy()

    const grid = screen.getByRole('button', { name: 'Grid' })
    expect(grid.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(grid)
    expect(grid.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('radio', { name: 'Fit' }))
    expect(screen.getByTestId('specimen-fit-value').textContent).toBe('fit=fit')
  })

  it('renders feedback specimen with Status, Badge, Progress, EmptyState', () => {
    render(<SpecimenPage />)
    const feedback = screen.getByTestId('specimen-feedback')
    expect(feedback).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: /Feedback · Status/i }),
    ).toBeTruthy()

    expect(screen.getByTestId('specimen-status-polite').textContent).toBe(
      'Ready',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Announce polite' }))
    expect(screen.getByTestId('specimen-status-polite').textContent).toBe(
      'Saved',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Announce assertive' }))
    expect(screen.getByTestId('specimen-status-assertive').textContent).toBe(
      'Import failed for 2 files',
    )

    expect(screen.getByTestId('specimen-badges').textContent).toContain(
      'Placed',
    )
    expect(
      screen.getByRole('progressbar', { name: 'Import progress' }),
    ).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Working' })).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: 'Choose photo folder…' }),
    )
    expect(screen.getByTestId('specimen-status-polite').textContent).toBe(
      'Choose photo folder…',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show error toast' }))
    expect(screen.getByText('3 files skipped')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show files' }))
    expect(screen.getByTestId('specimen-status-polite').textContent).toBe(
      'Opened import-errors panel (grouped by reason; dismiss / Clear all)',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show success toast' }))
    expect(screen.getByText('Library saved')).toBeTruthy()
  })

  it('renders overlays specimen with dialog and menu', async () => {
    render(<SpecimenPage />)
    expect(screen.getByTestId('specimen-overlays')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }))
    const alert = await screen.findByRole('alertdialog')
    fireEvent.click(within(alert).getByRole('button', { name: 'Remove' }))
    await waitFor(() => {
      expect(screen.getByTestId('specimen-status-polite').textContent).toBe(
        'Alert confirmed',
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }))
    const alert2 = await screen.findByRole('alertdialog')
    fireEvent.click(within(alert2).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.getByTestId('specimen-status-polite').textContent).toBe(
        'Alert cancelled',
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(await screen.findByRole('menu')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(screen.getByTestId('specimen-menu-choice').textContent).toBe(
      'menu=delete',
    )
  })

  it('dismisses specimen toasts via Close', async () => {
    render(<SpecimenPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Show success toast' }))
    expect(await screen.findByText('Library saved')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByText('Library saved')).toBeNull()
    })
  })

  it('renders icon specimen with size tokens', () => {
    const { container } = render(<SpecimenPage />)

    const iconsSection = container.querySelector(
      '[data-testid="specimen-icons"]',
    )
    expect(iconsSection).toBeTruthy()
    expect(
      iconsSection?.querySelector('#specimen-icons-heading')?.textContent,
    ).toMatch(/Icon set/i)
    for (const name of ICON_NAMES) {
      expect(iconsSection?.querySelector(`[data-icon="${name}"]`)).toBeTruthy()
    }

    const size16 = screen.getByRole('button', { name: 'Icon size 16' })
    const size20 = screen.getByRole('button', { name: 'Icon size 20' })
    expect(size16.getAttribute('aria-pressed')).toBe('true')
    expect(size16.className).toContain('specimen-icon-size-active')
    expect(size20.getAttribute('aria-pressed')).toBe('false')
    expect(size20.className).not.toContain('specimen-icon-size-active')

    fireEvent.click(size20)
    expect(size20.getAttribute('aria-pressed')).toBe('true')
    expect(size20.className).toContain('specimen-icon-size-active')
    expect(size16.getAttribute('aria-pressed')).toBe('false')
    expect(size16.className).not.toContain('specimen-icon-size-active')

    const icons = iconsSection?.querySelectorAll('svg[data-icon]')
    expect(icons?.length).toBe(ICON_NAMES.length)
    expect(icons?.[0]?.getAttribute('data-size')).toBe('20')
  })

  it('collapses the demo panel from header and splitter, then expands it', () => {
    render(<SpecimenPage />)
    const demo = screen.getByTestId('specimen-panels')
    const splitter = within(demo).getByTestId('resize-left')
    fireEvent.keyDown(splitter, { key: 'ArrowRight' })
    const pane = demo.querySelector<HTMLElement>('.specimen-panels-pane')
    expect(pane?.style.width).toBe(
      `${String(splitter.getAttribute('aria-valuenow'))}px`,
    )
    fireEvent.click(within(demo).getByTestId('panel-collapse-left'))
    expect(within(demo).queryByTestId('resize-left')).toBeNull()
    fireEvent.click(within(demo).getByRole('button', { name: /expand/i }))
    fireEvent.keyDown(within(demo).getByTestId('resize-left'), {
      key: 'Enter',
    })
    expect(within(demo).queryByTestId('resize-left')).toBeNull()
  })
})

describe('SpecimenPage forms', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders every form primitive state and they are interactive', () => {
    render(<SpecimenPage />)
    const forms = screen.getByTestId('specimen-forms')
    expect(within(forms).getAllByRole('spinbutton')).toHaveLength(4)
    expect(within(forms).getAllByRole('checkbox')).toHaveLength(5)
    expect(within(forms).getAllByRole('combobox')).toHaveLength(2)
    const mm = screen.getByTestId<HTMLInputElement>('specimen-mm')
    fireEvent.keyDown(mm, { key: 'ArrowUp', shiftKey: true })
    expect(mm.value).toBe('15')
  })
})

describe('SpecimenPage forms state', () => {
  afterEach(() => {
    cleanup()
  })

  it('wires text, select and checkbox demos to state', () => {
    render(<SpecimenPage />)
    const text = screen.getByTestId<HTMLInputElement>('specimen-text')
    expect(text.value).toBe('Holiday')
    fireEvent.change(text, { target: { value: 'Trip' } })
    expect(text.value).toBe('Trip')

    const select = screen.getByTestId<HTMLSelectElement>('specimen-select')
    expect(select.value).toBe('a4')
    fireEvent.change(select, { target: { value: 'sq' } })
    expect(select.value).toBe('sq')

    const check = screen.getByTestId<HTMLInputElement>('specimen-check')
    expect(check.checked).toBe(true)
    fireEvent.click(check)
    expect(check.checked).toBe(false)
  })

  it('shows the disabled, invalid and boundary states', () => {
    render(<SpecimenPage />)
    const forms = within(screen.getByTestId('specimen-forms'))
    expect(forms.getByText('Title is required')).toBeTruthy()
    expect(forms.getByText('Max 20 mm')).toBeTruthy()
    expect(forms.getAllByRole<HTMLInputElement>('spinbutton')[1]?.value).toBe(
      '0',
    )
    const inert = [
      ...forms.getAllByRole<HTMLInputElement>('spinbutton'),
      ...forms.getAllByRole<HTMLInputElement>('checkbox'),
    ].filter((el) => el.disabled)
    expect(inert).toHaveLength(2)
    expect(
      forms
        .getAllByRole<HTMLSelectElement>('combobox')
        .filter((s) => s.disabled),
    ).toHaveLength(1)
  })
})
