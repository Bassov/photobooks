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

  it('a selected text frame opens Text: style, align, text, live, geometry, arrange, delete; no photo sections', () => {
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
    const live = within(section).getByTestId('live-caption')
    expect(
      within(live)
        .getByRole('switch', { name: 'Live from photo metadata' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    expect(within(live).queryByTestId('live-caption-anchor')).toBeNull()
    expect(
      within(live)
        .getAllByRole('button')
        .map((chip) => [chip.textContent, chip.title]),
    ).toEqual([
      ['date', 'No photo in this frame'],
      ['title', 'No photo in this frame'],
      ['caption', 'No photo in this frame'],
      ['camera', 'No photo in this frame'],
    ])
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

describe('Live block', () => {
  const lake = makeFrame({
    id: 'a',
    rect: { x: 10, y: 10, width: 60, height: 40 },
    assetId: 'lake',
  })
  const other = makeFrame({
    id: 'b',
    rect: { x: 200, y: 10, width: 60, height: 40 },
  })
  const under: Frame = {
    ...label,
    rect: { x: 10, y: 52, width: 60, height: 14 },
  }

  function loadLive(frames: Frame[]) {
    resetBookStore({
      book: makeBook({
        spreads: [makeSpread({ id: 's1', frames })],
        assets: {
          lake: {
            relativePath: 'trip/IMG_0001.jpg',
            capturedAt: '2025-07-12T08:35:00',
            meta: { title: 'Morning on the lake' },
          },
        },
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    act(() => {
      setFrameSource(at)
    })
    render(<Inspector />)
  }

  const liveSwitch = () =>
    screen.getByRole('switch', { name: 'Live from photo metadata' })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetFrameSelection()
    resetBookStore()
  })

  it('switch on anchors the nearest photo, off freezes the painted text; each one step', () => {
    loadLive([lake, other, under])
    expect(screen.getByTestId('live-token-date').title).toBe('12 Jul 2025')
    expect(screen.getByTestId('live-token-caption').title).toBe(
      'Not in this photo',
    )
    expect(screen.getByTestId('live-token-caption').dataset.missing).toBe(
      'true',
    )
    expect(
      screen.getByTestId('live-token-date').dataset.missing,
    ).toBeUndefined()
    fireEvent.click(liveSwitch())
    expect(textFrame()).toMatchObject({
      content: { type: 'template', template: 'Hi' },
      anchorFrameId: 'a',
    })
    expect(getHistorySnapshot().undoLabel).toBe('Make caption live')
    const anchor = screen.getByTestId('live-caption-anchor')
    expect(anchor).toHaveProperty('value', 'a')
    expect(
      [...anchor.querySelectorAll('option')].map((o) => o.textContent),
    ).toEqual(['Frame 1 · IMG_0001.jpg', 'Frame 2 · empty'])
    expect(screen.getByText('Anchored to')).toBeDefined()

    fireEvent.change(anchor, { target: { value: 'b' } })
    expect(textFrame()?.anchorFrameId).toBe('b')
    expect(getHistorySnapshot().undoLabel).toBe('Anchor caption')
    expect(screen.getByTestId('live-caption-anchor')).toHaveProperty(
      'value',
      'b',
    )
    expect(screen.getByTestId('live-token-date').title).toBe(
      'No photo in this frame',
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
      target: { value: '{date} at {camera}' },
    })
    expect(textFrame()?.content).toEqual({
      type: 'template',
      template: '{date} at {camera}',
    })
    fireEvent.click(liveSwitch())
    expect(textFrame()?.content).toEqual({ type: 'static', text: '— at —' })
    expect(textFrame()?.anchorFrameId).toBeUndefined()
    expect(getHistorySnapshot().undoLabel).toBe('Make caption static')
    expect(screen.queryByTestId('live-caption-anchor')).toBeNull()
    act(() => {
      undoBook()
    })
    expect(textFrame()).toMatchObject({
      content: { type: 'template', template: '{date} at {camera}' },
      anchorFrameId: 'b',
    })
  })

  it('a chip turns Live on and appends with the separator in one Insert token step', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => {
      run(0)
      return 0
    })
    loadLive([lake, under])
    const steps = getHistorySnapshot().undoLabel
    fireEvent.click(screen.getByTestId('live-token-date'))
    expect(textFrame()).toMatchObject({
      content: { type: 'template', template: 'Hi · {date}' },
      anchorFrameId: 'a',
    })
    expect(getHistorySnapshot().undoLabel).toBe('Insert token')
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveProperty(
      'value',
      'Hi · {date}',
    )
    fireEvent.click(screen.getByTestId('live-token-title'))
    expect(textFrame()?.content).toEqual({
      type: 'template',
      template: 'Hi · {date} · {title}',
    })
    act(() => {
      undoBook()
    })
    act(() => {
      undoBook()
    })
    expect(textFrame()?.content).toEqual({ type: 'static', text: 'Hi' })
    expect(textFrame()?.anchorFrameId).toBeUndefined()
    expect(getHistorySnapshot().undoLabel).toBe(steps)
  })

  it('a chip grows the box to the painted text in the same step', () => {
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
    loadLive([lake, under])
    render(<ConnectedSpreadView spreadId="s1" />)
    fireEvent.click(screen.getByTestId('live-token-title'))
    expect(textFrame()?.rect.height).toBeCloseTo(4 * 4.34, 6)
    act(() => {
      undoBook()
    })
    expect(textFrame()).toMatchObject({
      content: { type: 'static', text: 'Hi' },
      rect: under.rect,
    })
  })

  it('a chip replaces the Text selection remembered at its blur, caret after it', () => {
    loadLive([lake, { ...under, content: { type: 'static', text: 'At , ok' } }])
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Text',
    })
    field.setSelectionRange(3, 3)
    fireEvent.blur(field)
    fireEvent.click(screen.getByTestId('live-token-date'))
    expect(textFrame()?.content).toEqual({
      type: 'template',
      template: 'At {date}, ok',
    })
    fireEvent.click(screen.getByTestId('live-token-camera'))
    expect(textFrame()?.content).toEqual({
      type: 'template',
      template: 'At {date}{camera}, ok',
    })
  })

  it('no image frame on the spread: disabled switch and the hint, no chips', () => {
    loadLive([under])
    expect(liveSwitch().getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByTestId('live-caption-hint').textContent).toBe(
      'Add a photo frame to this spread to use its metadata.',
    )
    expect(screen.queryByTestId('live-tokens')).toBeNull()
    fireEvent.click(liveSwitch())
    expect(textFrame()?.content).toEqual({ type: 'static', text: 'Hi' })
  })
})
