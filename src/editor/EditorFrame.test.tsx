import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorFrame, PanelToggles } from './EditorFrame'
import type { EditorPanels } from './editorChromePanels'
import { getGridVisible, setGridVisible } from './gridView'

describe('EditorFrame', () => {
  afterEach(() => {
    cleanup()
  })

  it('mounts kit regions and reflects panel open flags', () => {
    const onPanelsChange = vi.fn()
    const panels: EditorPanels = { l: true, b: true, r: false }
    render(
      <EditorFrame
        panels={panels}
        onPanelsChange={onPanelsChange}
        top={
          <PanelToggles
            panels={panels}
            onToggle={(key) => {
              onPanelsChange({ ...panels, [key]: !panels[key] })
            }}
          />
        }
        left={<div>left</div>}
        right={<div>right</div>}
        dock={<div data-testid="dock">dock</div>}
        canvas={<div data-testid="pasteboard">canvas</div>}
      />,
    )

    expect(screen.getByTestId('editor-shell')).toBeTruthy()
    expect(screen.getByTestId('panel-l').getAttribute('data-open')).toBe('true')
    expect(screen.getByTestId('panel-b').getAttribute('data-open')).toBe('true')
    expect(screen.getByTestId('panel-r').getAttribute('data-open')).toBe(
      'false',
    )
    expect(
      screen.getByTestId('panel-r').getAttribute('data-hidden-panel'),
    ).toBe('true')
    expect(screen.getByTestId('canvas')).toBeTruthy()
    expect(screen.getByTestId('editor-workspace')).toBeTruthy()
    expect(screen.getByTestId('dock')).toBeTruthy()
    expect(screen.getByTestId('pasteboard')).toBeTruthy()

    fireEvent.click(screen.getByTestId('toggle-l'))
    expect(onPanelsChange).toHaveBeenCalledWith({
      l: false,
      b: true,
      r: false,
    })
  })

  it("arms Ctrl+' for the layout grid while mounted and releases it on unmount", () => {
    const panels: EditorPanels = { l: true, b: true, r: true }
    const { unmount } = render(
      <EditorFrame
        panels={panels}
        onPanelsChange={vi.fn()}
        top={null}
        left={null}
        right={null}
        dock={null}
        canvas={null}
      />,
    )
    fireEvent.keyDown(window, { key: "'", ctrlKey: true })
    expect(getGridVisible()).toBe(true)
    unmount()
    fireEvent.keyDown(window, { key: "'", ctrlKey: true })
    expect(getGridVisible()).toBe(true)
    setGridVisible(false)
  })

  it('marks closed panels hidden and arms Space pan', () => {
    const first = vi.fn()
    const onPanelsChange = vi.fn()
    const frame = (onChange: (next: EditorPanels) => void) => (
      <EditorFrame
        panels={{ l: false, b: false, r: false }}
        onPanelsChange={onChange}
        left={<div>left</div>}
        right={<div>right</div>}
        dock={<div>dock</div>}
        canvas={<div>canvas</div>}
      />
    )
    const { rerender } = render(frame(first))
    rerender(frame(onPanelsChange))
    for (const id of ['panel-l', 'panel-b', 'panel-r']) {
      const el = screen.getByTestId(id)
      expect(el.getAttribute('aria-hidden')).toBe('true')
      expect(el.getAttribute('data-hidden-panel')).toBe('true')
      expect(el.getAttribute('inert')).not.toBeNull()
    }
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('data-panning')).toBeNull()
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(canvas.getAttribute('data-panning')).toBe('true')
    fireEvent(window, new Event('blur'))
    expect(canvas.getAttribute('data-panning')).toBeNull()
    fireEvent.keyDown(window, { key: '[' })
    expect(onPanelsChange).toHaveBeenCalledWith({
      l: true,
      b: false,
      r: false,
    })
    expect(first).not.toHaveBeenCalled()
  })
})

describe('EditorFrame panel sizes', () => {
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
    window.localStorage.clear()
    expect(errors).toEqual([])
  })

  const frame = (panels: EditorPanels, onPanelsChange = vi.fn()) => (
    <EditorFrame
      panels={panels}
      onPanelsChange={onPanelsChange}
      left={<div>left</div>}
      right={<div>right</div>}
      dock={<div>dock</div>}
      canvas={<div>canvas</div>}
    />
  )

  it('restores stored widths into chrome CSS variables', () => {
    window.localStorage.setItem('photobooks.panel.left', '260')
    window.localStorage.setItem('photobooks.panel.right', '9999')
    render(frame({ l: true, b: true, r: true }))
    const shell = screen.getByTestId('editor-shell')
    expect(shell.style.getPropertyValue('--panel-left')).toBe('260px')
    expect(shell.style.getPropertyValue('--panel-right')).toBe('360px')
  })

  it('resizes with the keyboard and persists the width', () => {
    render(frame({ l: true, b: true, r: false }))
    fireEvent.keyDown(screen.getByTestId('resize-left'), { key: 'ArrowRight' })
    expect(
      screen.getByTestId('editor-shell').style.getPropertyValue('--panel-left'),
    ).toBe('220px')
    expect(window.localStorage.getItem('photobooks.panel.left')).toBe('220')
    expect(screen.queryByTestId('resize-right')).toBeNull()
  })

  it('persists the right width after a keyboard resize', () => {
    render(frame({ l: false, b: true, r: true }))
    fireEvent.keyDown(screen.getByTestId('resize-right'), { key: 'ArrowLeft' })
    const stored = window.localStorage.getItem('photobooks.panel.right')
    expect(stored).toMatch(/^\d+$/)
    expect(
      screen
        .getByTestId('editor-shell')
        .style.getPropertyValue('--panel-right'),
    ).toBe(`${String(stored)}px`)
  })

  it('collapses a side from its splitter via Enter', () => {
    const onPanelsChange = vi.fn()
    render(frame({ l: true, b: true, r: true }, onPanelsChange))
    fireEvent.keyDown(screen.getByTestId('resize-right'), { key: 'Enter' })
    expect(onPanelsChange).toHaveBeenCalledWith({ l: true, b: true, r: false })
    fireEvent.keyDown(screen.getByTestId('resize-left'), { key: 'Enter' })
    expect(onPanelsChange).toHaveBeenLastCalledWith({
      l: false,
      b: true,
      r: true,
    })
  })

  it('hands focus to the top-bar toggle and lends collapse to the right slot', () => {
    const panels = { l: true, b: true, r: true }
    const onPanelsChange = vi.fn()
    render(
      <EditorFrame
        panels={panels}
        onPanelsChange={onPanelsChange}
        top={<PanelToggles panels={panels} onToggle={vi.fn()} />}
        left={<div>left</div>}
        right={(collapse) => (
          <button type="button" onClick={collapse}>
            close inspector
          </button>
        )}
        dock={<div>dock</div>}
        canvas={<div>canvas</div>}
      />,
    )
    fireEvent.keyDown(screen.getByTestId('resize-left'), { key: 'Enter' })
    expect(document.activeElement).toBe(screen.getByTestId('toggle-l'))
    fireEvent.click(screen.getByRole('button', { name: 'close inspector' }))
    expect(onPanelsChange).toHaveBeenLastCalledWith({
      l: true,
      b: true,
      r: false,
    })
    expect(document.activeElement).toBe(screen.getByTestId('toggle-r'))
  })
})
