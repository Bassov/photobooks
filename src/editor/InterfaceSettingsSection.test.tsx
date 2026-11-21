import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setUiScaleChoice, UI_SCALE_KEY } from '../ui/uiScale'
import { runAtInterfaceScale } from '../ui/uiScale.test-helpers'
import { InterfaceSettingsSection } from './InterfaceSettingsSection'

const ROW = 'flex min-h-13 items-center gap-4 px-4 py-2'
const NORMAL = 'Bigger text and controls for 4K screens.'

function renderSection() {
  render(<InterfaceSettingsSection row={ROW} />)
  return {
    group: screen.getByRole('radiogroup', { name: 'Interface size' }),
    hint: screen.getByTestId('interface-size-hint'),
    radio: (pct: number) =>
      screen.getByRole('radio', { name: `${String(pct)}%` }),
  }
}

describe('InterfaceSettingsSection', () => {
  afterEach(() => {
    cleanup()
    act(() => {
      setUiScaleChoice(1)
    })
    window.localStorage.removeItem(UI_SCALE_KEY)
  })

  it('names the group by its visible label and selects 100 % by default', () => {
    const { group, hint, radio } = renderSection()
    expect(group.getAttribute('aria-labelledby')).toBe('interface-size-label')
    expect(group.getAttribute('aria-label')).toBeNull()
    expect(group.dataset.testid).toBe('interface-size')
    expect(group.className).toContain('w-56')
    expect(group.className).toContain('pb-segmented--md')
    expect(
      screen.getByTestId('interface-size-125').querySelector('input'),
    ).toBe(radio(125))
    expect(radio(100)).toHaveProperty('checked', true)
    expect(radio(125)).toHaveProperty('checked', false)
    expect(hint.id).toBe('interface-size-hint')
    expect(hint.getAttribute('aria-live')).toBe('polite')
    expect(hint.textContent).toBe(NORMAL)
    expect(hint.className).toContain('text-muted-foreground')
    expect(screen.getByText('Interface size').id).toBe('interface-size-label')
    expect(screen.getByTestId('interface-size-row').className).toContain(
      '@max-[704px]:flex-wrap',
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('stores a press at once and keeps a clamped choice selected', () => {
    // jsdom's 1024×768 window is below the 1280×720 app: every step clamps.
    const { hint, radio } = renderSection()
    fireEvent.click(radio(125))
    expect(window.localStorage.getItem(UI_SCALE_KEY)).toBe('125')
    expect(radio(125)).toHaveProperty('checked', true)
    expect(hint.textContent).toBe('Window too small for 125%: showing 100%.')
    expect(hint.className).toContain('text-foreground')
    expect(hint.className).not.toContain('text-muted-foreground')

    fireEvent.click(radio(150))
    expect(window.localStorage.getItem(UI_SCALE_KEY)).toBe('150')
    expect(hint.textContent).toBe('Window too small for 150%: showing 100%.')

    fireEvent.click(radio(100))
    expect(window.localStorage.getItem(UI_SCALE_KEY)).toBe('100')
    expect(hint.textContent).toBe(NORMAL)
  })

  it('shows the normal hint when the window fits the choice', () => {
    let restore = (): void => undefined
    act(() => {
      restore = runAtInterfaceScale(1.5)
    })
    const { hint, radio } = renderSection()
    expect(radio(150)).toHaveProperty('checked', true)
    expect(hint.textContent).toBe(NORMAL)
    act(() => {
      restore()
    })
  })
})
