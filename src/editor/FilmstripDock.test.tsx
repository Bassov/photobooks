import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAtInterfaceScale } from '../ui/uiScale.test-helpers'
import { resetBookStore } from './bookStore'
import { seedGallery } from './gallery.test-helpers'
import { FilmstripDock } from './FilmstripDock'
import {
  resetFilmstripThumb,
  setFilmstripThumb,
  THUMB_STORAGE_KEY,
} from './filmstripSize'

describe('FilmstripDock thumb separator', () => {
  const startHeight = window.innerHeight
  let capture = vi.fn()

  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    })
    localStorage.clear()
    resetFilmstripThumb()
    // jsdom has no pointer capture.
    capture = vi.fn()
    Element.prototype.setPointerCapture = capture
  })

  afterEach(() => {
    cleanup()
    resetBookStore()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: startHeight,
    })
  })

  const sep = () => screen.getByRole('separator', { name: 'Resize photos' })
  const dockVar = (name: string) =>
    screen.getByTestId('dock').style.getPropertyValue(name)

  it('exposes the slider range and the auto height', () => {
    render(<FilmstripDock />)
    expect(sep().getAttribute('aria-orientation')).toBe('horizontal')
    expect(sep().getAttribute('aria-valuemin')).toBe('56')
    expect(sep().getAttribute('aria-valuemax')).toBe('240')
    expect(sep().getAttribute('aria-valuenow')).toBe('76')
    expect(sep().tabIndex).toBe(0)
    expect(sep().hasAttribute('data-dragging')).toBe(false)
    expect(screen.queryByTestId('thumb-resizer-chip')).toBeNull()
    expect(dockVar('--film-thumb-h')).toBe('76px')
    expect(dockVar('--film-empty-h')).toBe('76px')
    expect(screen.getByTestId('dock').hasAttribute('data-names')).toBe(false)
  })

  it('turns the file-name strip on from 90 px up', () => {
    render(<FilmstripDock />)
    const names = () => screen.getByTestId('dock').hasAttribute('data-names')
    act(() => {
      setFilmstripThumb(88, false)
    })
    expect(names()).toBe(false)
    act(() => {
      setFilmstripThumb(90, false)
    })
    expect(names()).toBe(true)
  })

  /** Handler errors surface via reportError / console.error, not as throws. */
  function collectHandlerErrors(): () => unknown[] {
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => {
      errors.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', onError)
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args[0])
    })
    return () => {
      window.removeEventListener('error', onError)
      return errors
    }
  }

  it('drags in 4 px steps, shows the chip only while dragging, saves once on release', () => {
    render(<FilmstripDock />)
    const errors = collectHandlerErrors()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    fireEvent.pointerDown(sep(), { button: 2, clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(sep(), { clientY: 400, pointerId: 1 })
    fireEvent.pointerUp(sep(), { clientY: 400, pointerId: 1 })
    expect(sep().getAttribute('aria-valuenow')).toBe('76')
    expect(errors()).toEqual([])
    expect(capture).not.toHaveBeenCalled()
    fireEvent.pointerDown(sep(), { button: 0, clientY: 500, pointerId: 7 })
    expect(capture).toHaveBeenCalledWith(7)
    expect(sep().hasAttribute('data-dragging')).toBe(true)
    expect(screen.getByTestId('thumb-resizer-chip').textContent).toBe('76 px')
    fireEvent.pointerMove(sep(), { clientY: 499, pointerId: 1 })
    expect(sep().getAttribute('aria-valuenow')).toBe('76')
    fireEvent.pointerMove(sep(), { clientY: 448, pointerId: 1 })
    expect(sep().getAttribute('aria-valuenow')).toBe('128')
    expect(screen.getByTestId('thumb-resizer-chip').textContent).toBe('128 px')
    expect(dockVar('--film-thumb-h')).toBe('128px')
    expect(screen.getByTestId('dock').hasAttribute('data-names')).toBe(true)
    expect(setItem).not.toHaveBeenCalled()
    fireEvent.pointerUp(sep(), { clientY: 448, pointerId: 1 })
    expect(screen.queryByTestId('thumb-resizer-chip')).toBeNull()
    expect(sep().hasAttribute('data-dragging')).toBe(false)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('128')
    fireEvent.pointerMove(sep(), { clientY: 300, pointerId: 1 })
    fireEvent.pointerUp(sep(), { clientY: 300, pointerId: 1 })
    expect(sep().getAttribute('aria-valuenow')).toBe('128')
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(errors()).toEqual([])
  })

  it('at interface scale 1.5 moves the separator with the pointer (screen px ÷ s)', () => {
    const restore = runAtInterfaceScale(1.5)
    try {
      setFilmstripThumb(100)
      render(<FilmstripDock />)
      fireEvent.pointerDown(sep(), { button: 0, clientY: 900, pointerId: 1 })
      // 48 screen px up = 32 app px taller.
      fireEvent.pointerMove(sep(), { clientY: 852, pointerId: 1 })
      expect(sep().getAttribute('aria-valuenow')).toBe('132')
      fireEvent.pointerUp(sep(), { clientY: 852, pointerId: 1 })
    } finally {
      restore()
    }
  })

  it('does not write when a drag ends where it started or is cancelled', () => {
    render(<FilmstripDock />)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    fireEvent.pointerDown(sep(), { button: 0, clientY: 500, pointerId: 1 })
    fireEvent.pointerUp(sep(), { clientY: 500, pointerId: 1 })
    fireEvent.pointerDown(sep(), { button: 0, clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(sep(), { clientY: 460, pointerId: 1 })
    fireEvent.pointerCancel(sep(), { pointerId: 1 })
    expect(screen.queryByTestId('thumb-resizer-chip')).toBeNull()
    fireEvent.pointerUp(sep(), { clientY: 460, pointerId: 1 })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('keys ↑/↓ ±8, Home, End, Enter and double-click set and save H', () => {
    const outer = vi.fn()
    render(
      <div onKeyDown={outer}>
        <FilmstripDock />
      </div>,
    )
    const now = () => sep().getAttribute('aria-valuenow')
    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.keyDown(sep(), { key: 'ArrowUp' })).toBe(false)
    expect(now()).toBe('84')
    fireEvent.keyDown(sep(), { key: 'ArrowDown' })
    fireEvent.keyDown(sep(), { key: 'ArrowDown' })
    expect(now()).toBe('68')
    fireEvent.keyDown(sep(), { key: 'End' })
    expect(now()).toBe('240')
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('240')
    fireEvent.keyDown(sep(), { key: 'Home' })
    expect(now()).toBe('56')
    fireEvent.keyDown(sep(), { key: 'Enter' })
    expect(now()).toBe('76')
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('auto')
    expect(outer).not.toHaveBeenCalled()
    expect(fireEvent.keyDown(sep(), { key: 'a' })).toBe(true)
    expect(outer).toHaveBeenCalledTimes(1)
    act(() => {
      setFilmstripThumb(150)
    })
    fireEvent.doubleClick(sep())
    expect(now()).toBe('76')
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('auto')
  })
})

describe('FilmstripDock', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('wraps filmstrip and shows gallery count', () => {
    seedGallery(3)
    render(<FilmstripDock />)
    expect(screen.getByTestId('dock')).toBeTruthy()
    expect(screen.getByTestId('placed-count').textContent).toBe(
      'Photos · 3 · 0 used',
    )
    expect(screen.getByTestId('filmstrip')).toBeTruthy()
  })

  it('uses quiet ghost chips and no outline toggle', () => {
    seedGallery(1)
    render(<FilmstripDock />)
    expect(screen.getByTestId('film-sort').className).toContain('film-chip')
    const toggle = screen.getByTestId('film-unplaced-only')
    expect(toggle.className).toContain('film-chip')
    expect(toggle.className).not.toContain('outline')
  })

  it('omits Add folder without a folder picker handler', () => {
    seedGallery(1)
    render(<FilmstripDock />)
    expect(screen.queryByTestId('film-add-folder')).toBeNull()
  })

  it('shows Add folder and calls the handler on press', () => {
    seedGallery(1)
    const onChoosePhotoFolder = vi.fn(() => Promise.resolve())
    render(<FilmstripDock onChoosePhotoFolder={onChoosePhotoFolder} />)
    fireEvent.click(screen.getByRole('button', { name: /Add folder/ }))
    expect(onChoosePhotoFolder).toHaveBeenCalledTimes(1)
  })
})
