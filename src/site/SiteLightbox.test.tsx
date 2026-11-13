import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteLightbox } from './SiteLightbox'
import { bookInput } from './siteRoom.test-helpers'
import type { RenderSlide, RoomBook } from './SiteSlide'

// Fullscreen over the spreads of `alps` (190 × 230 mm, 11 spreads; the first
// and the last are one page): slides are laid out 760 × 460 px.

function roomBook(renderSlide?: RenderSlide): RoomBook {
  const { book, images, entry } = bookInput()
  return { book, images, entry, renderSlide }
}

/** A `w` × 900 window; `hover`: a mouse (side insets 64, else 8). */
function view(w: number, hover = true) {
  vi.stubGlobal('innerWidth', w)
  vi.stubGlobal('innerHeight', 900)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(w)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(900)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(760)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(460)
  vi.stubGlobal('matchMedia', () => ({
    matches: hover,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  view(1440)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.style.overflow = ''
})

/** The active slide's frame (neighbours stay mounted). */
const active = () => {
  const book = screen.getByTestId('site-fullscreen-book')
  const slide = book.querySelector<HTMLElement>('[data-testid="site-lb-slide"]')
  if (slide === null) throw new Error('no slide')
  return slide
}
const place = () => active().firstElementChild as HTMLElement
const sizes = () =>
  [...active().querySelectorAll('img')].map((img) => img.getAttribute('sizes'))

describe('SiteLightbox', () => {
  it('names the dialog after the book and shows the spread label', () => {
    render(<SiteLightbox rb={roomBook()} start={3} onClose={() => undefined} />)
    expect(screen.getByTestId('lightbox').getAttribute('aria-label')).toBe(
      'Alps — fullscreen',
    )
    expect(screen.getByTestId('site-fullscreen-indicator').textContent).toBe(
      'Pages 6–7 of 20',
    )
  })

  it('lays a two-page spread across the whole slide on the endpaper', () => {
    const rb = roomBook()
    render(<SiteLightbox rb={rb} start={3} onClose={() => undefined} />)
    expect(active().dataset.side).toBeUndefined()
    expect(active().style.width).toBe('760px')
    expect(active().style.height).toBe('460px')
    expect(active().style.position).toBe('relative')
    expect(active().style.background).toBe(rb.entry.endpaper)
    expect(place().style.cssText).toBe(
      'position: absolute; top: 0px; width: 760px; height: 460px; overflow: hidden; right: 0px;',
    )
  })

  it('puts a one-page spread on its side of the endpaper', () => {
    render(<SiteLightbox rb={roomBook()} start={0} onClose={() => undefined} />)
    expect(active().dataset.side).toBe('right')
    expect(place().style.width).toBe('380px')
    expect(place().style.right).toBe('0px')
    expect(place().style.left).toBe('')
    act(() => {
      fireEvent.keyDown(window, { key: 'End' })
    })
    expect(active().dataset.side).toBe('left')
    expect(place().style.width).toBe('380px')
    expect(place().style.left).toBe('0px')
    expect(place().style.right).toBe('')
  })

  // Spread 0's photo is 0.4206 of the spread; 800 px wide: fitted 672 (mouse) / 784 (touch).
  it('asks for photos at the fitted spread width, wider with a touch inset', () => {
    view(800)
    render(<SiteLightbox rb={roomBook()} start={0} onClose={() => undefined} />)
    expect(sizes()).toStrictEqual(['283px'])
    cleanup()
    view(800, false)
    render(<SiteLightbox rb={roomBook()} start={0} onClose={() => undefined} />)
    expect(sizes()).toStrictEqual(['330px'])
  })

  it('asks for bigger photos after a zoom in, never smaller after zooming out', () => {
    vi.useFakeTimers()
    view(800)
    render(<SiteLightbox rb={roomBook()} start={0} onClose={() => undefined} />)
    fireEvent.keyDown(window, { key: '+' })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(sizes()).toStrictEqual(['424px'])
    fireEvent.keyDown(window, { key: '-' })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(sizes()).toStrictEqual(['424px'])
  })

  it('paints with the host renderer at the slide width when given one', () => {
    const renderSlide = vi.fn((slide: number, w: number) => (
      <i data-testid="host">{`${String(slide)}@${String(w)}`}</i>
    ))
    render(
      <SiteLightbox
        rb={roomBook(renderSlide)}
        start={2}
        onClose={() => undefined}
      />,
    )
    expect(active().querySelector('[data-testid="host"]')?.textContent).toBe(
      '3@760',
    )
  })

  it('locks the page scroll while open and hands the slide back on close', () => {
    document.documentElement.style.overflow = 'auto'
    const onClose = vi.fn()
    const { unmount } = render(
      <SiteLightbox rb={roomBook()} start={2} onClose={onClose} />,
    )
    expect(document.documentElement.style.overflow).toBe('hidden')
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalledExactlyOnceWith(3)
    unmount()
    expect(document.documentElement.style.overflow).toBe('auto')
  })
})
