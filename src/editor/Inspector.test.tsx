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
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  subscribeBookStore,
  undoBook,
} from './bookStore'
import {
  enterCropMode,
  exitCropMode,
  getCropTarget,
  getCropTargetKey,
} from './cropMode'
import { SUB } from './editorChromeTokens'
import { setEndpaperSelected } from './endpaperSelection'
import {
  resetFrameSelection,
  setFrameSelection,
  setFrameSource,
} from './frameSelection'
import { Inspector } from './Inspector'
import {
  resetLeftPanelTabForTests,
  setLeftPanelTab,
  setPickedParentId,
} from './leftPanelTabStore'
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
    resetLeftPanelTabForTests()
    setBookSettingsSelected(false)
    exitCropMode()
    resetFrameSelection()
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('shows the empty hint and no crop section for a book without spreads', () => {
    seedBook(makeBook({ spreads: [] }))
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

  it('shows the Spread context for the active spread; Esc and a re-pick keep it (kit)', () => {
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

    // Repro 3 (inspector-empty-after-grey): Esc, then the same spread again.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel.getAttribute('data-inspector-view')).toBe('spread')
    act(() => {
      setActiveSpreadId('spread-1')
    })
    expect(panel.getAttribute('data-inspector-view')).toBe('spread')
    expect(screen.queryByTestId('inspector-empty')).toBeNull()
  })

  it('shows the first spread while no spread is active yet', () => {
    seed()
    render(<Inspector />)
    expect(screen.getByTestId('inspector-context').textContent).toBe('Spread')
    expect(screen.getByTestId('inspector-spread-summary').textContent).toBe(
      'Page 1 · 0 empty',
    )
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

  it('shows the master inspector in Masters mode while a spread frame is selected', () => {
    seedBook(
      makeBook({
        defaultParentId: 'p-a',
        parents: [
          { id: 'p-a', name: 'Master A', frames: [], guides: [] },
          { id: 'p-b', name: 'Master B', frames: [], guides: [] },
        ],
      }),
    )
    setActiveSpreadId('spread-1')
    setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    render(<Inspector />)

    act(() => {
      setLeftPanelTab('masters')
    })

    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('master')
    expect(screen.getByTestId('inspector-context').textContent).toBe('Master A')
    expect(screen.getByTestId('master-usage').textContent).toBe(
      'Default · all 1 page',
    )
    expect(screen.queryByTestId('inspector-header')).toBeNull()

    act(() => {
      setPickedParentId('p-b')
    })
    expect(screen.getByTestId('inspector-context').textContent).toBe('Master B')
    expect(screen.getByTestId('master-usage').textContent).toBe('Not used yet')
  })

  it('shows Book settings in Masters mode from the page-number hint; a master frame leaves it', () => {
    seedBook(
      makeBook({
        parents: [
          {
            id: 'p-a',
            name: 'Master A',
            frames: [makeFrame({ id: 'logo' })],
            guides: [],
          },
        ],
      }),
    )
    setLeftPanelTab('masters')
    render(<Inspector />)
    const view = () =>
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view')

    fireEvent.click(screen.getByTestId('master-pn-toggle'))
    fireEvent.click(screen.getByTestId('master-pn-book-settings'))
    expect(view()).toBe('book')
    expect(screen.getByTestId('book-pn-note').textContent).toBe('Page 1 is 1')

    act(() => {
      setFrameSource({ spreadId: 'p-a', frameId: 'logo' })
    })
    expect(view()).toBe('frame')
  })

  it('opens the Photo view for a frame on the shown master; clearing it returns to the master', () => {
    seedBook(
      makeBook({
        parents: [
          {
            id: 'p-a',
            name: 'Master A',
            frames: [makeFrame({ id: 'logo' })],
            guides: [],
          },
        ],
      }),
    )
    setLeftPanelTab('masters')
    render(<Inspector />)

    act(() => {
      setFrameSource({ spreadId: 'p-a', frameId: 'logo' })
    })
    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('frame')
    expect(screen.getByTestId('inspector-context').textContent).toBe('Photo')
    // The parent frame resolves: an empty frame shows the empty Photo row.
    expect(screen.getByTestId('inspector-photo-empty')).toBeTruthy()

    act(() => {
      setFrameSource(null)
    })
    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('master')
  })

  it('shows the no-masters hint in Masters mode when the book has none', () => {
    seed()
    render(<Inspector />)

    act(() => {
      setLeftPanelTab('masters')
    })

    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('masters')
    expect(screen.getByTestId('inspector-body').textContent).toBe(
      'Create a master with New master to set its grid.',
    )
    expect(screen.queryByTestId('inspector-header')).toBeNull()
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
      seedBook(makeBook({ spreads: [] }))
      render(<Inspector />)
      const muted = cssColor(SUB)
      expect(muted).not.toBe('')
      expect(screen.getByTestId('inspector-empty').style.color).toBe(muted)
      act(() => {
        seed()
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
    // Kit Done keeps shadow-xs (r12 M77).
    expect(
      screen.getByTestId('crop-toggle').classList.contains('fit-crop-toggle'),
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

describe('Inspector, multi context', () => {
  afterEach(() => {
    cleanup()
    resetFrameSelection()
    setActiveSpreadId(null)
    resetBookStore()
  })

  /** Three 40 × 30 frames in a row at x 10 / 60 / 150 (uneven gaps). */
  function seedRow(lockedId?: string) {
    seedBook(
      makeBook({
        spreads: [
          makeSpread({
            id: 's',
            frames: [
              ['a', 10, 'p1'],
              ['b', 60, undefined],
              ['c', 150, 'p2'],
            ].map(([id, x, assetId], index) =>
              makeFrame({
                id: String(id),
                rect: {
                  x: Number(x),
                  y: 20 + index * 5,
                  width: 40,
                  height: 30,
                },
                z: index + 1,
                ...(assetId === undefined ? {} : { assetId: String(assetId) }),
                ...(id === lockedId ? { locked: true } : {}),
              }),
            ),
          }),
        ],
      }),
    )
  }

  function select(...frameIds: string[]) {
    act(() => {
      setFrameSelection({ spreadId: 's', frameIds })
    })
  }

  const rect = (id: string) =>
    getBookStoreSnapshot().book.spreads[0]?.frames.find((f) => f.id === id)
      ?.rect

  it('shows the Multiple selection header, meta, and only the set sections', () => {
    seedRow()
    render(<Inspector />)
    select('a', 'b', 'c')

    const panel = screen.getByTestId('inspector-panel')
    expect(panel.getAttribute('data-inspector-view')).toBe('multi')
    expect(screen.getByTestId('inspector-context').textContent).toBe(
      'Multiple selection',
    )
    expect(
      screen
        .getByTestId('inspector-header')
        .querySelector('[data-icon="layers"]'),
    ).not.toBeNull()
    expect(screen.getByTestId('inspector-multi-summary').textContent).toBe(
      '3 frames · 2 photos, 1 empty',
    )
    expect(screen.getByTestId('inspector-align')).toBeTruthy()
    expect(screen.getByTestId('frame-layer').textContent).toBe(
      'layers 1–3 of 3',
    )
    expect(screen.getByTestId('frame-delete').textContent).toContain(
      'Delete 3 frames',
    )
    for (const single of [
      'inspector-photo',
      'crop-zoom',
      'inspector-geometry-disclosure',
      'inspector-style-disclosure',
      'layout-section',
    ]) {
      expect(screen.queryByTestId(single)).toBeNull()
    }

    const probe = document.createElement('div')
    probe.style.color = SUB
    expect(screen.getByTestId('inspector-multi-summary').style.color).toBe(
      probe.style.color,
    )

    // Down to one frame: the Photo context again.
    select('a')
    expect(panel.getAttribute('data-inspector-view')).toBe('frame')
    expect(screen.queryByTestId('inspector-multi-summary')).toBeNull()
    expect(screen.queryByTestId('inspector-align')).toBeNull()
  })

  it('labels the 8 buttons in 3 groups and enables them by unlocked count', () => {
    seedRow()
    render(<Inspector />)
    select('a', 'b')

    const groups = screen
      .getByRole('toolbar', { name: 'Align' })
      .querySelectorAll('[role="group"]')
    expect(
      Array.from(groups, (group) => group.querySelectorAll('button').length),
    ).toEqual([3, 3, 2])
    const names = [
      ['align-left', 'Align left edges'],
      ['align-center-x', 'Align horizontal centers'],
      ['align-right', 'Align right edges'],
      ['align-top', 'Align top edges'],
      ['align-center-y', 'Align vertical centers'],
      ['align-bottom', 'Align bottom edges'],
      ['distribute-h', 'Distribute horizontally'],
      ['distribute-v', 'Distribute vertically'],
    ]
    for (const [testId, name] of names) {
      expect(screen.getByTestId(testId ?? '').getAttribute('aria-label')).toBe(
        name,
      )
    }
    expect(screen.getByTestId('align-left').hasAttribute('aria-disabled')).toBe(
      false,
    )
    // Two frames: Distribute stays focusable and says why.
    const distribute = screen.getByTestId('distribute-h')
    expect(distribute.getAttribute('aria-disabled')).toBe('true')
    expect((distribute as HTMLButtonElement).disabled).toBe(false)
    expect(
      screen.getByRole('button', {
        name: 'Distribute horizontally',
        description: 'Select 3 or more unlocked frames',
      }),
    ).toBe(distribute)
    expect(screen.getByTestId('align-caption').textContent).toBe(
      'Selection 90 × 35 mm',
    )
  })

  it('with a locked frame: Align needs 2 unlocked, the caption counts it', () => {
    seedRow('c')
    render(<Inspector />)
    select('a', 'c')
    expect(screen.getByTestId('align-left').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(
      screen.getByRole('button', {
        name: 'Align left edges',
        description: 'Needs 2 unlocked frames',
      }),
    ).toBeTruthy()
    expect(screen.getByTestId('align-caption').textContent).toBe(
      'Selection 180 × 40 mm · 1 locked, skipped',
    )
    const before = getBookStoreSnapshot().book
    fireEvent.click(screen.getByTestId('align-left'))
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('distribute is one book commit and one undo step', () => {
    seedRow()
    render(<Inspector />)
    select('a', 'b', 'c')
    let commits = 0
    const off = subscribeBookStore(() => {
      commits += 1
    })
    fireEvent.click(screen.getByTestId('distribute-h'))
    off()
    expect(commits).toBe(1)
    // Span 10…190, frames 120 wide: two 30 mm gaps.
    expect(rect('b')?.x).toBe(80)
    expect(getHistorySnapshot().undoLabel).toBe('Distribute frames')
    act(() => {
      undoBook()
    })
    expect(rect('b')?.x).toBe(60)
  })

  it('align left skips the locked frame', () => {
    seedRow('a')
    render(<Inspector />)
    select('a', 'b', 'c')
    fireEvent.click(screen.getByTestId('align-left'))
    expect([rect('a')?.x, rect('b')?.x, rect('c')?.x]).toEqual([10, 60, 60])
  })

  it('names the set Arrange buttons with their kit shortcut', () => {
    seedRow()
    render(<Inspector />)
    select('a', 'b')
    expect(screen.getByTestId('z-back').getAttribute('aria-label')).toBe(
      'Send to back (Shift+Ctrl+[)',
    )
    expect(screen.getByTestId('z-front').getAttribute('aria-label')).toBe(
      'Bring to front (Shift+Ctrl+])',
    )
  })

  it('arranges the set in one step and deletes it', () => {
    seedRow()
    render(<Inspector />)
    select('a', 'b')
    fireEvent.click(screen.getByTestId('z-front'))
    expect(screen.getByTestId('frame-layer').textContent).toBe(
      'layers 2–3 of 3',
    )
    expect(getHistorySnapshot().undoLabel).toBe('Reorder frames')
    fireEvent.click(screen.getByTestId('frame-delete'))
    expect(
      getBookStoreSnapshot().book.spreads[0]?.frames.map((f) => f.id),
    ).toEqual(['c'])
    expect(getHistorySnapshot().undoLabel).toBe('Delete 2 frames')
  })
})
