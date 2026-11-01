import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  makeBook,
  makeBookWithAsset,
  makeFrame,
  makeSpread,
} from '../core/testing/fixtures'
import { setBookSettingsSelected } from './bookSettingsSelection'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  enterCropMode,
  exitCropMode,
  getCropTarget,
  getCropTargetKey,
} from './cropMode'
import { SUB } from './editorChromeTokens'
import { setEndpaperSelected } from './endpaperSelection'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { Inspector } from './Inspector'
import { setActiveSpreadId } from './photoRootSession'

// Pass-through so a test can hand the panel a stale crop target.
vi.mock('./cropMode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./cropMode')>()
  return {
    ...actual,
    getCropTarget: vi.fn(actual.getCropTarget),
    getCropTargetKey: vi.fn(actual.getCropTargetKey),
  }
})

const realCrop =
  await vi.importActual<typeof import('./cropMode')>('./cropMode')

function staleCropTarget(spreadId: string, frameId: string) {
  vi.mocked(getCropTargetKey).mockImplementation(() => `${spreadId}/${frameId}`)
  vi.mocked(getCropTarget).mockImplementation(() => ({ spreadId, frameId }))
}

function seedBook(book: ReturnType<typeof makeBook>) {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function crop() {
  return getBookStoreSnapshot().book.spreads[0]?.frames[0]?.crop
}

function zoomInput() {
  return within(screen.getByTestId('crop-zoom')).getByRole<HTMLInputElement>(
    'slider',
  )
}

function frame() {
  return getBookStoreSnapshot().book.spreads[0]?.frames[0]
}

function seed() {
  resetBookStore({
    book: makeBookWithAsset('a'),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('Inspector', () => {
  afterEach(() => {
    vi.mocked(getCropTarget).mockImplementation(realCrop.getCropTarget)
    vi.mocked(getCropTargetKey).mockImplementation(realCrop.getCropTargetKey)
    cleanup()
    setBookSettingsSelected(false)
    exitCropMode()
    resetFrameSelection()
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('shows the empty hint and no crop section with nothing selected', () => {
    render(<Inspector />)
    const panel = screen.getByTestId('inspector-panel')
    expect(panel.getAttribute('data-inspector-view')).toBe('empty')
    expect(screen.getByTestId('inspector-empty').textContent).toMatch(
      /Select a spread or a photo/,
    )
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
    // No context and no collapse button: no empty header bar.
    expect(screen.queryByTestId('inspector-header')).toBeNull()
  })

  it('shows the Spread context for the active spread, Esc returns to empty', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setActiveSpreadId('spread-1')
    })
    const panel = screen.getByTestId('inspector-panel')
    expect(panel.getAttribute('data-inspector-view')).toBe('spread')
    // Kit (context-inspector.tsx:56-63): summary line, Layout and Grid; no
    // Spread properties block and no frame hint.
    expect(screen.queryByTestId('inspector-spread-properties')).toBeNull()
    expect(screen.queryByText('Frames')).toBeNull()
    expect(screen.getByTestId('inspector-spread-summary').textContent).toBe(
      'Page 1 · 0 empty',
    )
    expect(screen.queryByTestId('inspector-empty')).toBeNull()
    expect(screen.getByTestId('inspector-spread-summary').style.color).not.toBe(
      '',
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel.getAttribute('data-inspector-view')).toBe('empty')
  })

  it('shows the Photo context for a selected frame', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('frame')
    expect(screen.getByTestId('inspector-context').textContent).toBe('Photo')
  })

  // Owner Must M54 (round 7): only the top-bar toggle hides the inspector.
  it('has no Hide inspector button in any context', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setActiveSpreadId('spread-1')
    })
    expect(screen.getByTestId('inspector-header')).toBeTruthy()
    expect(screen.queryByTestId('panel-collapse-right')).toBeNull()
    expect(screen.queryByRole('button', { name: /Hide inspector/ })).toBeNull()
  })

  // Owner Must M48 (round 7): the endpaper head is the panel's first block.
  it('opens the endpaper context on its own head, with no header bar', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setEndpaperSelected('front')
    })
    try {
      const body = screen.getByTestId('inspector-body')
      expect(screen.queryByTestId('inspector-header')).toBeNull()
      expect(body.previousElementSibling).toBeNull()
      expect(body.textContent).toContain('Endpaper · front')
    } finally {
      act(() => {
        setEndpaperSelected(null)
      })
    }
  })

  describe('context panel (no tabs)', () => {
    const cssColor = (value: string) => {
      const probe = document.createElement('div')
      probe.style.color = value
      return probe.style.color
    }

    it('renders no tablist: the selection drives the panel', () => {
      render(<Inspector />)
      expect(screen.queryByRole('tablist')).toBeNull()
      expect(screen.queryByTestId('inspector-tab-frame')).toBeNull()
    })

    it('paints the context icon and hints in the muted colour', () => {
      seed()
      render(<Inspector />)
      const muted = cssColor(SUB)
      expect(muted).not.toBe('')
      expect(screen.getByTestId('inspector-empty').style.color).toBe(muted)
      act(() => {
        setActiveSpreadId('spread-1')
      })
      const icon = screen
        .getByTestId('inspector-header')
        .querySelector<HTMLElement>('.inspector-context-icon')
      expect(icon?.style.color).toBe(muted)
    })

    it('renders no row list with nothing selected', () => {
      seed()
      render(<Inspector />)
      expect(
        screen.getByTestId('inspector-body').querySelector('dl'),
      ).toBeNull()
    })

    // Kit Spread context (context-inspector.tsx:56-63) has no row list.
    it('shows no row list and no Spread properties for a spread', () => {
      seed()
      act(() => {
        setActiveSpreadId('spread-1')
      })
      render(<Inspector />)
      const panel = screen.getByTestId('inspector-body')
      expect(panel.querySelector('dl')).toBeNull()
      expect(within(panel).queryByText('Spread properties')).toBeNull()
      // Kit InspectorShell header (context-inspector.tsx:35-42) sits above the body.
      const header = screen.getByTestId('inspector-header')
      expect(within(header).getByTestId('inspector-context').textContent).toBe(
        'Spread',
      )
      expect(
        within(header).getByTestId('inspector-spread-summary').textContent,
      ).toBe('Page 1 · 0 empty')
      expect(
        [...panel.querySelectorAll('.inspector-eyebrow')].map(
          (el) => el.textContent,
        ),
      ).toEqual(['Layout', 'Master & spacing', 'Background', 'Grid'])
    })

    // Kit Photo context (context-inspector.tsx:66-72) has no meta rows.
    it('shows no meta rows and no Details section for a frame', () => {
      seed()
      act(() => {
        setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
      })
      render(<Inspector />)
      const panel = screen.getByTestId('inspector-body')
      expect(panel.querySelector('dl')).toBeNull()
      expect(within(panel).queryByText('Used')).toBeNull()
      expect(within(panel).queryByText('Details')).toBeNull()
      expect(within(panel).queryByText('Spread properties')).toBeNull()
      const header = screen.getByTestId('inspector-header')
      expect(within(header).getByTestId('inspector-context').textContent).toBe(
        'Photo',
      )
      // The pages / empty-frames line belongs to the Spread context only.
      expect(
        within(header).queryByTestId('inspector-spread-summary'),
      ).toBeNull()
      // Kit header icon is the muted SUB colour.
      const probe = document.createElement('span')
      probe.style.color = SUB
      expect(
        header.querySelector<HTMLElement>('.inspector-context-icon')?.style
          .color,
      ).toBe(probe.style.color)
    })

    it('lists layout and grid for a spread', () => {
      seed()
      act(() => {
        setActiveSpreadId('spread-1')
      })
      render(<Inspector />)
      const panel = screen.getByTestId('inspector-body')
      expect(within(panel).getByTestId('layout-section')).toBeTruthy()
      expect(within(panel).getByTestId('grid-section-spread')).toBeTruthy()
      expect(within(panel).queryByTestId('grid-section-book')).toBeNull()
      expect(within(panel).queryByTestId('inspector-empty')).toBeNull()
    })

    it('opens Book settings from the title and leaves it for a spread', () => {
      seed()
      render(<Inspector />)
      act(() => {
        setBookSettingsSelected(true)
      })
      expect(screen.getByTestId('book-settings')).toBeTruthy()
      expect(screen.queryByTestId('grid-section-book')).toBeNull()
      expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
      act(() => {
        setActiveSpreadId('spread-1')
      })
      expect(screen.queryByTestId('book-settings')).toBeNull()
      expect(screen.getByTestId('grid-section-spread')).toBeTruthy()
    })

    it('leaves Book settings when a frame is picked', () => {
      seed()
      render(<Inspector />)
      act(() => {
        setBookSettingsSelected(true)
      })
      act(() => {
        setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
      })
      expect(screen.queryByTestId('book-settings')).toBeNull()
      expect(screen.getByTestId('inspector-fit-crop')).toBeTruthy()
    })

    it('orders Photo, Fit & crop, Rotate before the collapsed disclosures', () => {
      seed()
      act(() => {
        setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
      })
      render(<Inspector />)
      const names = within(screen.getByTestId('inspector-body'))
        .getAllByRole('button')
        .map((b) => b.textContent)
      const at = (label: string) => names.findIndex((n) => n.includes(label))
      expect(at('Position & size')).toBeGreaterThan(at('Reset to cover'))
      expect(at('Arrange')).toBeGreaterThan(at('Position & size'))
      for (const label of ['Position & size', 'Arrange']) {
        expect(
          screen
            .getByRole('button', { name: label })
            .getAttribute('aria-expanded'),
        ).toBe('false')
      }
    })

    it('removes the photo from its frame', () => {
      seed()
      act(() => {
        setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
      })
      render(<Inspector />)
      expect(screen.getByTestId('inspector-photo-thumb')).toBeTruthy()
      fireEvent.click(screen.getByTestId('photo-remove'))
      expect(frame()?.assetId).toBeUndefined()
      expect(screen.queryByTestId('photo-remove')).toBeNull()
    })
  })

  it('shows the Photo context in crop mode even when the selection is gone', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    expect(screen.getByTestId('inspector-context').textContent).toBe('Photo')
    expect(screen.queryByTestId('inspector-empty')).toBeNull()
    expect(screen.getByTestId('crop-reset')).toBeTruthy()
  })

  it('zooms via the slider and resets to cover', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    const reset = screen.getByTestId<HTMLButtonElement>('crop-reset')
    expect(reset.disabled).toBe(true)

    fireEvent.change(zoomInput(), { target: { value: '2' } })
    expect(crop()?.zoom).toBe(2)
    expect(reset.disabled).toBe(false)

    fireEvent.click(reset)
    expect(crop()).toEqual({ zoom: 1, center: { x: 0.5, y: 0.5 } })
  })

  it('shows no crop section when the target frame has no photo', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'missing')
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('shows no crop section when the target spread is gone', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('gone', 'frame-1')
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it.each([
    ['x', { x: 0.3, y: 0.5 }],
    ['y', { x: 0.5, y: 0.3 }],
  ])('enables reset when only the %s center is off cover', (_axis, center) => {
    const base = makeBookWithAsset('a')
    const [spread] = base.spreads
    const book = {
      ...base,
      spreads: [
        {
          ...spread,
          frames: spread?.frames.map((item) => ({
            ...item,
            crop: { zoom: 1, center },
          })),
        },
      ],
    } as typeof base
    resetBookStore({
      book,
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    expect(screen.getByTestId<HTMLButtonElement>('crop-reset').disabled).toBe(
      false,
    )
  })

  it('drops the section when crop mode ends', () => {
    seed()
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    expect(screen.getByTestId('inspector-fit-crop')).toBeTruthy()
    act(() => {
      exitCropMode()
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it.each([
    ['frame', 'spread-1', 'missing'],
    ['spread', 'gone', 'frame-1'],
  ])('ignores a stale crop target whose %s is gone', (_what, spreadId, id) => {
    seed()
    staleCropTarget(spreadId, id)
    render(<Inspector />)
    expect(screen.getByTestId('inspector-panel')).toBeTruthy()
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('crops the targeted frame, not the first one', () => {
    const zoomed = { zoom: 2, center: { x: 0.5, y: 0.5 } }
    seedBook(
      makeBook({
        assets: { a: {} },
        gallery: ['a'],
        spreads: [
          makeSpread({
            id: 'spread-1',
            frames: [makeFrame({ id: 'frame-1', assetId: 'a' })],
          }),
          makeSpread({
            id: 'spread-2',
            frames: [
              makeFrame({ id: 'frame-1', assetId: 'a' }),
              makeFrame({ id: 'frame-2', assetId: 'a', crop: zoomed }),
            ],
          }),
        ],
      }),
    )
    render(<Inspector />)
    act(() => {
      enterCropMode('spread-2', 'frame-2')
    })
    expect(zoomInput().valueAsNumber).toBe(2)
    expect(screen.getByTestId<HTMLButtonElement>('crop-reset').disabled).toBe(
      false,
    )
  })

  it('shows Fit & crop for a selected photo frame and toggles Crop / Done', () => {
    seed()
    render(<Inspector />)
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(screen.getByText('Fit & crop')).toBeTruthy()
    const toggle = screen.getByTestId('crop-toggle')
    expect(toggle.textContent).toBe('Crop')
    // Kit inspector.tsx:139 outline + shadow-xs = app `secondary` (r11 M70).
    expect(toggle.classList.contains('pb-button--secondary')).toBe(true)
    expect(getCropTarget()).toBeNull()

    fireEvent.click(toggle)
    expect(getCropTarget()).toMatchObject({
      spreadId: 'spread-1',
      frameId: 'frame-1',
    })
    expect(screen.getByTestId('crop-toggle').textContent).toBe('Done')
    expect(
      screen
        .getByTestId('crop-toggle')
        .classList.contains('pb-button--default'),
    ).toBe(true)

    fireEvent.click(screen.getByTestId('crop-toggle'))
    expect(getCropTarget()).toBeNull()
    expect(screen.getByTestId('crop-toggle').textContent).toBe('Crop')
  })

  it('shows no Fit & crop for a selected empty frame', () => {
    seedBook(
      makeBook({
        spreads: [
          makeSpread({
            id: 'spread-1',
            frames: [makeFrame({ id: 'frame-1' })],
          }),
        ],
      }),
    )
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
  })

  it('switches Fill | Fit and resets zoom and pan', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    fireEvent.change(zoomInput(), { target: { value: '2' } })
    expect(crop()?.zoom).toBe(2)

    fireEvent.click(screen.getByRole('radio', { name: 'Fit' }))
    expect(frame()?.fit).toBe('fit')
    expect(frame()?.crop).toBeUndefined()
    expect(screen.getByTestId<HTMLButtonElement>('crop-reset').disabled).toBe(
      true,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Fill' }))
    expect(frame()?.fit).toBeUndefined()
  })

  it('pans through the percent fields', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    fireEvent.change(zoomInput(), { target: { value: '3' } })
    const panX = screen.getByRole('textbox', { name: 'Pan X' })
    fireEvent.change(panX, { target: { value: '30' } })
    fireEvent.blur(panX)
    expect(crop()?.center.x).toBeCloseTo(0.65)
  })

  it('steps zoom with ArrowUp while hovered and resets on double-click', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    const slider = screen.getByTestId('crop-zoom')
    fireEvent.change(zoomInput(), { target: { value: '2' } })
    fireEvent.pointerEnter(slider)
    fireEvent.keyDown(document.body, { key: 'ArrowUp' })
    expect(crop()?.zoom).toBeCloseTo(2.01)

    fireEvent.doubleClick(slider)
    expect(crop()?.zoom).toBe(1)
  })

  describe('zoom slider hover keys', () => {
    function openZoomed(zoom: string) {
      seed()
      render(<Inspector />)
      act(() => {
        setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
      })
      fireEvent.change(zoomInput(), { target: { value: zoom } })
      return screen.getByTestId('crop-zoom')
    }

    it('ArrowDown steps down, Shift multiplies by ten', () => {
      const slider = openZoomed('2')
      fireEvent.pointerEnter(slider)
      fireEvent.keyDown(document.body, { key: 'ArrowDown' })
      expect(crop()?.zoom).toBeCloseTo(1.99)
      fireEvent.keyDown(document.body, { key: 'ArrowUp', shiftKey: true })
      expect(crop()?.zoom).toBeCloseTo(2.09)
      fireEvent.keyDown(document.body, { key: 'ArrowDown', shiftKey: true })
      expect(crop()?.zoom).toBeCloseTo(1.99)
    })

    it('clamps at 100% and 400% and swallows the key', () => {
      const slider = openZoomed('4')
      fireEvent.pointerEnter(slider)
      const swallowed = !fireEvent.keyDown(document.body, { key: 'ArrowUp' })
      expect(swallowed).toBe(true)
      expect(crop()?.zoom).toBe(4)
      fireEvent.change(zoomInput(), { target: { value: '1' } })
      fireEvent.keyDown(document.body, { key: 'ArrowDown' })
      expect(crop()?.zoom).toBe(1)
    })

    it('ignores keys when not hovered, after leaving, or with modifiers', () => {
      const slider = openZoomed('2')
      fireEvent.keyDown(document.body, { key: 'ArrowUp' })
      expect(crop()?.zoom).toBe(2)
      fireEvent.pointerEnter(slider)
      fireEvent.keyDown(document.body, { key: 'ArrowUp', ctrlKey: true })
      fireEvent.keyDown(document.body, { key: 'ArrowUp', metaKey: true })
      fireEvent.keyDown(document.body, { key: 'ArrowUp', altKey: true })
      fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
      expect(crop()?.zoom).toBe(2)
      fireEvent.pointerLeave(slider)
      fireEvent.keyDown(document.body, { key: 'ArrowUp' })
      expect(crop()?.zoom).toBe(2)
    })

    it('leaves the key to the focused slider thumb', () => {
      const slider = openZoomed('2')
      fireEvent.pointerEnter(slider)
      zoomInput().focus()
      fireEvent.keyDown(zoomInput(), { key: 'ArrowUp' })
      // One native step, not doubled by the hover handler.
      expect(crop()?.zoom).toBeCloseTo(2.01)
    })

    it('shows the zoom as a percent and caps the thumb at 400%', () => {
      const slider = openZoomed('2')
      expect(within(slider).getByRole('status').textContent).toBe('200%')
      expect(
        slider.querySelector<HTMLElement>('.fit-crop-fill')?.style.width,
      ).toBe('33.33333333333333%')
    })
  })

  it('pans Y and X from the percent fields and shows the current pan', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    fireEvent.change(zoomInput(), { target: { value: '3' } })
    const panY = screen.getByRole('textbox', { name: 'Pan Y' })
    fireEvent.change(panY, { target: { value: '-30' } })
    fireEvent.blur(panY)
    expect(crop()?.center.y).toBeCloseTo(0.35)
    expect(crop()?.center.x).toBe(0.5)
    expect((panY as HTMLInputElement).value).toBe('-30')

    const panX = screen.getByRole('textbox', { name: 'Pan X' })
    fireEvent.change(panX, { target: { value: '20' } })
    fireEvent.blur(panX)
    expect(crop()?.center.x).toBeCloseTo(0.6)
    expect(crop()?.center.y).toBeCloseTo(0.35)
    expect((panX as HTMLInputElement).value).toBe('20')

    fireEvent.change(panX, { target: { value: '' } })
    fireEvent.blur(panX)
    expect(crop()?.center.x).toBeCloseTo(0.6)
  })
})
