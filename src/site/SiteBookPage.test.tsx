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
      'site.html',
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
      'site.html?book=alps',
      'site.html?book=sea',
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
