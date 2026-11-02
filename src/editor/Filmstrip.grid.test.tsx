import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import { resetBookStore } from './bookStore'
import { resetCameraStore } from './cameraStore'
import { clearDropHover } from './dropHover'
import { Filmstrip } from './Filmstrip'
import { FILMSTRIP_THUMB_HEIGHT } from './filmstripSize'
import {
  resetFilmstripGridFocus,
  setFilmstripAnchor,
} from './filmstripGridFocus'
import { seedGallery } from './gallery.test-helpers'
import {
  getSelectedAssetIds,
  resetGallerySelection,
  setSelectedAssetIds,
} from './gallerySelection'
import { resetThumbCache } from './thumbCache'
import { buildStridePrefix } from './thumbSlotSize'

/** Row renders per asset id (each row render reads its focus once). */
const rowRenders = vi.hoisted(() => new Map<string, number>())

vi.mock('./filmstripGridFocus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./filmstripGridFocus')>()
  return {
    ...actual,
    getFilmstripRowFocus: (id: string) => {
      rowRenders.set(id, (rowRenders.get(id) ?? 0) + 1)
      return actual.getFilmstripRowFocus(id)
    },
  }
})

function rows(): HTMLElement[] {
  return screen.getAllByRole('row')
}

function row(id: string): HTMLElement {
  const match = rows().find((item) => item.dataset.assetId === id)
  if (match === undefined) {
    throw new Error(`row ${id} not mounted`)
  }
  return match
}

function stubScrollportWidth(width: number): () => void {
  const own = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientWidth',
  )
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).getAttribute('data-testid') ===
        'filmstrip-scroll'
        ? width
        : 0
    },
  })
  return () => {
    if (own === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
    } else {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', own)
    }
  }
}

/** Runs queued rAF callbacks inside `act` (the window commits on rAF). */
function captureFrames(): { flush: () => void; restore: () => void } {
  const callbacks: FrameRequestCallback[] = []
  const previous = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    callbacks.push(cb)
    return callbacks.length
  }
  return {
    flush: () => {
      act(() => {
        for (const cb of callbacks.splice(0, callbacks.length)) {
          cb(0)
        }
      })
    },
    restore: () => {
      globalThis.requestAnimationFrame = previous
    },
  }
}

function scrollTo(scroll: HTMLElement, left: number): void {
  act(() => {
    Object.defineProperty(scroll, 'scrollLeft', {
      configurable: true,
      value: left,
      writable: true,
    })
    scroll.dispatchEvent(new Event('scroll'))
  })
}

