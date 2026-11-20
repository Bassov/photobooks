import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultCover } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { CoverView } from './CoverView'

function coverBook() {
  const cover = defaultCover('Lake trip')
  return makeBook({
    cover: { ...cover, front: { ...cover.front, assetId: 'a1' } },
  })
}

/** The fitted sheet's on-screen box (makeBook: 300 mm trim, sheet 642 × 330 mm). */
function stubSheetRect(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  })
}

describe('CoverView', () => {
  beforeEach(() => {
    // jsdom has no DragEvent: without it fireEvent drops clientX.
    vi.stubGlobal('DragEvent', class extends MouseEvent {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('hands the title its Title font face (coverTitleFace) as CSS vars', () => {
    const book = coverBook()
    const sans = {
      ...book,
      cover: {
        ...book.cover,
        style: { ...book.cover.style, titleFont: 'sans' as const },
      },
    }
    const vars = (b: typeof book) => {
      cleanup()
      const { container } = render(<CoverView book={b} />)
      const el = container.querySelector<HTMLElement>('.cover-spread')
      return [
        el?.dataset.titleFont,
        el?.style.getPropertyValue('--cover-title-family'),
        el?.style.getPropertyValue('--cover-title-style'),
      ]
    }

    expect(vars(book)).toStrictEqual([
      'serif-italic',
      '"Lora Cover", "Lora Variable", Lora, serif',
      'italic',
    ])
    expect(vars(sans)).toStrictEqual([
      'sans',
      'var(--font-sans, sans-serif)',
      'normal',
    ])
  })

  it('paints the mini cover without editor chrome at the parent width', () => {
    const { container } = render(
      <CoverView book={coverBook()} frontUrl="a1-2000.jpg" frontTier={2048} />,
    )

    const spread = container.querySelector<HTMLElement>('.cover-spread')
    expect(spread?.dataset.mini).toBe('true')
    expect(spread?.style.width).toBe('100%')
    expect(spread?.style.aspectRatio.replace(/\s/g, '')).toBe('612/300')
    expect(spread?.style.getPropertyValue('--spine-frac')).toBe(
      String(12 / 612),
    )
    expect(container.querySelector('[data-testid]')).toBeNull()
    expect(container.querySelector('.cover-panel-label')).toBeNull()
    expect(container.querySelector('.cover-sheet')).toBeNull()
    expect(container.querySelector('.cover-wrap-chip')).toBeNull()
    const front = container.querySelector<HTMLElement>('.cover-front')
    expect(front?.dataset.photoId).toBe('a1')
    expect(front?.dataset.tier).toBe('2048')
    // D4: the photo box runs 15 mm past the top, bottom and outer edge.
    const photo = container.querySelector<HTMLElement>('.cover-front-photo')
    expect(photo?.style.backgroundImage).toBe('url("a1-2000.jpg")')
    expect(Number.parseFloat(photo?.style.top ?? '')).toBeCloseTo(-5, 9)
    expect(Number.parseFloat(photo?.style.bottom ?? '')).toBeCloseTo(-5, 9)
    expect(Number.parseFloat(photo?.style.right ?? '')).toBeCloseTo(-5, 9)
    expect(container.querySelector('.cover-spine-text')?.textContent).toBe(
      'Lake trip',
    )
  })

  it('anchors the front photo where the print places it (coverPhotoAnchor)', () => {
    const book = coverBook()
    const { container, rerender } = render(
      <CoverView book={book} frontUrl="a1.jpg" />,
    )
    const photo = () =>
      container.querySelector<HTMLElement>('.cover-front-photo')
    expect(photo()?.style.backgroundPosition).toBe('45% 50%')

    const crop = { zoom: 1, center: { x: 0.25, y: 0.75 } }
    const front = { ...book.cover.front, crop }
    rerender(
      <CoverView
        book={{ ...book, cover: { ...book.cover, front } }}
        frontUrl="a1.jpg"
      />,
    )
    expect(photo()?.style.backgroundPosition).toBe('25% 75%')
  })

  it('sizes the mini cover to widthPx and paints an empty front as cloth', () => {
    const book = makeBook()
    const { container } = render(<CoverView book={book} widthPx={480} />)

    const spread = container.querySelector<HTMLElement>('.cover-spread')
    expect(spread?.style.width).toBe('480px')
    expect(container.querySelector('.cover-front-photo')).toBeNull()
    expect(container.querySelector('.cover-front-drop')).toBeNull()
    const front = container.querySelector<HTMLElement>('.cover-front')
    expect(front?.hasAttribute('data-tier')).toBe(false)
    // Designer P1: the cloth, D38 ink on it (the default cloth is dark).
    expect(book.cover.style.backFill).toBe('#3e3c3b')
    expect(front?.style.backgroundColor).toBe('#3e3c3b')
    expect(front?.style.getPropertyValue('--cover-title-ink')).toBe('#F5F5F5')
    expect(front?.style.getPropertyValue('--cover-title-shadow')).toBe('none')
  })

  it('inks a light empty front dark and leaves a photo front unpainted', () => {
    const book = makeBook()
    const light = {
      ...book,
      cover: {
        ...book.cover,
        style: { ...book.cover.style, backFill: '#E8E6E3' },
      },
    }
    const { container, rerender } = render(<CoverView book={light} />)
    const front = () => container.querySelector<HTMLElement>('.cover-front')
    expect(front()?.style.getPropertyValue('--cover-title-ink')).toBe('#2E2C2D')

    rerender(<CoverView book={light} frontUrl="a1.jpg" />)
    expect(front()?.style.backgroundColor).toBe('')
    expect(front()?.style.getPropertyValue('--cover-title-ink')).toBe('')
  })

  it('gives the editor empty front its drop box, not a photo front', () => {
    stubSheetRect(642, 330)
    const edit = { onDragOver: vi.fn(), onDrop: vi.fn() }
    const { rerender } = render(<CoverView book={coverBook()} edit={edit} />)

    expect(screen.getByTestId('cover-front-drop').textContent).toBe(
      'Drop a photo for the front',
    )
    // Designer P1: the sheet is the cloth, no grey front half.
    expect(screen.getByTestId('cover-sheet').style.background).toBe('#3e3c3b')

    rerender(<CoverView book={coverBook()} frontUrl="a1.jpg" edit={edit} />)
    expect(screen.queryByTestId('cover-front-drop')).toBeNull()
  })

  it('draws the sheet layers and the chip while the band is tall enough', () => {
    stubSheetRect(642, 330)
    render(
      <CoverView
        book={coverBook()}
        edit={{ onDragOver: vi.fn(), onDrop: vi.fn() }}
      />,
    )

    expect(screen.getByTestId('cover-stage')).toBeTruthy()
    const sheet = screen.getByTestId('cover-sheet')
    expect(sheet.style.aspectRatio.replace(/\s/g, '')).toBe('642/330')
    const spread = screen.getByTestId('canvas-cover')
    expect(spread.hasAttribute('data-mini')).toBe(false)
    expect(Number.parseFloat(spread.style.left)).toBeCloseTo(
      (15 / 642) * 100,
      9,
    )
    expect(Number.parseFloat(spread.style.height)).toBeCloseTo(
      (300 / 330) * 100,
      9,
    )
    expect(screen.getByTestId('cover-label-back').textContent).toBe('Back')
    expect(screen.getByTestId('cover-label-spine').textContent).toBe('Spine')
    expect(screen.getByTestId('cover-label-front').textContent).toBe('Front')
    for (const id of [
      'cover-hinge-back',
      'cover-hinge-front',
      'cover-safe-back',
      'cover-safe-front',
    ]) {
      expect(screen.getByTestId(id).style.width).not.toBe('')
    }
    expect(screen.getByTestId('cover-wrap').getAttribute('aria-hidden')).toBe(
      'true',
    )
    expect(screen.getByTestId('cover-wrap').children).toHaveLength(4)
    // Band 330 px × 15 / 330 = 15 px < 18: no chip.
    expect(screen.queryByTestId('cover-wrap-chip')).toBeNull()
    cleanup()

    stubSheetRect(1284, 660)
    render(
      <CoverView
        book={coverBook()}
        edit={{ onDragOver: vi.fn(), onDrop: vi.fn() }}
      />,
    )
    const chip = screen.getByTestId('cover-wrap-chip')
    expect(chip.textContent).toBe('Wrap 15 mm')
    // Band 30 px: the 14 px line centred in it.
    expect(chip.style.top).toBe('8px')
  })

  it('takes drops over the front board and its band only', () => {
    stubSheetRect(642, 330)
    const onDragOver = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    const onDrop = vi.fn()
    render(<CoverView book={coverBook()} edit={{ onDragOver, onDrop }} />)
    const sheet = screen.getByTestId('cover-sheet')

    // Front board starts at 15 + 300 + 12 = 327 mm = 327 px.
    fireEvent.dragOver(sheet, { clientX: 200 })
    fireEvent.drop(sheet, { clientX: 320 })
    expect(onDragOver).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
    expect(sheet.hasAttribute('data-drop-target')).toBe(false)

    fireEvent.dragOver(sheet, { clientX: 635 })
    expect(onDragOver).toHaveBeenCalledTimes(1)
    expect(sheet.dataset.dropTarget).toBe('true')
    fireEvent.dragLeave(sheet, { relatedTarget: document.body })
    expect(sheet.hasAttribute('data-drop-target')).toBe(false)
    fireEvent.dragOver(sheet, { clientX: 400 })
    fireEvent.drop(sheet, { clientX: 400 })
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(sheet.hasAttribute('data-drop-target')).toBe(false)
  })

  it('starts at the front board edge and outlines only accepted drags', () => {
    stubSheetRect(642, 330)
    const onDragOver = vi.fn()
    const onDrop = vi.fn()
    render(<CoverView book={coverBook()} edit={{ onDragOver, onDrop }} />)
    const sheet = screen.getByTestId('cover-sheet')
    expect(sheet.hasAttribute('data-drop-target')).toBe(false)

    // A foreign drag over the front: the handler runs but does not accept.
    fireEvent.dragOver(sheet, { clientX: 327 })
    expect(onDragOver).toHaveBeenCalledTimes(1)
    expect(sheet.hasAttribute('data-drop-target')).toBe(false)
    fireEvent.drop(sheet, { clientX: 327 })
    expect(onDrop).toHaveBeenCalledTimes(1)
  })

  it('keeps the outline while the drag moves onto a child', () => {
    stubSheetRect(642, 330)
    const onDragOver = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    render(
      <CoverView book={coverBook()} edit={{ onDragOver, onDrop: vi.fn() }} />,
    )
    const sheet = screen.getByTestId('cover-sheet')
    fireEvent.dragOver(sheet, { clientX: 500 })
    fireEvent.dragLeave(sheet, {
      relatedTarget: screen.getByTestId('cover-front'),
    })
    expect(sheet.dataset.dropTarget).toBe('true')
  })

  it('veils exactly the band with four strips', () => {
    stubSheetRect(642, 330)
    render(
      <CoverView
        book={coverBook()}
        edit={{ onDragOver: vi.fn(), onDrop: vi.fn() }}
      />,
    )
    const strips = [
      ...screen
        .getByTestId('cover-wrap')
        .querySelectorAll<HTMLElement>('.cover-wrap-strip'),
    ].map(({ style }) => ({
      left: style.left,
      right: style.right,
      top: style.top,
      bottom: style.bottom,
      width: Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
    }))
    const y = (15 / 330) * 100
    const x = (15 / 642) * 100
    expect(strips).toEqual([
      { left: '0px', right: '', top: '0px', bottom: '', width: 100, height: y },
      { left: '0px', right: '', top: '', bottom: '0px', width: 100, height: y },
      {
        left: '0px',
        right: '',
        top: `${String(y)}%`,
        bottom: '',
        width: x,
        height: 100 - 2 * y,
      },
      {
        left: '',
        right: '0px',
        top: `${String(y)}%`,
        bottom: '',
        width: x,
        height: 100 - 2 * y,
      },
    ])
  })

  it('shows the chip from an 18 px band and follows resizes', () => {
    const observers: { fire: () => void; disconnect: () => void }[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect = vi.fn()
        observe = vi.fn()
        constructor(private readonly callback: () => void) {
          // Only an observed sheet reports resizes.
          observers.push({
            fire: () => {
              if (this.observe.mock.calls.length > 0) this.callback()
            },
            disconnect: this.disconnect,
          })
        }
      },
    )
    // 396 px × 15 / 330 = 18 px exactly.
    stubSheetRect(770.4, 396)
    const edit = { onDragOver: vi.fn(), onDrop: vi.fn() }
    const view = render(<CoverView book={coverBook()} edit={edit} />)
    expect(screen.getByTestId('cover-wrap-chip').style.top).toBe('2px')

    stubSheetRect(642, 330)
    act(() => {
      for (const observer of observers) observer.fire()
    })
    expect(screen.queryByTestId('cover-wrap-chip')).toBeNull()

    // A taller trim re-measures on render: 330 px × 15 / 630 is under 18.
    stubSheetRect(1284, 660)
    const tall = makeBook()
    view.rerender(
      <CoverView
        book={{
          ...tall,
          settings: {
            ...tall.settings,
            trim: { ...tall.settings.trim, heightMm: 600 },
          },
        }}
        edit={edit}
      />,
    )
    expect(screen.queryByTestId('cover-wrap-chip')).toBeNull()
    const [first] = observers
    expect(first?.disconnect).toHaveBeenCalled()
    view.unmount()
    expect(observers.at(-1)?.disconnect).toHaveBeenCalled()
  })

  it('measures once without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    stubSheetRect(1284, 660)
    render(
      <CoverView
        book={coverBook()}
        edit={{ onDragOver: vi.fn(), onDrop: vi.fn() }}
      />,
    )
    expect(screen.getByTestId('cover-wrap-chip').textContent).toBe('Wrap 15 mm')
  })
})
