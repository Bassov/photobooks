import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { editorKeysSuspended } from './editorKeysGate'
import { BAR, SUB } from './editorChromeTokens'
import { SitePreviewFrame } from './SitePreviewBar'

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

function setup(slide = 1, n = 3) {
  const onExit = vi.fn()
  const onSlide = vi.fn()
  const view = render(
    <SitePreviewFrame onExit={onExit} slide={slide} n={n} onSlide={onSlide}>
      <button type="button">first</button>
      <button type="button">last</button>
    </SitePreviewFrame>,
  )
  return { onExit, onSlide, view }
}

/** Keydown at the body: the frame's document capture listener runs first. */
function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  document.body.dispatchEvent(event)
  return event
}

describe('SitePreviewFrame', () => {
  it('is a modal dialog with the 48 px bar, Back and the label', () => {
    const { onExit } = setup()
    const root = screen.getByTestId('site-preview')
    expect(root.getAttribute('role')).toBe('dialog')
    expect(root.getAttribute('aria-modal')).toBe('true')
    expect(root.getAttribute('aria-label')).toBe('Site preview')
    expect(root.tabIndex).toBe(-1)
    expect(root.style.background).toBe(BAR)
    const bar = screen.getByTestId('site-preview-bar')
    expect(bar.style.background).toBe(BAR)
    expect(bar.style.boxShadow).toBe('inset 0 -1px 0 var(--border)')
    const back = screen.getByTestId('site-preview-back')
    expect(back.textContent).toBe('Back to the editor')
    expect(back.style.color).toBe(SUB)
    expect(back.style.gap).toBe('4px')
    expect(back.style.paddingLeft).toBe('6px')
    expect(back.style.paddingRight).toBe('10px')
    expect(screen.getByTestId('site-preview-label').style.color).toBe(SUB)
    fireEvent.click(back)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('takes focus and suspends editor keys while open, then gives both back', () => {
    const opener = document.body.appendChild(document.createElement('button'))
    opener.focus()
    const { view, onSlide } = setup()
    expect(document.activeElement).toBe(screen.getByTestId('site-preview'))
    expect(editorKeysSuspended()).toBe(true)
    view.unmount()
    expect(editorKeysSuspended()).toBe(false)
    expect(document.activeElement).toBe(opener)
    press('ArrowRight')
    expect(onSlide).not.toHaveBeenCalled()
  })

  it('steps slides with the latest props and stops every key before the page', () => {
    const { onExit, onSlide, view } = setup(1, 3)
    const below = vi.fn()
    document.body.addEventListener('keydown', below)
    const right = press('ArrowRight')
    expect(onSlide).toHaveBeenLastCalledWith(2)
    expect(right.defaultPrevented).toBe(true)
    view.rerender(
      <SitePreviewFrame onExit={onExit} slide={3} n={3} onSlide={onSlide} />,
    )
    press('ArrowLeft')
    expect(onSlide).toHaveBeenLastCalledWith(2)
    press('Home')
    expect(onSlide).toHaveBeenLastCalledWith(0)
    // Modifiers and other keys: no step, default kept, still stopped.
    onSlide.mockClear()
    const alt = press('ArrowRight', { altKey: true })
    const del = press('Delete')
    expect(onSlide).not.toHaveBeenCalled()
    expect(alt.defaultPrevented).toBe(false)
    expect(del.defaultPrevented).toBe(false)
    expect(onExit).not.toHaveBeenCalled()
    expect(below).not.toHaveBeenCalled()
    document.body.removeEventListener('keydown', below)
  })

  it('closes on Escape', () => {
    const { onExit, onSlide } = setup()
    press('Escape')
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onSlide).not.toHaveBeenCalled()
  })

  it('traps Tab and Shift+Tab inside', () => {
    const { onExit, onSlide } = setup()
    const last = screen.getByText('last')
    last.focus()
    const tab = press('Tab')
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(screen.getByTestId('site-preview-back'))
    press('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(last)
    expect(onSlide).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()
  })
})
