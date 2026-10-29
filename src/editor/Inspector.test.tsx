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
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  enterCropMode,
  exitCropMode,
  getCropTarget,
  getCropTargetKey,
} from './cropMode'
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
  })

  it('shows spread properties for the active spread, Esc returns to empty', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setActiveSpreadId('spread-1')
    })
    const panel = screen.getByTestId('inspector-panel')
    expect(panel.getAttribute('data-inspector-view')).toBe('spread')
    expect(screen.getByText('Spread properties')).toBeTruthy()
    expect(screen.getByText('Frames')).toBeTruthy()
    expect(screen.getByTestId('inspector-empty').textContent).toBe(
      'Select a frame to edit it.',
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel.getAttribute('data-inspector-view')).toBe('empty')
  })

  it('shows photo identity for a selected frame', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('frame')
    expect(screen.getByText('Used')).toBeTruthy()
  })

  it('collapses through the header button', () => {
    const onCollapse = vi.fn()
    render(<Inspector onCollapse={onCollapse} />)
    const btn = screen.getByTestId('panel-collapse-right')
    expect(btn.getAttribute('aria-label')).toBe('Hide inspector (I)')
    fireEvent.click(btn)
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('lists Frame / Spread / Book tabs in order with Frame selected', () => {
    render(<Inspector />)
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Frame', 'Spread', 'Book'])
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ])
  })

  it('keeps the Frame tab with a hint when nothing is selected', () => {
    seed()
    render(<Inspector />)
    expect(screen.getByTestId('inspector-tab-frame')).toBeTruthy()
    expect(screen.getByTestId('inspector-empty')).toBeTruthy()
  })

  it('switches tabs on click and shows each tab content', () => {
    seed()
    act(() => {
      setActiveSpreadId('spread-1')
    })
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-spread'))
    expect(screen.getByTestId('grid-section-spread')).toBeTruthy()
    fireEvent.click(screen.getByTestId('inspector-tab-book'))
    expect(screen.getByTestId('grid-section-book')).toBeTruthy()
  })

  it('selecting a frame jumps to the Frame tab; a spread keeps the tab', () => {
    seed()
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-book'))
    act(() => {
      setActiveSpreadId('spread-1')
    })
    expect(screen.getByTestId('grid-section-book')).toBeTruthy()
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(screen.getByTestId('inspector-fit-crop')).toBeTruthy()
    expect(
      screen.getByTestId('inspector-tab-frame').getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('crop mode jumps to the Frame tab', () => {
    seed()
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-book'))
    act(() => {
      enterCropMode('spread-1', 'frame-1')
    })
    expect(
      screen.getByTestId('inspector-tab-frame').getAttribute('aria-selected'),
    ).toBe('true')
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

  it('names an empty frame and counts uses of a placed photo', () => {
    seedBook(
      makeBook({
        assets: { a: {} },
        gallery: ['a'],
        spreads: [
          makeSpread({
            id: 'spread-1',
            frames: [
              makeFrame({ id: 'frame-1', assetId: 'a' }),
              makeFrame({ id: 'frame-2' }),
            ],
          }),
        ],
      }),
    )
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-2' })
    })
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.queryByText('Used')).toBeNull()

    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    expect(screen.getByText('Used').nextElementSibling?.textContent).toBe('1×')
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
    expect(getCropTarget()).toBeNull()

    fireEvent.click(toggle)
    expect(getCropTarget()).toMatchObject({
      spreadId: 'spread-1',
      frameId: 'frame-1',
    })
    expect(screen.getByTestId('crop-toggle').textContent).toBe('Done')

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