describe('Filmstrip grid', () => {
  afterEach(() => {
    cleanup()
    clearDropHover()
    resetCameraStore()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
    resetGallerySelection()
    resetFilmstripGridFocus()
    rowRenders.clear()
  })

  it('exposes a multiselectable grid of named rows', () => {
    seedGallery(3, 1.5, 'photo.jpg')
    setSelectedAssetIds(['seed-1'])
    render(<Filmstrip />)

    const grid = screen.getByRole('grid', { name: 'Book gallery' })
    expect(grid.getAttribute('aria-multiselectable')).toBe('true')
    expect(grid.tabIndex).toBe(0)
    expect(rows().map((item) => item.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(row('seed-1').dataset.selected).toBe('true')
    expect(rows().map((item) => item.tabIndex)).toEqual([-1, -1, -1])
  })

  it('replaces on click, toggles on Ctrl / Meta click, ranges on Shift click', () => {
    seedGallery(4)
    render(<Filmstrip />)

    fireEvent.click(row('seed-1'))
    expect(getSelectedAssetIds()).toEqual(['seed-1'])

    fireEvent.click(row('seed-3'), { shiftKey: true })
    expect(getSelectedAssetIds()).toEqual(['seed-1', 'seed-2', 'seed-3'])

    fireEvent.click(row('seed-2'), { ctrlKey: true })
    expect(getSelectedAssetIds()).toEqual(['seed-1', 'seed-3'])

    fireEvent.click(row('seed-3'), { metaKey: true })
    expect(getSelectedAssetIds()).toEqual(['seed-1'])

    fireEvent.click(row('seed-0'))
    expect(getSelectedAssetIds()).toEqual(['seed-0'])
  })

  it('ignores clicks on the grid outside any row', () => {
    seedGallery(2)
    setSelectedAssetIds(['seed-0'])
    render(<Filmstrip />)

    fireEvent.click(screen.getByRole('grid'))

    expect(getSelectedAssetIds()).toEqual(['seed-0'])
  })

  it('hands grid focus to the selected row and makes it the tab stop', () => {
    seedGallery(3)
    setSelectedAssetIds(['seed-2'])
    render(<Filmstrip />)

    act(() => {
      screen.getByRole('grid').focus()
    })

    expect(document.activeElement).toBe(row('seed-2'))
    expect(row('seed-2').tabIndex).toBe(0)
    expect(row('seed-2').dataset.focused).toBe('true')
    expect(screen.getByRole('grid').tabIndex).toBe(-1)

    act(() => {
      row('seed-2').blur()
    })
    expect(row('seed-2').dataset.focused).toBeUndefined()
    expect(row('seed-2').tabIndex).toBe(0)
  })

  it('moves focus and selection with arrows; Shift extends, Ctrl only moves focus', () => {
    seedGallery(4)
    render(<Filmstrip />)
    act(() => {
      row('seed-0').focus()
    })

    fireEvent.keyDown(row('seed-0'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(row('seed-1'))
    expect(getSelectedAssetIds()).toEqual(['seed-1'])

    fireEvent.keyDown(row('seed-1'), { key: 'ArrowRight', shiftKey: true })
    expect(document.activeElement).toBe(row('seed-2'))
    expect(getSelectedAssetIds()).toEqual(['seed-1', 'seed-2'])

    fireEvent.keyDown(row('seed-2'), { key: 'ArrowRight', ctrlKey: true })
    expect(document.activeElement).toBe(row('seed-3'))
    expect(getSelectedAssetIds()).toEqual(['seed-1', 'seed-2'])

    fireEvent.keyDown(row('seed-3'), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(row('seed-2'))
    expect(getSelectedAssetIds()).toEqual(['seed-2'])
  })

  it('jumps to the ends with Home / End and selects all with Ctrl+A', () => {
    seedGallery(4)
    render(<Filmstrip />)
    act(() => {
      row('seed-1').focus()
    })

    fireEvent.keyDown(row('seed-1'), { key: 'End' })
    expect(document.activeElement).toBe(row('seed-3'))
    expect(getSelectedAssetIds()).toEqual(['seed-3'])

    fireEvent.keyDown(row('seed-3'), { key: 'Home' })
    expect(document.activeElement).toBe(row('seed-0'))
    expect(getSelectedAssetIds()).toEqual(['seed-0'])

    fireEvent.keyDown(row('seed-0'), { key: 'a', ctrlKey: true })
    expect(getSelectedAssetIds()).toEqual([
      'seed-0',
      'seed-1',
      'seed-2',
      'seed-3',
    ])
  })

  it('replaces the selection with the first row when Tab enters a grid without a selected row', () => {
    seedGallery(3)
    setSelectedAssetIds(['off-strip'])
    setFilmstripAnchor('seed-2')
    render(<Filmstrip />)

    act(() => {
      screen.getByRole('grid').focus()
    })

    expect(getSelectedAssetIds()).toEqual(['seed-0'])
    expect(document.activeElement).toBe(row('seed-0'))
  })

  it('leaves other keys alone; Escape still clears the selection', () => {
    seedGallery(2)
    setSelectedAssetIds(['seed-0'])
    render(<Filmstrip />)
    act(() => {
      row('seed-0').focus()
    })

    expect(fireEvent.keyDown(row('seed-0'), { key: 'x' })).toBe(true)
    expect(getSelectedAssetIds()).toEqual(['seed-0'])

    fireEvent.keyDown(row('seed-0'), { key: 'Escape' })
    expect(getSelectedAssetIds()).toEqual([])
    expect(document.activeElement).toBe(row('seed-0'))
  })

  it('selects the focused row on Space and toggles it on Ctrl / Meta+Space', () => {
    seedGallery(3)
    render(<Filmstrip />)
    act(() => {
      row('seed-0').focus()
    })

    expect(fireEvent.keyDown(row('seed-0'), { key: ' ' })).toBe(false)
    expect(getSelectedAssetIds()).toEqual(['seed-0'])

    fireEvent.keyDown(row('seed-0'), { key: 'ArrowRight', ctrlKey: true })
    fireEvent.keyDown(row('seed-1'), { key: ' ', ctrlKey: true })
    expect(getSelectedAssetIds()).toEqual(['seed-0', 'seed-1'])

    fireEvent.keyDown(row('seed-1'), { key: ' ', metaKey: true })
    expect(getSelectedAssetIds()).toEqual(['seed-0'])

    fireEvent.keyDown(row('seed-1'), { key: 'ArrowRight', ctrlKey: true })
    // The last toggle anchored at seed-1.
    fireEvent.keyDown(row('seed-2'), { key: ' ', shiftKey: true })
    expect(getSelectedAssetIds()).toEqual(['seed-1', 'seed-2'])
  })

  it('ignores Space on the grid before any row had focus', () => {
    seedGallery(2)
    setSelectedAssetIds(['seed-1'])
    render(<Filmstrip />)

    fireEvent.keyDown(screen.getByRole('grid'), { key: ' ' })

    expect(getSelectedAssetIds()).toEqual(['seed-1'])
  })

  it('starts a remounted strip without the old roving row', () => {
    seedGallery(2)
    const first = render(<Filmstrip />)
    act(() => {
      row('seed-1').focus()
    })
    first.unmount()

    render(<Filmstrip />)

    expect(screen.getByRole('grid').tabIndex).toBe(0)
    expect(rows().map((item) => item.tabIndex)).toEqual([-1, -1])
  })

  it('End past the window scrolls to the last row and focuses it on mount', () => {
    const restoreWidth = stubScrollportWidth(1000)
    const frames = captureFrames()
    try {
      seedGallery(60, 0.5)
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      act(() => {
        row('seed-0').focus()
      })

      fireEvent.keyDown(row('seed-0'), { key: 'End' })
      expect(rows().map((item) => item.dataset.assetId)).not.toContain(
        'seed-59',
      )
      expect(getSelectedAssetIds()).toEqual(['seed-59'])

      const prefix = buildStridePrefix(
        Array.from({ length: 60 }, () => 0.5),
        FILMSTRIP_THUMB_HEIGHT,
      )
      expect(scroll.scrollLeft).toBe((prefix[60] ?? 0) - 1000)
      const focus = vi.spyOn(HTMLElement.prototype, 'focus')
      scrollTo(scroll, scroll.scrollLeft)
      frames.flush()

      expect(document.activeElement).toBe(row('seed-59'))
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
      focus.mockRestore()
    } finally {
      frames.restore()
      restoreWidth()
    }
  })

  it('prefers the roving row over the selection when the grid takes focus', () => {
    seedGallery(3)
    render(<Filmstrip />)
    act(() => {
      row('seed-0').focus()
    })
    act(() => {
      row('seed-0').blur()
    })
    setSelectedAssetIds(['seed-2'])

    act(() => {
      screen.getByRole('grid').focus()
    })

    expect(document.activeElement).toBe(row('seed-0'))
  })

  it('marks a keyboard (focus-visible) row and leaves a pointer focus plain', () => {
    seedGallery(2)
    render(<Filmstrip />)
    // Rows read `:focus-visible` on themselves; stub it per row.
    vi.spyOn(row('seed-0'), 'matches').mockReturnValue(false)
    vi.spyOn(row('seed-1'), 'matches').mockReturnValue(true)

    act(() => {
      row('seed-0').focus()
    })
    expect(row('seed-0').dataset.focused).toBe('true')
    expect(row('seed-0').dataset.focusVisible).toBeUndefined()

    act(() => {
      row('seed-1').focus()
    })
    expect(row('seed-1').dataset.focusVisible).toBe('true')
    expect(row('seed-0').dataset.focused).toBeUndefined()
  })

  it('reads a row as not focus-visible when the selector is unsupported', () => {
    seedGallery(1)
    render(<Filmstrip />)
    vi.spyOn(row('seed-0'), 'matches').mockImplementation((selector) => {
      if (selector === ':focus-visible') {
        throw new SyntaxError('unsupported selector')
      }
      return false
    })

    act(() => {
      row('seed-0').focus()
    })

    expect(row('seed-0').dataset.focused).toBe('true')
    expect(row('seed-0').dataset.focusVisible).toBeUndefined()
  })

  it('navigates from the roving row when a key reaches the grid itself', () => {
    seedGallery(3)
    render(<Filmstrip />)
    act(() => {
      row('seed-1').focus()
    })

    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowRight' })

    expect(document.activeElement).toBe(row('seed-2'))
    expect(getSelectedAssetIds()).toEqual(['seed-2'])
  })

  it('drops a stale anchor once the selection is cleared', () => {
    seedGallery(4)
    render(<Filmstrip />)
    fireEvent.click(row('seed-1'))
    setSelectedAssetIds([])

    fireEvent.click(row('seed-3'), { shiftKey: true })

    expect(getSelectedAssetIds()).toEqual(['seed-3'])
  })

  it('consumes grid keys and focuses rows without native scroll', () => {
    seedGallery(3)
    render(<Filmstrip />)
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    try {
      act(() => {
        row('seed-0').focus()
      })

      expect(fireEvent.keyDown(row('seed-0'), { key: 'ArrowRight' })).toBe(
        false,
      )
      expect(
        fireEvent.keyDown(row('seed-1'), { key: 'a', metaKey: true }),
      ).toBe(false)
      expect(fireEvent.keyDown(row('seed-1'), { key: ' ' })).toBe(false)

      expect(outer).not.toHaveBeenCalled()
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true })
    } finally {
      focus.mockRestore()
      document.removeEventListener('keydown', outer)
    }
  })

  it('scrolls only for rows outside the scrollport', () => {
    const restoreWidth = stubScrollportWidth(1000)
    const frames = captureFrames()
    try {
      seedGallery(60, 0.5)
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const prefix = buildStridePrefix(
        Array.from({ length: 60 }, () => 0.5),
        FILMSTRIP_THUMB_HEIGHT,
      )
      act(() => {
        row('seed-0').focus()
      })

      fireEvent.keyDown(row('seed-0'), { key: 'ArrowRight' })
      expect(scroll.scrollLeft).toBe(0)

      scrollTo(scroll, prefix[20] ?? 0)
      frames.flush()
      act(() => {
        row('seed-21').focus()
      })
      fireEvent.keyDown(row('seed-21'), { key: 'ArrowRight' })
      expect(scroll.scrollLeft).toBe(prefix[20])

      fireEvent.keyDown(row('seed-22'), { key: 'Home' })
      expect(scroll.scrollLeft).toBe(0)
      expect(getSelectedAssetIds()).toEqual(['seed-0'])
    } finally {
      frames.restore()
      restoreWidth()
    }
  })

  it('hands the tab stop back to the grid when the roving row leaves the window', () => {
    const restoreWidth = stubScrollportWidth(1000)
    const frames = captureFrames()
    try {
      seedGallery(60, 0.5)
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const prefix = buildStridePrefix(
        Array.from({ length: 60 }, () => 0.5),
        FILMSTRIP_THUMB_HEIGHT,
      )
      act(() => {
        row('seed-0').focus()
      })
      act(() => {
        row('seed-0').blur()
      })
      expect(screen.getByRole('grid').tabIndex).toBe(-1)

      scrollTo(scroll, prefix[40] ?? 0)
      frames.flush()

      expect(rows().map((item) => item.dataset.assetId)).not.toContain('seed-0')
      expect(screen.getByRole('grid').tabIndex).toBe(0)
    } finally {
      frames.restore()
      restoreWidth()
    }
  })

  it('a window shift renders only the rows that enter it', () => {
    const restoreWidth = stubScrollportWidth(1000)
    const frames = captureFrames()
    try {
      seedGallery(60, 0.5)
      setSelectedAssetIds(['seed-1'])
      render(<Filmstrip />)
      const scroll = screen.getByTestId('filmstrip-scroll')
      const before = new Set(rows().map((item) => item.dataset.assetId))
      const prefix = buildStridePrefix(
        Array.from({ length: 60 }, () => 0.5),
        FILMSTRIP_THUMB_HEIGHT,
      )
      rowRenders.clear()

      scrollTo(scroll, prefix[4] ?? 0)
      frames.flush()

      const after = rows().map((item) => item.dataset.assetId ?? '')
      const entering = after.filter((id) => !before.has(id))
      const staying = after.filter((id) => before.has(id))
      expect(entering.length).toBeGreaterThan(0)
      expect(staying.length).toBeGreaterThan(0)
      expect(staying.filter((id) => rowRenders.has(id))).toEqual([])
      expect(entering.every((id) => rowRenders.has(id))).toBe(true)
    } finally {
      frames.restore()
      restoreWidth()
    }
  })
})
