import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { roomSlides } from '../siteModel'
import { bookInput } from '../siteRoom.test-helpers'
import type { RenderSlide, RoomBook } from '../SiteSlide'
import { Paper, Slides, type SlidesApi, type SlidesProps } from './slides'

// The carousel on its own: `alps` (21 slides), pages 360 × 450 at a 376 px
// pitch on a 400 px wide strip.

function roomBook(renderSlide?: RenderSlide, id = 'alps'): RoomBook {
  const { book, images, entry } = bookInput(id)
  return { book, images, entry, renderSlide }
}
const RB = roomBook()
const SLIDES = roomSlides(RB.book)
const N = SLIDES.length
const PITCH = 376

let scrolls: ScrollToOptions[] = []

/** The props; `start` opens with its view current, as the room does. */
function props(over: Partial<SlidesProps> = {}): SlidesProps {
  const start = Math.min(N - 1, over.start ?? 0)
  return {
    view: SLIDES[start]?.view ?? 0,
    rb: RB,
    slides: SLIDES,
    w: 400,
    top: 60,
    pw: 360,
    ph: 450,
    setView: vi.fn(),
    si: start,
    onSi: vi.fn(),
    onRest: vi.fn(),
    start,
    title: 'Alps',
    keys: true,
    ...over,
  }
}

function mount(over: Partial<SlidesProps> = {}) {
  const p = props(over)
  const ref = createRef<SlidesApi>()
  const r = render(<Slides ref={ref} {...p} />)
  return {
    p,
    ref,
    rerender: (more: Partial<SlidesProps>) => {
      r.rerender(<Slides ref={ref} {...p} {...more} />)
    },
  }
}

