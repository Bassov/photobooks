import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { Inspector } from './Inspector'
import { isTextFrameTarget } from './inspectorModel'
import { resetTextEditForTests, setSpreadOverflow } from './textEditStore'

const at = { spreadId: 's1', frameId: 't' }
const label: Frame = {
  id: 't',
  rect: { x: 10, y: 10, width: 60, height: 14 },
  z: 2,
  kind: 'text',
  content: { type: 'static', text: 'Hi' },
}

const textFrame = () =>
  getBookStoreSnapshot().book.spreads[0]?.frames.find((item) => item.id === 't')

describe('Text inspector', () => {
  beforeEach(() => {
    resetBookStore({
      book: makeBook({
        spreads: [
          makeSpread({ id: 's1', frames: [makeFrame({ id: 'a' }), label] }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetTextEditForTests()
    resetFrameSelection()
    resetBookStore()
  })

  it('a selected text frame opens Text: style, align, text, geometry, arrange, delete; no photo sections', () => {
    act(() => {
      setFrameSource(at)
    })
    render(<Inspector />)
    expect(screen.getByTestId('inspector-panel').dataset.inspectorView).toBe(
      'text',
    )
    expect(screen.getByTestId('inspector-context').textContent).toBe('Text')
    const section = screen.getByTestId('inspector-text')
    expect(
      within(section).getByRole('radio', { name: 'Caption' }),
    ).toHaveProperty('checked', true)
    expect(within(section).getByRole('radio', { name: 'Left' })).toHaveProperty(
      'checked',
      true,
    )
    expect(section.textContent).toContain('dbl-click to edit on canvas')
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveProperty(
      'value',
      'Hi',
    )
    expect(screen.getByTestId('inspector-geometry-disclosure')).toBeDefined()
    expect(
      screen.getByTestId('inspector-arrange-disclosure').textContent,
    ).toContain('layer 2 of 2')
    expect(screen.getByTestId('frame-delete')).toBeDefined()
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
    expect(screen.queryByTestId('inspector-caption-disclosure')).toBeNull()
    expect(screen.queryByTestId('inspector-meta')).toBeNull()
  })

  it('Style and Align are their own steps and keep the box', () => {
    act(() => {
      setFrameSource(at)
    })
    render(<Inspector />)
    fireEvent.click(screen.getByRole('radio', { name: 'Title' }))
    expect(textFrame()).toMatchObject({ styleId: 'title', rect: label.rect })
    expect(getHistorySnapshot().undoLabel).toBe('Text style')
    fireEvent.click(screen.getByRole('radio', { name: 'Right' }))
    expect(textFrame()?.align).toBe('right')
    expect(getHistorySnapshot().undoLabel).toBe('Align text')
  })

  it('shows the overflow meta while the frame overflows', () => {
    act(() => {
      setFrameSource(at)
    })
    render(<Inspector />)
    act(() => {
      setSpreadOverflow('s1', ['t'])
    })
    expect(screen.getByTestId('inspector-meta').textContent).toBe(
      'Text overflows the frame',
    )
  })

  it('typing coalesces per focus and grows the box to the painted text', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => {
      run(0)
      return 0
    })
    const proto = HTMLElement.prototype
    vi.spyOn(proto, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.matches('button.spread-frame') ? 60 * SPREAD_PX_PER_MM : 0
    })
    vi.spyOn(proto, 'scrollHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.matches('.spread-frame-text')
        ? 4 * 4.34 * SPREAD_PX_PER_MM + 0.5
        : 0
    })
    act(() => {
      setFrameSource(at)
    })
    render(
      <>
        <ConnectedSpreadView spreadId="s1" />
        <Inspector />
      </>,
    )
    const field = screen.getByRole('textbox', { name: 'Text' })
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'Hi there' } })
    fireEvent.change(field, { target: { value: 'Hi there, lake' } })
    expect(textFrame()?.content).toEqual({
      type: 'static',
      text: 'Hi there, lake',
    })
    expect(textFrame()?.rect.height).toBeCloseTo(4 * 4.34, 6)
    expect(getHistorySnapshot().undoLabel).toBe('Edit text')
    fireEvent.blur(field)
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'Next' } })
    undoBook()
    expect(textFrame()?.content).toEqual({
      type: 'static',
      text: 'Hi there, lake',
    })
    undoBook()
    expect(textFrame()).toMatchObject({
      content: { type: 'static', text: 'Hi' },
      rect: label.rect,
    })
  })

  it('isTextFrameTarget tells a text frame from a photo frame', () => {
    const { book } = getBookStoreSnapshot()
    expect(isTextFrameTarget(book, at)).toBe(true)
    expect(isTextFrameTarget(book, { spreadId: 's1', frameId: 'a' })).toBe(
      false,
    )
    expect(isTextFrameTarget(book, null)).toBe(false)
  })
})
