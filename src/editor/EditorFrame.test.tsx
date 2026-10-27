import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorFrame, PanelToggles } from './EditorFrame'
import type { EditorPanels } from './editorChromePanels'

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

  it('marks closed panels hidden and arms Space pan', () => {
    const onPanelsChange = vi.fn()
    render(
      <EditorFrame
        panels={{ l: false, b: false, r: false }}
        onPanelsChange={onPanelsChange}
        left={<div>left</div>}
        right={<div>right</div>}
        dock={<div>dock</div>}
        canvas={<div>canvas</div>}
      />,
    )
    expect(screen.getByTestId('panel-l').getAttribute('aria-hidden')).toBe(
      'true',
    )
    expect(
      screen.getByTestId('panel-b').getAttribute('data-hidden-panel'),
    ).toBe('true')
    expect(screen.getByTestId('panel-r').getAttribute('inert')).not.toBeNull()
    const canvas = screen.getByTestId('canvas')
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
  })
})

describe('EditorFrame panel sizes', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
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
})