function media(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduced-motion'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  scrolls = []
  media(false)
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(
    (o?: ScrollToOptions | number) => {
      if (typeof o === 'object') scrolls.push(o)
    },
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(20, 0, 400, 450),
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const strip = () => screen.getByTestId('ps-strip')
const slideEls = () => screen.getAllByTestId('ps-slide')
const key = (k: string) => {
  act(() => {
    fireEvent.keyDown(window, { key: k })
  })
}
const last = () => scrolls.at(-1)
function scrollTo(left: number) {
  act(() => {
    strip().scrollLeft = left
    fireEvent.scroll(strip())
  })
}

describe('Slides', () => {
  it('is a labelled carousel of labelled slides, centred in the strip', () => {
    mount()
    expect(strip().getAttribute('role')).toBe('region')
    expect(strip().getAttribute('aria-roledescription')).toBe('carousel')
    expect(strip().getAttribute('aria-label')).toBe('Alps')
    expect(strip().tabIndex).toBe(0)
    expect(strip().style.cssText).toBe(
      'top: 60px; height: 450px; padding-inline: 12px;',
    )
    expect(slideEls()).toHaveLength(N)
    const [first, second] = slideEls()
    expect(first?.style.width).toBe('376px')
    expect(first?.getAttribute('role')).toBe('group')
    expect(first?.getAttribute('aria-roledescription')).toBe('slide')
    expect(first?.getAttribute('aria-label')).toBe(SLIDES[0]?.label)
    expect(first?.dataset.kind).toBe('cover')
    expect(second?.getAttribute('aria-label')).toBe('Page 1 of 20')
    expect(second?.dataset.kind).toBe('page')
  })

  it('paints only the slides within two of the live one', () => {
    mount({ si: 5 })
    const painted = slideEls().map(
      (el) => el.querySelector('[data-testid="ps-paper"]')?.childElementCount,
    )
    expect(painted.map((c) => (c ?? 0) > 0)).toStrictEqual(
      SLIDES.map((_, i) => i >= 3 && i <= 7),
    )
  })

  it('opens at the start slide at once and reports it', () => {
    const { p } = mount({ start: 4 })
    expect(scrolls).toStrictEqual([{ left: 4 * PITCH, behavior: 'instant' }])
    expect(p.onSi).toHaveBeenCalledExactlyOnceWith(4)
    expect(p.onRest).toHaveBeenCalledExactlyOnceWith(4)
  })

  it('opens a start past the end at the last slide', () => {
    const { p } = mount({ start: 99 })
    expect(last()).toStrictEqual({ left: (N - 1) * PITCH, behavior: 'instant' })
    expect(p.onSi).toHaveBeenCalledWith(N - 1)
  })

  it('stays on its slide across a resize', () => {
    const { rerender } = mount({ start: 3 })
    rerender({ pw: 300 })
    expect(last()).toStrictEqual({ left: 3 * 316, behavior: 'instant' })
  })

  it('steps smoothly with the keys, stacking steps before the strip rests', () => {
    mount()
    key('ArrowRight')
    expect(last()).toStrictEqual({ left: PITCH, behavior: 'smooth' })
    key('ArrowRight')
    expect(last()).toStrictEqual({ left: 2 * PITCH, behavior: 'smooth' })
    key('ArrowLeft')
    expect(last()).toStrictEqual({ left: PITCH, behavior: 'smooth' })
    key('End')
    expect(last()).toStrictEqual({ left: (N - 1) * PITCH, behavior: 'smooth' })
    key('Home')
    expect(last()).toStrictEqual({ left: 0, behavior: 'smooth' })
  })

  it('stays put at either end', () => {
    mount()
    const before = scrolls.length
    key('ArrowLeft')
    expect(scrolls).toHaveLength(before)
    cleanup()
    scrolls = []
    mount({ start: N - 1 })
    key('ArrowRight')
    expect(scrolls).toHaveLength(1)
  })

  it('jumps without motion under reduced motion', () => {
    media(true)
    mount()
    key('ArrowRight')
    expect(last()?.behavior).toBe('instant')
    key('End')
    expect(last()).toStrictEqual({ left: (N - 1) * PITCH, behavior: 'instant' })
  })

  it('leaves the keys alone when off, and to a field', () => {
    const { rerender } = mount({ keys: false })
    key('ArrowRight')
    expect(scrolls).toHaveLength(1)
    rerender({ keys: true })
    const ev = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      cancelable: true,
    })
    act(() => {
      window.dispatchEvent(ev)
    })
    expect(ev.defaultPrevented).toBe(false)
    const right = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      cancelable: true,
    })
    act(() => {
      window.dispatchEvent(right)
    })
    expect(right.defaultPrevented).toBe(true)
  })

  it('jumps from the outside within the strip, at once', () => {
    const { ref } = mount()
    act(() => {
      ref.current?.jump(7)
    })
    expect(last()).toStrictEqual({ left: 7 * PITCH, behavior: 'instant' })
    act(() => {
      ref.current?.jump(99)
    })
    expect(last()).toStrictEqual({ left: (N - 1) * PITCH, behavior: 'instant' })
    act(() => {
      ref.current?.jump(-2)
    })
    expect(last()).toStrictEqual({ left: 0, behavior: 'instant' })
    act(() => {
      ref.current?.go(2)
    })
    expect(last()).toStrictEqual({ left: 2 * PITCH, behavior: 'smooth' })
  })

  it('follows a view set from outside, not its own', () => {
    const { p, rerender } = mount()
    const i = SLIDES.findIndex((s) => s.view === 5)
    rerender({ view: 5 })
    expect(last()).toStrictEqual({ left: i * PITCH, behavior: 'instant' })
    expect(p.onSi).toHaveBeenLastCalledWith(i)
    expect(p.onRest).toHaveBeenLastCalledWith(i)
    const count = scrolls.length
    rerender({ view: 5, si: i })
    expect(scrolls).toHaveLength(count)
  })

  it('tracks the scroll live and hands the view over at rest', () => {
    vi.useFakeTimers()
    const { p } = mount()
    vi.mocked(p.onSi).mockClear()
    scrollTo(PITCH * 0.4)
    expect(strip().dataset.scroll).toBe('move')
    expect(p.onSi).not.toHaveBeenCalled()
    scrollTo(PITCH * 2.6)
    expect(p.onSi).toHaveBeenCalledExactlyOnceWith(3)
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(p.onRest).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(strip().dataset.scroll).toBe('rest')
    expect(p.onRest).toHaveBeenLastCalledWith(3)
    expect(p.setView).toHaveBeenCalledExactlyOnceWith(SLIDES[3]?.view)
    // a rest on a slide of the same view does not set it again
    act(() => {
      fireEvent(strip(), new Event('scrollend'))
    })
    expect(p.onRest).toHaveBeenCalledTimes(3)
    expect(p.setView).toHaveBeenCalledTimes(1)
  })

  it('steps after a rest from the slide it came to', () => {
    vi.useFakeTimers()
    mount()
    key('ArrowRight')
    scrollTo(PITCH)
    act(() => {
      fireEvent(strip(), new Event('scrollend'))
    })
    key('ArrowRight')
    expect(last()).toStrictEqual({ left: 2 * PITCH, behavior: 'smooth' })
  })

  it('turns on a tap: back on the left half, on at the right', () => {
    mount({ start: 3 })
    const tap = (x: number, dx = 0) => {
      fireEvent.pointerDown(strip(), { clientX: x, clientY: 200 })
      fireEvent.pointerUp(strip(), { clientX: x + dx, clientY: 200 })
    }
    tap(219)
    expect(last()).toStrictEqual({ left: 2 * PITCH, behavior: 'smooth' })
    tap(220)
    expect(last()).toStrictEqual({ left: 3 * PITCH, behavior: 'smooth' })
    const count = scrolls.length
    tap(300, 20)
    fireEvent.pointerUp(strip(), { clientX: 300, clientY: 200 })
    fireEvent.pointerDown(strip(), { clientX: 300, clientY: 200 })
    fireEvent.pointerCancel(strip())
    fireEvent.pointerUp(strip(), { clientX: 300, clientY: 200 })
    expect(scrolls).toHaveLength(count)
  })
})

