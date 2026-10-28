import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorFrame } from './EditorFrame'
import { EditorToolGroup } from './EditorToolGroup'
import {
  getEditorTool,
  resetEditorToolForTests,
  setEditorTool,
} from './editorToolStore'

function selectedTool(): string | undefined {
  return ['select', 'frame', 'text', 'hand'].find((id) =>
    screen.getByTestId(`tool-${id}`).hasAttribute('data-selected'),
  )
}

function renderFrame() {
  return render(
    <EditorFrame
      top={<EditorToolGroup />}
      left={<div>left</div>}
      right={<div>right</div>}
      dock={<div>dock</div>}
      canvas={<div data-testid="pasteboard">canvas</div>}
    />,
  )
}

describe('EditorToolGroup', () => {
  afterEach(() => {
    cleanup()
    resetEditorToolForTests()
  })

  it('renders Select, Frame, Text, Hand with shortcut labels and Select active', () => {
    render(<EditorToolGroup />)
    const labels = ['Select (V)', 'Frame (F)', 'Text (T)', 'Pan (H)'].map(
      (name) => screen.getByRole('radio', { name }),
    )
    expect(labels).toHaveLength(4)
    expect(selectedTool()).toBe('select')
  })

  it('switches tool on click and never empties the selection', () => {
    render(<EditorToolGroup />)
    fireEvent.click(screen.getByTestId('tool-text'))
    expect(selectedTool()).toBe('text')
    expect(getEditorTool()).toBe('text')
    fireEvent.click(screen.getByTestId('tool-text'))
    expect(selectedTool()).toBe('text')
  })

  it('uses the pill chrome class on the group and tools (no ink fill)', () => {
    render(<EditorToolGroup />)
    expect(screen.getByTestId('tool-group').className).toContain(
      'e7-tool-group',
    )
    const frame = screen.getByTestId('tool-frame')
    expect(frame.className).toContain('e7-tool')
    fireEvent.click(frame)
    expect(frame.hasAttribute('data-selected')).toBe(true)
    expect(frame.getAttribute('style') ?? '').not.toMatch(/#000|black/i)
  })

  it.each([
    ['select', 'f', 'frame'],
    ['select', 't', 'text'],
    ['select', 'h', 'hand'],
    ['hand', 'v', 'select'],
    ['hand', 'V', 'select'],
  ] as const)(
    'from %s, key %s picks %s and updates the pill',
    (from, key, tool) => {
      renderFrame()
      act(() => {
        setEditorTool(from)
      })
      fireEvent.keyDown(window, { key })
      expect(getEditorTool()).toBe(tool)
      expect(selectedTool()).toBe(tool)
    },
  )

  it('ignores hotkeys with modifiers, while typing, and while Space is held', () => {
    renderFrame()
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    fireEvent.keyDown(window, { key: 't', metaKey: true })
    expect(getEditorTool()).toBe('select')

    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'h' })
    input.remove()
    expect(getEditorTool()).toBe('select')

    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    fireEvent.keyDown(window, { key: 'f' })
    expect(getEditorTool()).toBe('select')
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })
    fireEvent.keyDown(window, { key: 'f' })
    expect(getEditorTool()).toBe('frame')
  })

  it('sets the canvas cursor class per tool; Space pan suppresses it', () => {
    renderFrame()
    const canvas = screen.getByTestId('canvas')
    expect(canvas.className).not.toMatch(/cursor-/)

    fireEvent.click(screen.getByTestId('tool-frame'))
    expect(canvas.className).toContain('cursor-tool-frame')
    fireEvent.click(screen.getByTestId('tool-text'))
    expect(canvas.className).toContain('cursor-tool-text')
    expect(canvas.className).not.toContain('cursor-tool-frame')
    fireEvent.click(screen.getByTestId('tool-hand'))
    expect(canvas.className).toContain('cursor-grab')

    act(() => {
      fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    })
    expect(canvas.getAttribute('data-panning')).toBe('true')
    expect(canvas.className).not.toMatch(/cursor-/)
    act(() => {
      fireEvent.keyUp(window, { key: ' ', code: 'Space' })
    })
    expect(canvas.className).toContain('cursor-grab')

    fireEvent.click(screen.getByTestId('tool-select'))
    expect(canvas.className).not.toMatch(/cursor-/)
  })
})
