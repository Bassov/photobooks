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
    render(
      <EditorFrame
        panels={{ l: false, b: false, r: false }}
        onPanelsChange={() => undefined}
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
  })
})
