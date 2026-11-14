import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import SitePreview, { PreviewSlide } from './SitePreview'
import { resetSiteSettingsForTests, setSiteSettings } from './siteSettingsStore'

const book = makeBook({
  title: 'Lake trip',
  spreads: ['s0', 's1', 's2'].map((id) => makeSpread({ id })),
})

function load(): void {
  resetBookStore({
    book,
    sessionMeta: new Map(),
    previewUrls: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

/** Scroll box `w` × `h` (1440 × 852) under a window too short for any stage. */
function stubLayout(w = 1440, h = 852): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(w)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.dataset.testid === 'site-room' ? h : 100
    },
  )
}

function press(key: string): void {
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    )
  })
}

const indicator = () => screen.getByTestId('site-label').textContent

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {
        return undefined
      }
      disconnect() {
        return undefined
      }
    },
  )
  load()
})

afterEach(() => {
  cleanup()
  resetBookStore()
  resetSiteSettingsForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SitePreview', () => {
  it('renders the unpublished reading room of the live book', () => {
    stubLayout()
    render(<SitePreview onExit={vi.fn()} />)
    const scroll = screen.getByTestId('site-preview-scroll')
    expect(scroll.style.minHeight).toBe('0')
    const room = screen.getByTestId('site-room')
    expect(room.hasAttribute('data-embedded')).toBe(true)
    expect(screen.getByTestId('site-about').textContent).toMatch(/^Lake trip/)
    // No author, no site title: the head name is the "Photobooks" fallback.
    expect(screen.getByTestId('site-name').textContent).toBe('Photobooks')
    expect(screen.getByTestId('site-name').tagName).toBe('SPAN')
    expect(screen.queryByTestId('site-all-books')).toBeNull()
    expect(screen.queryByTestId('site-share')).toBeNull()
    // Nothing in the room links away.
    expect(room.querySelector('a')).toBeNull()
    expect(screen.getByTestId('site-fullscreen-btn')).toBeTruthy()
    // The live book's own renderers: the CSS reader, never GL.
    expect(screen.queryByTestId('ps-reader-gl')).toBeNull()
    expect(indicator()).toBe('Cover')
  })

  it.each([
    ['portrait', 390, 796],
    ['landscape', 844, 342],
  ])('a %s box heads the room with the plain book name', (_, w, h) => {
    stubLayout(w, h)
    render(<SitePreview onExit={vi.fn()} />)
    const head = screen.getByText('Lake trip', { selector: '.sb-back' })
    expect(head.tagName).toBe('SPAN')
    expect(screen.getByTestId('site-room').querySelector('a')).toBeNull()
  })

  it('heads the room with the author, else the site title, live', () => {
    render(<SitePreview onExit={vi.fn()} />)
    const name = () => screen.getByTestId('site-name').textContent
    act(() => {
      setSiteSettings({ title: 'Alps & Sea' })
    })
    expect(name()).toBe('Alps & Sea')
    act(() => {
      setSiteSettings({ author: 'Ann' })
    })
    expect(name()).toBe('Ann')
  })

  it('steps with the keys and follows book edits', () => {
    render(<SitePreview onExit={vi.fn()} />)
    press('ArrowRight')
    expect(indicator()).toBe('Page 1 of 4')
    press('End')
    expect(indicator()).toBe('Back cover')
    act(() => {
      dispatchBookOp({ type: 'setTitle', title: 'Alps' })
    })
    expect(screen.getByTestId('site-about').textContent).toMatch(/^Alps/)
    press('ArrowLeft')
    expect(indicator()).toBe('Page 4 of 4')
    // Removing the shown spread clamps to the new back cover.
    act(() => {
      dispatchBookOp({ type: 'removeSpread', spreadId: 's2' })
    })
    expect(indicator()).toBe('Back cover')
  })

  it('closes on Escape', () => {
    const onExit = vi.fn()
    render(<SitePreview onExit={onExit} />)
    press('Escape')
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('PreviewSlide', () => {
  const live = () => getBookStoreSnapshot().book

  it('paints the cover first', () => {
    const { container } = render(
      <PreviewSlide book={live()} slide={0} widthPx={760} />,
    )
    expect(container.querySelector('.cover-spread')).not.toBeNull()
    expect(screen.queryByTestId('spread-view')).toBeNull()
  })

  it('paints a spread at the slide width with no editor layer', () => {
    render(<PreviewSlide book={live()} slide={2} widthPx={760} />)
    const view = screen.getByTestId('spread-view')
    expect(view.getAttribute('data-spread-id')).toBe('s1')
    expect(view.style.width).toBe('760px')
    expect(screen.queryByTestId('spread-stage')).toBeNull()
  })

  it('paints nothing past the last spread', () => {
    const { container } = render(
      <PreviewSlide book={live()} slide={4} widthPx={760} />,
    )
    expect(container.childElementCount).toBe(0)
  })
})
