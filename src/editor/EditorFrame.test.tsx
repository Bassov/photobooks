import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorFrame } from './EditorFrame'

describe('EditorFrame', () => {
  afterEach(() => {
    cleanup()
  })

  it('mounts kit regions and toggles panels', () => {
    const onPanelsChange = vi.fn()
    render(
      <EditorFrame
        panels={{ l: true, b: true, r: true }}
        onPanelsChange={onPanelsChange}
        top={<div data-testid="editor-bar">bar</div>}
        left={<div>left</div>}
        right={<div>right</div>}
        dock={<div data-testid="dock">dock</div>}
        canvas={<div data-testid="pasteboard">canvas</div>}
      />,
    )

    expect(screen.getByTestId('editor-shell')).toBeTruthy()
    expect(screen.getByTestId('editor-bar')).toBeTruthy()
    expect(screen.getByTestId('panel-l')).toBeTruthy()
    expect(screen.getByTestId('panel-b')).toBeTruthy()
    expect(screen.getByTestId('panel-r')).toBeTruthy()
    expect(screen.getByTestId('canvas')).toBeTruthy()
    expect(screen.getByTestId('editor-workspace')).toBeTruthy()
    expect(screen.getByTestId('dock')).toBeTruthy()
    expect(screen.getByTestId('pasteboard')).toBeTruthy()
  })

  it('toggles left panel with [', () => {
    const onPanelsChange = vi.fn()
    render(
      <EditorFrame
        panels={{ l: true, b: true, r: true }}
        onPanelsChange={onPanelsChange}
        left={<div>left</div>}
        right={<div>right</div>}
        dock={<div>dock</div>}
        canvas={<div>canvas</div>}
      />,
    )
    fireEvent.keyDown(window, { key: '[' })
    expect(onPanelsChange).toHaveBeenCalledWith({
      l: false,
      b: true,
      r: true,
    })
  })
})
