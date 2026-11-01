import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { BookSettingsSection } from './BookSettingsSection'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getSpreadPaintSnapshot,
  resetBookStore,
} from './bookStore'
import { setBookSettingsSelected } from './bookSettingsSelection'
import { CoverSection } from './CoverSection'
import { setCoverSelected } from './coverSelection'
import { EndpaperCanvas } from './EndpaperCanvas'
import { EndpaperOverlay } from './EndpaperOverlay'
import { EndpaperRow } from './EndpaperRow'
import { EndpaperSection } from './EndpaperSection'
import { setEndpaperSelected } from './endpaperSelection'
import { setFrameSource, resetFrameSelection } from './frameSelection'
import { FrameStyleSection } from './FrameLookSections'
import { Inspector } from './Inspector'
import { InspectorSlider, Swatches } from './InspectorControls'
import { SpreadsPanel } from './SpreadsPanel'
import { ASSET_DRAG_MIME } from './dropTargets'

vi.mock('./useThumbUrl', () => ({
  useThumbUrl: (assetId: string | undefined) =>
    assetId === undefined ? undefined : `blob:${assetId}`,
}))

const SUB_INK = 'text-muted-foreground'

function seed(trim = { widthMm: 200, heightMm: 300 }, pageColor?: string) {
  resetBookStore({
    book: makeBook({
      settings: {
        trim,
        ...(pageColor === undefined ? {} : { pageColor }),
      },
      assets: { a1: {} },
      gallery: ['a1'],
      spreads: [
        makeSpread({
          id: 's1',
          frames: [makeFrame({ id: 'f1', assetId: 'a1' })],
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const trim = () => getBookStoreSnapshot().book.settings.trim

afterEach(() => {
  cleanup()
  setCoverSelected(false)
  setBookSettingsSelected(false)
  resetFrameSelection()
  resetBookStore()
})

describe('BookSettingsSection controls', () => {
  it('shows portrait and landscape and swaps only when different', () => {
    seed({ widthMm: 200, heightMm: 300 })
    render(<BookSettingsSection />)
    const portrait = screen.getByLabelText('Portrait')
    const landscape = screen.getByLabelText('Landscape')
    expect((portrait as HTMLInputElement).checked).toBe(true)
    expect((landscape as HTMLInputElement).checked).toBe(false)
    const before = getBookStoreSnapshot().book
    fireEvent.click(portrait)
    expect(getBookStoreSnapshot().book).toBe(before)
    fireEvent.click(landscape)
    expect(trim()).toEqual({ widthMm: 300, heightMm: 200 })
    expect(screen.getByLabelText<HTMLInputElement>('Landscape').checked).toBe(
      true,
    )
    fireEvent.click(screen.getByLabelText('Portrait'))
    expect(trim()).toEqual({ widthMm: 200, heightMm: 300 })
  })

  it('treats a square page as portrait', () => {
    seed({ widthMm: 250, heightMm: 250 })
    render(<BookSettingsSection />)
    expect(screen.getByLabelText<HTMLInputElement>('Portrait').checked).toBe(
      true,
    )
  })

  it('reads cm by default with the kit step and range, and mm on switch', () => {
    seed({ widthMm: 123.4, heightMm: 300 })
    render(<BookSettingsSection />)
    const width = screen.getByTestId<HTMLInputElement>('size-w')
    expect(width.value).toBe('12.3')
    expect(width.step).toBe('0.1')
    expect(width.min).toBe('5')
    expect(width.max).toBe('50')
    expect(width.getAttribute('aria-label')).toBe('Width (cm)')
    expect(screen.getByTestId<HTMLInputElement>('size-h').value).toBe('30')
    expect(screen.getByTestId('size-h').getAttribute('aria-label')).toBe(
      'Height (cm)',
    )
    fireEvent.click(screen.getByLabelText('mm'))
    expect(width.value).toBe('123.4')
    expect(width.step).toBe('1')
    expect(width.min).toBe('50')
    expect(width.max).toBe('500')
    expect(width.getAttribute('aria-label')).toBe('Width (mm)')
    fireEvent.click(screen.getByLabelText('cm'))
    expect(width.value).toBe('12.3')
  })

  it('applies a typed cm size to the right axis only', () => {
    seed({ widthMm: 200, heightMm: 300 })
    render(<BookSettingsSection />)
    fireEvent.change(screen.getByTestId('size-w'), { target: { value: '21' } })
    expect(trim()).toEqual({ widthMm: 210, heightMm: 300 })
    fireEvent.change(screen.getByTestId('size-h'), {
      target: { value: '29.7' },
    })
    expect(trim()).toEqual({ widthMm: 210, heightMm: 297 })
  })

  it('accepts exactly the limits and rejects outside them (mm)', () => {
    seed({ widthMm: 200, heightMm: 300 })
    render(<BookSettingsSection />)
    fireEvent.click(screen.getByLabelText('mm'))
    const width = screen.getByTestId('size-w')
    fireEvent.change(width, { target: { value: '500' } })
    expect(trim().widthMm).toBe(500)
    fireEvent.change(width, { target: { value: '501' } })
    expect(trim().widthMm).toBe(500)
    fireEvent.change(width, { target: { value: '50' } })
    expect(trim().widthMm).toBe(50)
    fireEvent.change(width, { target: { value: '49' } })
    expect(trim().widthMm).toBe(50)
    fireEvent.change(width, { target: { value: '' } })
    expect(trim().widthMm).toBe(50)
    expect(trim().heightMm).toBe(300)
  })

  it('keeps the typed text while editing and snaps back on blur', () => {
    seed({ widthMm: 200, heightMm: 300 })
    render(<BookSettingsSection />)
    const width = screen.getByTestId<HTMLInputElement>('size-w')
    fireEvent.change(width, { target: { value: '2' } })
    expect(width.value).toBe('2')
    expect(trim().widthMm).toBe(200)
    fireEvent.blur(width)
    expect(width.value).toBe('20')
  })

  it('shows page colour as read-only text, no swatches (uikit/src/sandbox/v7.tsx:201)', () => {
    seed({ widthMm: 200, heightMm: 300 })
    render(<BookSettingsSection />)
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(screen.getByTestId('page-colour-readonly').textContent).toBe(
      'Paper white · coming later',
    )
  })

  it('dims hints, labels and units with the muted ink', () => {
    seed()
    render(<BookSettingsSection />)
    expect(screen.getByText('read-only').className).toContain(SUB_INK)
    expect(screen.getByText(/Size of one page/).className).toContain(SUB_INK)
    expect(screen.getByText('W').className).toContain(SUB_INK)
    expect(screen.getAllByText('cm')[1]?.className).toContain(SUB_INK)
  })

  it('switch reflects and writes the endpapers setting', () => {
    seed()
    render(<BookSettingsSection />)
    const toggle = screen.getByRole('switch', { name: 'Endpapers' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(getBookStoreSnapshot().book.settings.endpapers.enabled).toBe(false)
  })
})

describe('InspectorControls', () => {
  it('Swatches ring only the selected option and paint their colour', () => {
    const onChange = vi.fn()
    render(
      <Swatches
        label="Fill"
        value="#111111"
        onChange={onChange}
        options={[
          { value: '#111111', name: 'Ink' },
          { value: '#eeeeee', name: 'Mist' },
        ]}
      />,
    )
    expect(screen.getByLabelText('Ink').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByLabelText('Mist').getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(screen.getByLabelText('Mist').style.background).toBe('#eeeeee')
    fireEvent.click(screen.getByLabelText('Mist'))
    expect(onChange).toHaveBeenCalledWith('#eeeeee')
  })

  it('slider shows the unit, fills to the thumb and resets on double click', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InspectorSlider
        label="Mat"
        value={5}
        min={0}
        max={10}
        unit="millimeter"
        onChange={onChange}
      />,
    )
    expect(container.querySelector('output')?.textContent).toBe('5 mm')
    const fill = container.querySelector<HTMLElement>('.fit-crop-fill')
    expect(fill?.style.width).toBe('50%')
    fireEvent.doubleClick(
      container.querySelectorAll('.fit-crop-track')[0] ?? container,
    )
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('slider without a unit shows the bare number', () => {
    const { container } = render(
      <InspectorSlider
        label="X"
        value={5}
        min={0}
        max={10}
        onChange={vi.fn()}
      />,
    )
    expect(container.querySelector('output')?.textContent).toBe('5')
  })
})

describe('CoverSection spine and direction', () => {
  it('shows the spine width computed from the page count as read-only mm text (rendered #/demo step 13)', () => {
    seed()
    // The stored width is legacy: the inspector ignores it.
    dispatchBookOp({ type: 'setCoverStyle', patch: { spineWidthMm: 20.5 } })
    render(<CoverSection />)
    const spine = screen.getByTestId('cover-spine-width')
    expect(spine.textContent).toBe('12 mm')
    expect(spine.className).toBe('font-mono text-sm tabular-nums')
    expect(within(spine).queryByRole('slider')).toBeNull()
    expect(within(spine).queryByRole('spinbutton')).toBeNull()
    act(() => {
      dispatchBookOp({ type: 'setPageCount', pages: 42 })
    })
    expect(spine.textContent).toBe('16.4 mm')
  })

  it('shows the direction as a read-only pill (uikit/src/sandbox/v7.tsx:215)', () => {
    seed()
    const { rerender } = render(<CoverSection />)
    expect(screen.getByTestId('cover-direction').textContent).toBe(
      'Top to bottom',
    )
    act(() => {
      dispatchBookOp({
        type: 'setCoverStyle',
        patch: { spineDirection: 'bottom-to-top' },
      })
    })
    rerender(<CoverSection />)
    expect(screen.getByTestId('cover-direction').textContent).toBe(
      'Bottom to top',
    )
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('shows the style from the book', () => {
    seed()
    dispatchBookOp({ type: 'setCoverStyle', patch: { titleFont: 'serif' } })
    render(<CoverSection />)
    expect(
      screen.getByTestId<HTMLSelectElement>('cover-title-font').value,
    ).toBe('serif')
  })
})

describe('Endpaper pieces', () => {
  it('canvas sizes to two pages and paints the photo', () => {
    seed({ widthMm: 300, heightMm: 200 })
    dispatchBookOp({ type: 'setEndpaperPhoto', side: 'front', assetId: 'a1' })
    render(<EndpaperCanvas side="front" />)
    const canvas = screen.getByTestId('canvas-endpaper')
    expect(canvas.style.aspectRatio).toBe('3 / 1')
    const pages = canvas.querySelectorAll<HTMLElement>('.endpaper-page')
    expect(pages).toHaveLength(2)
    for (const page of pages) {
      expect(page.style.backgroundImage).toContain('blob:a1')
    }
  })

  it('canvas paints the plain pattern without a photo', () => {
    seed()
    render(<EndpaperCanvas side="back" />)
    for (const page of screen
      .getByTestId('canvas-endpaper')
      .querySelectorAll<HTMLElement>('.endpaper-page')) {
      expect(page.style.backgroundImage).toBe('')
    }
    expect(document.querySelector('.endpaper-caption')?.textContent).toBe(
      'Endpaper',
    )
  })

  it('drop: ignores an empty payload, takes an asset and stops the browser', () => {
    seed()
    render(<EndpaperCanvas side="front" />)
    const canvas = screen.getByTestId('canvas-endpaper')
    const drop = (id: string) => {
      const event = new Event('drop', { bubbles: true, cancelable: true })
      Object.assign(event, {
        dataTransfer: {
          getData: (type: string) => (type === ASSET_DRAG_MIME ? id : ''),
        },
      })
      act(() => {
        canvas.dispatchEvent(event)
      })
      return event.defaultPrevented
    }
    expect(drop('')).toBe(false)
    expect(getBookStoreSnapshot().book.endpapers.front.assetId).toBeUndefined()
    expect(drop('a1')).toBe(true)
    expect(getBookStoreSnapshot().book.endpapers.front.assetId).toBe('a1')
  })

  it('overlay shows the selected side and nothing otherwise', () => {
    seed()
    render(<EndpaperOverlay />)
    expect(screen.queryByTestId('canvas-endpaper')).toBeNull()
    act(() => {
      setEndpaperSelected('back')
    })
    expect(
      screen.getByTestId('canvas-endpaper').getAttribute('data-side'),
    ).toBe('back')
    act(() => {
      setEndpaperSelected(null)
    })
    expect(screen.queryByTestId('canvas-endpaper')).toBeNull()
  })

  it('row leaves the cover selection when picked', () => {
    seed()
    setCoverSelected(true)
    render(<EndpaperRow side="front" />)
    fireEvent.click(screen.getByTestId('endpaper-list-item-front'))
    act(() => {
      setEndpaperSelected(null)
    })
    cleanup()
    setCoverSelected(true)
    render(<EndpaperRow side="front" />)
    fireEvent.click(screen.getByTestId('endpaper-list-item-front'))
    expect(
      screen
        .getByTestId('endpaper-list-item-front')
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('section: photo fill shows Photo, its image and the muted hints', () => {
    seed()
    render(<EndpaperSection side="front" />)
    expect(
      screen.getByText('Pastedown and free leaf, printed full bleed').className,
    ).toContain(SUB_INK)
    // Kit v7.tsx:218-221 has no "Drag a photo" hint.
    expect(screen.queryByText(/Drag a photo/)).toBeNull()
    expect(screen.getByTestId('endp-fill-readonly').textContent).toBe(
      'coming later',
    )
    expect(screen.getByTestId('endpaper-fill').style.backgroundImage).toBe('')
    act(() => {
      dispatchBookOp({ type: 'setEndpaperPhoto', side: 'front', assetId: 'a1' })
    })
    expect(screen.getAllByText('Photo')).toHaveLength(2)
    expect(screen.queryByText('Pattern')).toBeNull()
    expect(screen.getByTestId('endpaper-fill').style.backgroundImage).toContain(
      'blob:a1',
    )
  })
})

describe('Inspector endpaper context', () => {
  it('shows the endpaper section and beats a selected frame', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource({ spreadId: 's1', frameId: 'f1' })
    })
    expect(screen.getByTestId('inspector-fit-crop')).toBeTruthy()
    act(() => {
      setEndpaperSelected('front')
    })
    expect(screen.getByTestId('insp-endpaper')).toBeTruthy()
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
    expect(
      screen.getByTestId('inspector-panel').getAttribute('data-inspector-view'),
    ).toBe('endpaper')
    act(() => {
      setBookSettingsSelected(true)
    })
    expect(screen.getByTestId('insp-endpaper')).toBeTruthy()
    act(() => {
      setEndpaperSelected(null)
    })
    expect(screen.queryByTestId('insp-endpaper')).toBeNull()
  })
})

describe('SpreadsPanel endpaper rows', () => {
  it('shows both rows while endpapers are on and none when off', () => {
    seed()
    render(<SpreadsPanel />)
    expect(screen.getByTestId('endpaper-list-item-front')).toBeTruthy()
    expect(screen.getByTestId('endpaper-list-item-back')).toBeTruthy()
    act(() => {
      dispatchBookOp({ type: 'setEndpapersEnabled', enabled: false })
    })
    expect(screen.queryByTestId('endpaper-list-item-front')).toBeNull()
    expect(screen.queryByTestId('endpaper-list-item-back')).toBeNull()
  })

  it('selecting an endpaper unselects the spread and the cover', () => {
    seed()
    render(<SpreadsPanel />)
    fireEvent.click(screen.getByTestId('endpaper-list-item-back'))
    expect(
      screen
        .getByTestId('endpaper-list-item-back')
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen.getByTestId('cover-list-item').getAttribute('aria-pressed'),
    ).toBe('false')
    for (const option of screen.queryAllByRole('option')) {
      expect(option.getAttribute('aria-selected')).toBe('false')
    }
    fireEvent.click(screen.getByTestId('cover-list-item'))
    expect(
      screen
        .getByTestId('endpaper-list-item-back')
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })
})

describe('FrameStyleSection chips', () => {
  const target = { spreadId: 's1', frameId: 'f1' }
  const shadow = (id: string) =>
    within(screen.getByTestId(id)).getByText('', {
      selector: '.frame-style-chip-thumb',
    })

  it('previews the preset rings, corner and the lone drop shadow', () => {
    seed()
    render(<FrameStyleSection target={target} />)
    const thumb = (id: string) =>
      screen
        .getByTestId(id)
        .querySelector<HTMLElement>('.frame-style-chip-thumb')
    expect(thumb('style-none')?.style.boxShadow).toBe(
      '0 1px 3px rgb(0 0 0 / 0.2)',
    )
    expect(thumb('style-white-mat')?.style.boxShadow).toBe(
      '0 0 0 3px #ffffff, 0 1px 3px rgb(0 0 0 / 0.2)',
    )
    expect(thumb('style-hairline')?.style.boxShadow).toBe(
      '0 0 0 1px #1c1b1a, 0 1px 3px rgb(0 0 0 / 0.2)',
    )
    expect(thumb('style-soft-corners')?.style.borderRadius).toBe('4px')
    expect(thumb('style-none')?.style.borderRadius).toBe('0px')
    expect(shadow).toBeTypeOf('function')
  })

  it('draws a mat, then a stroke outside it, in their own colours', () => {
    seed()
    dispatchBookOp({ type: 'applyFrameStyle', ...target, styleId: 'hairline' })
    dispatchBookOp({
      type: 'editFrameStyle',
      styleId: 'hairline',
      patch: {
        matMm: 2,
        matColor: '#aabbcc',
        strokeMm: 1.5,
        strokeColor: '#112233',
      },
    })
    render(<FrameStyleSection target={target} />)
    expect(
      screen
        .getByTestId('style-hairline')
        .querySelector<HTMLElement>('.frame-style-chip-thumb')?.style.boxShadow,
    ).toBe('0 0 0 2px #aabbcc, 0 0 0 5px #112233, 0 1px 3px rgb(0 0 0 / 0.2)')
  })

  it('marks only the current style, lists custom ones once and counts users', () => {
    seed()
    dispatchBookOp({ type: 'newFrameStyle', ...target })
    render(<FrameStyleSection target={target} />)
    const pressed = screen
      .getAllByRole('button', { pressed: true })
      .map((el) => el.getAttribute('data-testid'))
    expect(pressed).toEqual(['style-style-1'])
    expect(screen.getAllByTestId('style-white-mat')).toHaveLength(1)
    expect(screen.getAllByTestId('style-style-1')).toHaveLength(1)
    expect(screen.getByTestId('style-uses').className).toContain(SUB_INK)
    expect(screen.getByTestId('style-uses').textContent).toContain('Style 1')
    expect(screen.getByTestId('style-uses').textContent).toContain('1 frames')
  })

  it('counts only frames that use the style', () => {
    resetBookStore({
      book: makeBook({
        assets: { a1: {} },
        gallery: ['a1'],
        spreads: [
          makeSpread({
            id: 's1',
            frames: [
              makeFrame({ id: 'f1', assetId: 'a1' }),
              makeFrame({ id: 'f2', assetId: 'a1' }),
              makeFrame({ id: 'f3', assetId: 'a1' }),
            ],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    dispatchBookOp({ type: 'applyFrameStyle', ...target, styleId: 'white-mat' })
    dispatchBookOp({
      type: 'applyFrameStyle',
      spreadId: 's1',
      frameId: 'f2',
      styleId: 'white-mat',
    })
    render(<FrameStyleSection target={target} />)
    expect(screen.getByTestId('style-uses').textContent).toContain('2')
  })

  it('writes mat and stroke from the sliders, rounding stroke to 0.1', () => {
    seed()
    dispatchBookOp({ type: 'applyFrameStyle', ...target, styleId: 'hairline' })
    render(<FrameStyleSection target={target} />)
    const slide = (id: string, value: string) => {
      fireEvent.change(within(screen.getByTestId(id)).getByRole('slider'), {
        target: { value },
      })
    }
    slide('style-mat', '4.5')
    slide('style-stroke', '1.3')
    const style = getBookStoreSnapshot().book.frameStyles.hairline
    expect(style).toMatchObject({ matMm: 4.5, strokeMm: 1.3 })
    expect(
      screen.getByTestId('style-mat').querySelector('output')?.textContent,
    ).toBe('4.5 mm')
    expect(
      screen.getByTestId('style-stroke').querySelector('output')?.textContent,
    ).toBe('1.3 mm')
  })

  it('hides for a text frame', () => {
    resetBookStore({
      book: makeBook({
        spreads: [
          makeSpread({
            id: 's1',
            frames: [makeFrame({ id: 'f1', kind: 'text' })],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<FrameStyleSection target={target} />)
    expect(screen.queryByTestId('frame-style')).toBeNull()
  })

  it('looks up the frame on the right spread', () => {
    resetBookStore({
      book: makeBook({
        assets: { a1: {} },
        gallery: ['a1'],
        spreads: [
          makeSpread({
            id: 's0',
            frames: [makeFrame({ id: 'f1', kind: 'text' })],
          }),
          makeSpread({
            id: 's1',
            frames: [makeFrame({ id: 'f1', assetId: 'a1' })],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<FrameStyleSection target={target} />)
    expect(screen.getByTestId('frame-style')).toBeTruthy()
  })
})

describe('book store defaults and paint key', () => {
  it('a new session book has endpapers on and "same" on', () => {
    resetBookStore()
    expect(getBookStoreSnapshot().book.settings.endpapers).toEqual({
      enabled: true,
      same: true,
    })
  })

  it('repaints a spread when its frame style is edited', () => {
    seed()
    dispatchBookOp({
      type: 'applyFrameStyle',
      spreadId: 's1',
      frameId: 'f1',
      styleId: 'white-mat',
    })
    const mat = () =>
      getSpreadPaintSnapshot('s1')?.resolved.items[0]?.style?.matMm
    expect(mat()).toBe(3)
    dispatchBookOp({
      type: 'editFrameStyle',
      styleId: 'white-mat',
      patch: { matMm: 6 },
    })
    expect(mat()).toBe(6)
  })

  it('repaints a spread when the page colour changes', () => {
    seed()
    const colour = () => getSpreadPaintSnapshot('s1')?.resolved.backgroundColor
    expect(colour()).toBeUndefined()
    dispatchBookOp({ type: 'setPageColor', color: '#f4f1ea' })
    expect(colour()).toBe('#f4f1ea')
  })
})
