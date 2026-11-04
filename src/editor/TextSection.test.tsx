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
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import { installEditorKeys } from './galleryDrop'
import { Inspector } from './Inspector'
import { isTextFrameTarget } from './inspectorModel'
import { resetTextEditForTests, setSpreadOverflow } from './textEditStore'
import { TextFrameSections } from './TextSection'

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

function load(frames: Frame[]) {
  resetBookStore({
    book: makeBook({ spreads: [makeSpread({ id: 's1', frames })] }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('Text inspector', () => {
  beforeEach(() => {
    load([makeFrame({ id: 'a' }), label])
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
    expect(screen.getByRole('radio', { name: 'Right' })).toHaveProperty(
      'checked',
      true,
    )
    expect(getHistorySnapshot().undoLabel).toBe('Align text')
  })

  it('summarizes the layer on the collapsed Arrange; Esc in the field keeps the selection', () => {
    const stop = installEditorKeys()
    act(() => {
      setFrameSource(at)
    })
    render(<Inspector />)
    const trigger = within(
      screen.getByTestId('inspector-arrange-disclosure'),
    ).getAllByRole('button')[0]
    const described = trigger?.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(described)?.textContent).toBe('layer 2 of 2')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Text' }), {
      key: 'Escape',
    })
    expect(getFrameSource()).toEqual(at)
    stop()
  })

  it('renders nothing for a missing, photo or gone-spread target; bare text reads empty', () => {
    const { container } = render(
      <>
        <TextFrameSections target={{ spreadId: 's1', frameId: 'zz' }} />
        <TextFrameSections target={{ spreadId: 's1', frameId: 'a' }} />
        <TextFrameSections target={{ spreadId: 'gone', frameId: 't' }} />
      </>,
    )
    expect(within(container).queryByTestId('inspector-text')).toBeNull()
    cleanup()
    // A text frame whose content was never written.
    load([
      makeFrame({ id: 'a' }),
      { id: 't', rect: label.rect, z: 2, kind: 'text' },
    ])
    render(<TextFrameSections target={at} />)
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveProperty(
      'value',
      '',
    )
  })

  it('typing with no painted spread, no layout or a frame gone keeps the box', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => {
      frames.push(run)
      return 0
    })
    const flush = () => {
      for (const run of frames.splice(0)) {
        run(0)
      }
    }
    act(() => {
      setFrameSource(at)
    })
    const { rerender } = render(<Inspector />)
    const field = () => screen.getByRole('textbox', { name: 'Text' })
    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: 'No view' } })
    flush()
    expect(textFrame()?.rect).toEqual(label.rect)

    // Painted but unlaid-out (offsetWidth 0): no px scale to measure with.
    rerender(
      <>
        <ConnectedSpreadView spreadId="s1" />
        <Inspector />
      </>,
    )
    fireEvent.change(field(), { target: { value: 'No layout' } })
    flush()
    expect(textFrame()?.rect).toEqual(label.rect)

    fireEvent.change(field(), { target: { value: 'Gone' } })
    act(() => {
      dispatchBookOp({ type: 'removeFrames', spreadId: 's1', frameIds: ['t'] })
    })
    expect(() => {
      flush()
    }).not.toThrow()
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

  it('a photo frame keeps the Photo inspector', () => {
    act(() => {
      setFrameSource({ spreadId: 's1', frameId: 'a' })
    })
    render(<Inspector />)
    expect(screen.getByTestId('inspector-context').textContent).toBe('Photo')
    expect(screen.queryByTestId('inspector-text')).toBeNull()
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
