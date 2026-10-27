import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Panel } from './Panel'
import { PanelSplitter } from './PanelSplitter'

describe('Panel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a titled region with body and no collapse button by default', () => {
    render(
      <Panel side="left" title="Spreads">
        <p>body</p>
      </Panel>,
    )
    expect(screen.getByRole('region', { name: 'Spreads' })).toBeTruthy()
    expect(screen.getByText('body')).toBeTruthy()
    expect(screen.queryByTestId('panel-collapse-left')).toBeNull()
  })

  it('collapses through the header button with shortcut in the label', () => {
    const onCollapse = vi.fn()
    render(
      <Panel
        side="right"
        title="Inspector"
        onCollapse={onCollapse}
        shortcut="]"
      >
        <p>x</p>
      </Panel>,
    )
    const btn = screen.getByRole('button', { name: 'Collapse inspector ]' })
    fireEvent.click(btn)
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['left', 'panelLeft', 'right'],
    ['right', 'panelRight', 'left'],
  ] as const)(
    '%s panel: side icon and tooltip toward the canvas',
    (side, icon, placement) => {
      render(
        <Panel side={side} title="Spreads" onCollapse={vi.fn()}>
          <p>x</p>
        </Panel>,
      )
      const btn = screen.getByTestId(`panel-collapse-${side}`)
      expect(btn.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(
        icon,
      )
      fireEvent.keyDown(document.body, { key: 'Tab' })
      act(() => {
        btn.focus()
      })
      expect(screen.getByRole('tooltip').getAttribute('data-placement')).toBe(
        placement,
      )
    },
  )
})

describe('PanelSplitter', () => {
  // React reports handler throws on window, not to the test.
  const errors: unknown[] = []
  const onError = (e: ErrorEvent) => {
    errors.push(e.error)
    e.preventDefault()
  }
  beforeEach(() => {
    errors.length = 0
    window.addEventListener('error', onError)
  })
  afterEach(() => {
    window.removeEventListener('error', onError)
    cleanup()
    expect(errors).toEqual([])
  })

  it('exposes separator semantics with current width', () => {
    render(<PanelSplitter side="left" width={212} onResize={vi.fn()} />)
    const s = screen.getByRole('separator', { name: 'Resize left panel' })
    expect(s.getAttribute('aria-valuenow')).toBe('212')
    expect(s.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('resizes and commits with arrows (Shift ×4), mirrored on the right', () => {
    const onResize = vi.fn()
    const onCommit = vi.fn()
    render(
      <PanelSplitter
        side="right"
        width={300}
        onResize={onResize}
        onCommit={onCommit}
      />,
    )
    const s = screen.getByTestId('resize-right')
    fireEvent.keyDown(s, { key: 'ArrowRight' })
    fireEvent.keyDown(s, { key: 'ArrowLeft', shiftKey: true })
    expect(onResize.mock.calls).toEqual([[292], [332]])
    expect(onCommit.mock.calls).toEqual([[292], [332]])
  })

  it('collapses on Enter only when a handler exists and ignores other keys', () => {
    const onResize = vi.fn()
    const onCollapse = vi.fn()
    const { rerender } = render(
      <PanelSplitter side="left" width={200} onResize={onResize} />,
    )
    const s = screen.getByTestId('resize-left')
    fireEvent.keyDown(s, { key: 'Enter' })
    fireEvent.keyDown(s, { key: 'a' })
    expect(onResize).not.toHaveBeenCalled()
    rerender(
      <PanelSplitter
        side="left"
        width={200}
        onResize={onResize}
        onCollapse={onCollapse}
      />,
    )
    fireEvent.keyDown(screen.getByTestId('resize-left'), { key: 'Enter' })
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('drags: resizes live and commits the final width on release', () => {
    const onResize = vi.fn()
    const onCommit = vi.fn()
    render(
      <PanelSplitter
        side="left"
        width={200}
        onResize={onResize}
        onCommit={onCommit}
      />,
    )
    const s = screen.getByTestId('resize-left')
    s.setPointerCapture = vi.fn()
    fireEvent.pointerDown(s, { clientX: 100, pointerId: 1 })
    expect(s.getAttribute('data-dragging')).toBe('true')
    fireEvent.pointerMove(s, { clientX: 130, pointerId: 1 })
    fireEvent.pointerUp(s, { pointerId: 1 })
    expect(onResize).toHaveBeenLastCalledWith(230)
    expect(onCommit).toHaveBeenCalledWith(230)
    expect(s.getAttribute('data-dragging')).toBeNull()
    fireEvent.pointerMove(s, { clientX: 200, pointerId: 1 })
    fireEvent.pointerUp(s, { pointerId: 1 })
    expect(onResize).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('captures the pointer and starts idle', () => {
    render(<PanelSplitter side="left" width={200} onResize={vi.fn()} />)
    const s = screen.getByTestId('resize-left')
    expect(s.getAttribute('data-dragging')).toBeNull()
    const capture = vi.fn()
    s.setPointerCapture = capture
    fireEvent.pointerDown(s, { clientX: 100, pointerId: 7 })
    expect(capture).toHaveBeenCalledWith(7)
  })

  it('prevents default only for handled keys', () => {
    const { rerender } = render(
      <PanelSplitter side="left" width={200} onResize={vi.fn()} />,
    )
    const s = screen.getByTestId('resize-left')
    expect(fireEvent.keyDown(s, { key: 'ArrowRight' })).toBe(false)
    expect(fireEvent.keyDown(s, { key: 'a' })).toBe(true)
    rerender(
      <PanelSplitter
        side="left"
        width={200}
        onResize={vi.fn()}
        onCollapse={vi.fn()}
      />,
    )
    expect(fireEvent.keyDown(s, { key: 'Enter' })).toBe(false)
  })

  it('works without onCommit and ignores stray pointer events', () => {
    const onResize = vi.fn()
    render(<PanelSplitter side="left" width={200} onResize={onResize} />)
    const s = screen.getByTestId('resize-left')
    s.setPointerCapture = vi.fn()
    fireEvent.pointerMove(s, { clientX: 150, pointerId: 1 })
    fireEvent.pointerUp(s, { pointerId: 1 })
    fireEvent.keyDown(s, { key: 'ArrowRight' })
    fireEvent.pointerDown(s, { clientX: 100, pointerId: 1 })
    fireEvent.pointerUp(s, { pointerId: 1 })
    expect(onResize.mock.calls).toEqual([[208]])
  })
})