// `lake` (210 mm square): spread 2 is a panorama, one slide 360 × 180.
describe('Paper', () => {
  const LAKE = roomBook(undefined, 'lake')
  const pano = {
    view: 2,
    label: 'Pages 4–5',
    page: { spread: 2, side: 'both' },
  } as const
  const paper = (i: number, { on = true, sheet = false, rb = RB } = {}) => {
    const s = i < 0 ? pano : SLIDES[i]
    if (s === undefined) throw new Error(`no slide ${String(i)}`)
    render(<Paper rb={rb} s={s} pw={360} ph={450} on={on} sheet={sheet} />)
    return screen.getByTestId('ps-paper')
  }
  const spreadAt = -1

  it('is blank when off', () => {
    expect(paper(1, { on: false }).childElementCount).toBe(0)
  })

  it('shows the cover face on the cover slide', () => {
    expect(paper(0).querySelector('.sb-cover')).not.toBeNull()
  })

  it('shows a page under the paper grain', () => {
    const el = paper(1)
    expect(el.querySelector('.spread-frame')).not.toBeNull()
    expect(el.querySelectorAll('[aria-hidden]')).toHaveLength(2)
  })

  it('centres a whole spread on the sheet of the page turn', () => {
    const el = paper(spreadAt, { sheet: true, rb: LAKE })
    expect(el.style.height).toBe('450px')
    const art = el.querySelector<HTMLElement>('[data-testid="pt-art"]')
    expect(art?.style.cssText).toBe(
      'position: absolute; left: 0px; top: 135px;',
    )
    expect(art?.querySelector('.spread-frame')).not.toBeNull()
  })

  it('lays a whole spread flat in the carousel at its own height', () => {
    const el = paper(spreadAt, { rb: LAKE })
    expect(el.style.top).toBe('135px')
    expect(el.style.height).toBe('180px')
    expect(el.querySelector('[data-testid="pt-art"]')).toBeNull()
    expect(el.querySelector('.spread-frame')).not.toBeNull()
  })

  it('paints with the host renderer: a spread at the page width, a page at two', () => {
    const renderSlide = vi.fn((s: number, w: number) => (
      <i data-testid="host">{`${String(s)}@${String(w)}`}</i>
    ))
    const host = (el: HTMLElement) =>
      el.querySelector('[data-testid="host"]')?.textContent
    expect(host(paper(spreadAt, { rb: roomBook(renderSlide, 'lake') }))).toBe(
      '3@360',
    )
    cleanup()
    expect(host(paper(1, { rb: roomBook(renderSlide) }))).toBe('1@720')
  })
})
