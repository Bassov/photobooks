import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from './sampleSite'
import { SiteApp } from './SiteApp'
import type { SitePageInput } from './siteInput'

type BookInput = Extract<SitePageInput, { kind: 'book' }>

function bookInput(id = 'alps'): BookInput {
  const input = sampleSiteInput(`?book=${id}`)
  if (input.kind !== 'book') throw new Error(`no sample book ${id}`)
  return input
}

function openBook(id = 'alps') {
  return render(<SiteApp input={bookInput(id)} />)
}

const indicator = () => screen.getByTestId('site-page-indicator').textContent

const mountedSlides = () =>
  [...document.querySelectorAll('.site-slide')].map((slide) =>
    slide.getAttribute('data-slide'),
  )

const slideEl = (slide: number) =>
  document.querySelector(`.site-slide[data-slide="${String(slide)}"]`)

beforeEach(() => {
  window.history.replaceState(null, '', '/site.html')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SiteBookPage', () => {
  it('shows the book title, meta and the cover with spread 1 mounted inert', () => {
    openBook()

    expect(screen.getByTestId('site-title').textContent).toBe('Alps')
    expect(screen.getByTestId('site-author').textContent).toBe(
      'by A. Photographer · 20 pages',
    )
    expect(screen.getByTestId('site-all-books').getAttribute('href')).toBe(
      './site.html',
    )
    expect(screen.getByTestId('site-title-link').textContent).toBe(
      'Sample photobooks',
    )
    expect(indicator()).toBe('Cover')
    const slides = [...document.querySelectorAll('.site-slide')]
    expect(
      slides.map((slide) => slide.getAttribute('data-slide')),
    ).toStrictEqual(['0', '1'])
    expect(slides[1]?.hasAttribute('inert')).toBe(true)
    expect(slides[1]?.getAttribute('data-side')).toBe('right')
    expect(screen.getByTestId('site-spread').getAttribute('data-slide')).toBe(
      '0',
    )
  })

  it('steps with the arrow keys, Home and End, and keeps the slide in the hash', () => {
    openBook()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(indicator()).toBe('Page 1 · 1 / 11')
    expect(window.location.hash).toBe('#p1')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(indicator()).toBe('Pages 2–3 · 2 / 11')
    expect(window.location.hash).toBe('#p2')
    fireEvent.keyDown(window, { key: 'End' })
    expect(indicator()).toBe('Page 20 · 11 / 11')
    expect(window.location.hash).toBe('#p20')
    expect(
      document.querySelector('[data-slide="11"]')?.getAttribute('data-side'),
    ).toBe('left')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(indicator()).toBe('Page 20 · 11 / 11')
    fireEvent.keyDown(window, { key: 'Home' })
    expect(indicator()).toBe('Cover')
    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('')
  })

  it('ignores keys with modifiers or while typing', () => {
    openBook()
    const field = document.createElement('input')
    document.body.append(field)

    fireEvent.keyDown(field, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true })
    fireEvent.keyDown(window, { key: 'x' })

    expect(indicator()).toBe('Cover')
    field.remove()
  })

  it('steps with Prev / Next, disabled at the ends', () => {
    openBook('sea')
    const prev = screen.getByRole('button', { name: 'Previous spread' })
    const next = screen.getByRole('button', { name: 'Next spread' })

    expect(prev).toHaveProperty('disabled', true)
    fireEvent.click(next)
    fireEvent.click(next)
    expect(indicator()).toBe('Pages 2–3 · 2 / 4')
    fireEvent.click(prev)
    expect(indicator()).toBe('Page 1 · 1 / 4')
    fireEvent.click(next)
    fireEvent.click(next)
    fireEvent.click(next)
    expect(indicator()).toBe('Page 6 · 4 / 4')
    expect(next).toHaveProperty('disabled', true)
  })

  it('steps on a swipe of more than 60 px, not on a short one', () => {
    openBook()
    const stage = screen.getByTestId('site-stage')
    const swipe = (from: number, to: number) => {
      fireEvent.pointerDown(stage, { clientX: from })
      fireEvent.pointerUp(stage, { clientX: to })
    }

    swipe(300, 250)
    expect(indicator()).toBe('Cover')
    swipe(300, 200)
    expect(indicator()).toBe('Page 1 · 1 / 11')
    swipe(200, 300)
    expect(indicator()).toBe('Cover')
    fireEvent.pointerUp(stage, { clientX: 0 })
    fireEvent.pointerDown(stage, { clientX: 300 })
    fireEvent.pointerCancel(stage)
    fireEvent.pointerUp(stage, { clientX: 0 })
    expect(indicator()).toBe('Cover')
  })

  it('opens the spread holding the page of a #pN deep link, and follows hash edits', () => {
    window.history.replaceState(null, '', '/site.html#p6')
    openBook()

    expect(indicator()).toBe('Pages 6–7 · 4 / 11')
    expect(
      [...document.querySelectorAll('.site-slide')].map((slide) =>
        slide.getAttribute('data-slide'),
      ),
    ).toStrictEqual(['3', '4', '5'])
    window.location.hash = '#p99'
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(indicator()).toBe('Cover')
  })
})

describe('SiteBookPage details', () => {
  it('steps back with ArrowLeft, also from a focused button, and prevents the default', () => {
    openBook()
    fireEvent.keyDown(window, { key: 'End' })

    const prevented = !fireEvent.keyDown(
      screen.getByRole('button', { name: 'Next spread' }),
      { key: 'ArrowLeft' },
    )

    expect(prevented).toBe(true)
    expect(indicator()).toBe('Pages 18–19 · 10 / 11')
    expect(fireEvent.keyDown(window, { key: 'x' })).toBe(true)
  })

  it('touches the URL only when the slide changes', () => {
    openBook()
    const replace = vi.spyOn(window.history, 'replaceState')

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'Home' })

    expect(replace).not.toHaveBeenCalled()
  })

  it('mounts only real neighbours; the last page sits left, interior spreads have no side', () => {
    openBook()

    fireEvent.keyDown(window, { key: 'End' })
    expect(mountedSlides()).toStrictEqual(['10', '11'])
    expect(slideEl(11)?.getAttribute('data-side')).toBe('left')
    expect(slideEl(10)?.hasAttribute('data-side')).toBe(false)
    fireEvent.keyDown(window, { key: 'Home' })
    expect(slideEl(0)?.hasAttribute('data-side')).toBe(false)
  })

  it('loads photos of the first two slides eagerly, later ones lazily', () => {
    openBook()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    const loading = (slide: number) =>
      [...(slideEl(slide)?.querySelectorAll('img') ?? [])].map((img) =>
        img.getAttribute('loading'),
      )
    expect(loading(1)).toStrictEqual(['eager'])
    expect(loading(2)).toStrictEqual(['lazy', 'lazy'])
    expect(slideEl(2)?.querySelector('img')?.getAttribute('sizes')).toContain(
      'min(',
    )
  })

  it('sizes photos by their share of the spread-wide stage, single pages too', () => {
    openBook()
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    const sizes = (slide: number) =>
      [...(slideEl(slide)?.querySelectorAll('img') ?? [])].map((img) =>
        img.getAttribute('sizes'),
      )
    const half =
      '(max-width: 767px) calc((100vw - 40px) * 0.42), min(319px, calc((100vw - 64px) * 0.42))'
    expect(sizes(1)).toStrictEqual([half])
    expect(sizes(2)).toStrictEqual([half, half])
  })

  it('ignores a pointer-up without a pointer-down', () => {
    openBook()
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    fireEvent.pointerUp(screen.getByTestId('site-stage'), { clientX: 400 })

    expect(indicator()).toBe('Page 1 · 1 / 11')
  })

  it('paints a cover whose photo has no derivative', () => {
    const input = bookInput()
    render(
      <SiteApp
        input={{
          ...input,
          book: {
            ...input.book,
            cover: {
              ...input.book.cover,
              front: { ...input.book.cover.front, assetId: 'gone' },
            },
          },
        }}
      />,
    )

    expect(document.querySelector('.cover-spread')).not.toBeNull()
  })

  it('re-reads the hash for another book and stops listening on unmount', () => {
    window.history.replaceState(null, '', '/site.html#p20')
    const view = openBook()
    expect(indicator()).toBe('Page 20 · 11 / 11')
    const remove = vi.spyOn(window, 'removeEventListener')

    view.rerender(<SiteApp input={bookInput('sea')} />)
    expect(indicator()).toBe('Cover')
    view.unmount()

    expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function))
  })

  it('shares the canonical book URL when the site has one', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(
      <SiteApp
        input={{
          ...bookInput(),
          site: { title: 'Alex', url: 'https://alex.example' },
          path: 'books/abc/',
        }}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('site-share'))
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith('https://alex.example/books/abc/')
  })

  it('shares this page without its hash when there is no site URL', async () => {
    window.history.replaceState(null, '', '/site.html?book=alps#p6')
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(
      <SiteApp input={{ ...bookInput(), site: { title: 'A', url: '' } }} />,
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('site-share'))
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/site.html?book=alps`,
    )
  })
})

describe('measured layout', () => {
  const size = { width: 1440, height: 900 }

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      () => size.width,
    )
    vi.spyOn(
      document.documentElement,
      'clientHeight',
      'get',
    ).mockImplementation(() => size.height)
  })

  it.each([
    [1440, 900, '760px', '460px'],
    // 350 / (380 / 230), as the CSSOM serializes it.
    [390, 844, '350px', '211.842105px'],
  ])('sizes the stage at %i × %i', (width, height, w, h) => {
    Object.assign(size, { width, height })
    openBook()

    const stage = screen.getByTestId('site-stage')
    expect(stage.style.width).toBe(w)
    expect(stage.style.height).toBe(h)
    expect(stage.style.aspectRatio).toBe('')
    expect(
      document.querySelector<HTMLElement>('.cover-spread')?.style.width,
    ).toBe(w)
  })

  it('sizes catalog book objects to the column', () => {
    Object.assign(size, { width: 390, height: 844 })
    render(<SiteApp input={sampleSiteInput('')} />)

    expect(
      screen.getAllByTestId('book-object').map((object) => object.style.height),
    ).toStrictEqual(['200px', '132px'])
  })
})

describe('SiteCatalog', () => {
  it('lists the books with links, meta and page counts', () => {
    render(<SiteApp input={sampleSiteInput('')} />)

    const cards = screen.getAllByTestId('site-book')
    expect(cards.map((card) => card.getAttribute('href'))).toStrictEqual([
      './site.html?book=alps',
      './site.html?book=sea',
    ])
    expect(cards[1]?.textContent).toContain('6 pages')
    expect(screen.getByText('A. Photographer · 2 photobooks')).toBeTruthy()
    expect(document.querySelector('[aria-current="page"]')?.textContent).toBe(
      'Sample photobooks',
    )
    expect(
      screen
        .getAllByTestId('book-object')
        .map((object) => object.getAttribute('data-format')),
    ).toStrictEqual(['portrait', 'landscape'])
  })

  it('says so when nothing is published', () => {
    render(<SiteApp input={sampleSiteInput('?empty=1')} />)

    expect(screen.getByText('No published books yet.')).toBeTruthy()
    expect(document.querySelector('.site-grid')).toBeNull()
  })
})

describe('fullscreen lightbox', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
  })

  const lightbox = () => screen.queryByTestId('lightbox')
  const lightboxSizes = () => [
    ...new Set(
      [
        ...document.querySelectorAll<HTMLImageElement>(
          '[data-testid="lightbox"] img[sizes]',
        ),
      ].map((img) => img.getAttribute('sizes')),
    ),
  ]

  it('opens on the current slide from Fullscreen and closes back onto its slide', () => {
    window.history.replaceState(null, '', '/site.html#p6')
    openBook()
    const opener = screen.getByTestId('site-fullscreen-btn')
    expect(opener.textContent).toBe('Fullscreen')
    opener.focus()
    fireEvent.click(opener)

    expect(lightbox()?.getAttribute('aria-label')).toBe('Alps — fullscreen')
    expect(document.activeElement).toBe(lightbox())
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(screen.getByTestId('site-fullscreen-indicator').textContent).toBe(
      'Pages 6–7 · 4 / 11',
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    // The stage behind stays put while the lightbox steps.
    expect(indicator()).toBe('Pages 6–7 · 4 / 11')
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(lightbox()).toBeNull()
    expect(indicator()).toBe('Pages 8–9 · 5 / 11')
    expect(window.location.hash).toBe('#p8')
    expect(document.activeElement).toBe(opener)
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('opens from the keyboard on the stage, also right after a swipe', () => {
    openBook()
    const open = screen.getByTestId('site-open')
    fireEvent.click(open)
    expect(lightbox()).not.toBeNull()
    fireEvent.keyDown(window, { key: 'End' })
    expect(screen.getByTestId('site-fullscreen-indicator').textContent).toBe(
      'Page 20 · 11 / 11',
    )
    expect(
      document.querySelector<HTMLElement>('.site-lb-slide')?.style.width,
    ).toBe('760px')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(indicator()).toBe('Page 20 · 11 / 11')

    fireEvent.pointerDown(open, { clientX: 300 })
    fireEvent.pointerUp(open, { clientX: 400 })
    fireEvent.click(open)
    expect(lightbox()).toBeNull()
    fireEvent.click(open)
    expect(lightbox()).not.toBeNull()
  })

  it('opens from a click on the stage, not after a swipe', () => {
    openBook()
    const stage = screen.getByTestId('site-stage')
    const open = screen.getByTestId('site-open')
    expect(open.getAttribute('aria-label')).toBe('Open fullscreen')
    fireEvent.pointerDown(open, { clientX: 300 })
    fireEvent.pointerUp(open, { clientX: 200 })
    fireEvent.click(open)
    expect(lightbox()).toBeNull()
    expect(indicator()).toBe('Page 1 · 1 / 11')

    fireEvent.pointerDown(stage, { clientX: 300 })
    fireEvent.pointerUp(stage, { clientX: 290 })
    fireEvent.click(open)
    expect(lightbox()).not.toBeNull()
    fireEvent.click(screen.getByTestId('site-fullscreen-close'))
    expect(lightbox()).toBeNull()
    expect(indicator()).toBe('Page 1 · 1 / 11')
  })

  it('loads lightbox photos eagerly at the fitted width, growing with zoom only', () => {
    vi.useFakeTimers()
    openBook()
    fireEvent.click(screen.getByTestId('site-fullscreen-btn'))
    // 1024 × 768 window: the spread fits 896 wide; the photo is 0.42 of it.
    expect(lightboxSizes()).toStrictEqual(['377px'])
    expect(
      document
        .querySelector('[data-testid="lightbox"] img[sizes]')
        ?.getAttribute('loading'),
    ).toBe('eager')
    // Measured: 760 × 460 natural in a 1440 × 900 dialog → 1301.91 wide.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(760)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(460)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1440)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(900)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(lightboxSizes()).toStrictEqual(['547px'])
    fireEvent.keyDown(window, { key: '+' })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(lightboxSizes()).toStrictEqual(['821px'])
    fireEvent.keyDown(window, { key: '0' })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(lightboxSizes()).toStrictEqual(['821px'])
    vi.useRealTimers()
  })
})
