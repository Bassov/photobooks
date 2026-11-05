import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from './sampleSite'
import { SiteBookPage, type Embedded } from './SiteBookPage'
import type { SitePageInput } from './siteInput'
import { spreadRatio, stageWidth } from './siteModel'
import type { RenderSlide } from './SiteStage'
import type { Viewport } from './useViewport'

type BookInput = Extract<SitePageInput, { kind: 'book' }>

function bookInput(): BookInput {
  const input = sampleSiteInput('?book=alps')
  if (input.kind !== 'book') throw new Error('no sample book alps')
  return input
}

function page(
  props: {
    embedded?: Embedded
    allBooks?: boolean
    share?: boolean
    renderSlide?: RenderSlide
    viewport?: Viewport | null
  } = {},
) {
  const { viewport = null, ...rest } = props
  return <SiteBookPage input={bookInput()} viewport={viewport} {...rest} />
}

const indicator = () => screen.getByTestId('site-page-indicator').textContent
const next = () => screen.getByRole('button', { name: 'Next spread' })

beforeEach(() => {
  window.history.replaceState(null, '', '/site.html')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SiteBookPage embedded', () => {
  it('shows the host slide and hands steps back without touching the URL', () => {
    const onSlide = vi.fn()
    const replace = vi.spyOn(window.history, 'replaceState')
    const { rerender } = render(page({ embedded: { slide: 0, onSlide } }))

    fireEvent.click(next())

    expect(onSlide).toHaveBeenCalledExactlyOnceWith(1)
    expect(indicator()).toBe('Cover')
    expect(replace).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('')

    rerender(page({ embedded: { slide: 4, onSlide } }))
    expect(indicator()).toBe('Pages 6–7 · 4 / 11')
    fireEvent.click(screen.getByRole('button', { name: 'Previous spread' }))
    expect(onSlide).toHaveBeenLastCalledWith(3)
    expect(replace).not.toHaveBeenCalled()
  })

  it('does not report a step past the ends', () => {
    const onSlide = vi.fn()
    render(page({ embedded: { slide: 11, onSlide } }))

    expect(next()).toHaveProperty('disabled', true)
    fireEvent.pointerDown(screen.getByTestId('site-stage'), { clientX: 100 })
    fireEvent.pointerUp(screen.getByTestId('site-stage'), { clientX: 0 })

    expect(onSlide).not.toHaveBeenCalled()
  })

  it('adds no window key or hash listener and ignores both', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const onSlide = vi.fn()
    render(page({ embedded: { slide: 0, onSlide } }))

    const types = add.mock.calls.map(([type]) => type)
    expect(types).not.toContain('keydown')
    expect(types).not.toContain('hashchange')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    window.location.hash = '#p6'
    fireEvent(window, new HashChangeEvent('hashchange'))

    expect(onSlide).not.toHaveBeenCalled()
    expect(indicator()).toBe('Cover')
  })

  it('listens for keys and the hash when not embedded', () => {
    const add = vi.spyOn(window, 'addEventListener')
    render(page())

    const types = add.mock.calls.map(([type]) => type)
    expect(types).toContain('keydown')
    expect(types).toContain('hashchange')
  })

  it('hands the lightbox slide back on close', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    const onSlide = vi.fn()
    render(page({ embedded: { slide: 2, onSlide } }))

    fireEvent.click(screen.getByTestId('site-fullscreen-btn'))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByTestId('lightbox')).toBeNull()
    expect(onSlide).toHaveBeenCalledExactlyOnceWith(3)
    expect(window.location.hash).toBe('')
  })
})

describe('SiteBookPage chrome props', () => {
  it('shows All books and Share by default', () => {
    render(page())

    expect(screen.getByTestId('site-all-books')).toBeDefined()
    expect(screen.getByTestId('site-share')).toBeDefined()
    expect(screen.getByTestId('site-share-status')).toBeDefined()
  })

  it('hides All books and Share, keeping Fullscreen', () => {
    render(page({ allBooks: false, share: false }))

    expect(screen.queryByTestId('site-all-books')).toBeNull()
    expect(screen.queryByTestId('site-share')).toBeNull()
    expect(screen.queryByTestId('site-share-status')).toBeNull()
    expect(screen.getByTestId('site-fullscreen-btn').textContent).toBe(
      'Fullscreen',
    )
    expect(screen.getByTestId('site-title').previousElementSibling).toBeNull()
  })

  it('gives the All books row to the stage when it is hidden', () => {
    const viewport = { vw: 1440, vh: 600 }
    const ratio = spreadRatio(bookInput().book.settings.trim)
    const width = stageWidth({ ...viewport, ratio, allBooks: false })
    render(page({ allBooks: false, viewport }))

    expect(width).toBeGreaterThan(stageWidth({ ...viewport, ratio }))
    expect(
      Number.parseFloat(screen.getByTestId('site-stage').style.width),
    ).toBeCloseTo(width, 5)
  })
})

describe('SiteBookPage renderSlide', () => {
  it('paints the mounted stage slides at the stage width', () => {
    const renderSlide = vi.fn<RenderSlide>((slide, widthPx) => (
      <i data-testid="host-slide">{`${String(slide)}@${String(widthPx)}`}</i>
    ))
    const viewport = { vw: 1440, vh: 600 }
    const ratio = spreadRatio(bookInput().book.settings.trim)
    const w = String(stageWidth({ ...viewport, ratio }))
    render(page({ renderSlide, viewport }))

    const painted = screen
      .getAllByTestId('host-slide')
      .map((el) => el.textContent)
    expect(painted).toStrictEqual([`0@${w}`, `1@${w}`])
    expect(document.querySelector('.cover-spread')).toBeNull()
    expect(document.querySelector('.spread-view')).toBeNull()
  })

  it('paints the lightbox slides at 760', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    const renderSlide = vi.fn<RenderSlide>((slide, widthPx) => (
      <i data-testid="host-slide">{`${String(slide)}@${String(widthPx)}`}</i>
    ))
    render(page({ renderSlide }))

    fireEvent.click(screen.getByTestId('site-fullscreen-btn'))

    const lightbox = screen.getByTestId('lightbox')
    const painted = [
      ...lightbox.querySelectorAll('[data-testid="host-slide"]'),
    ].map((el) => el.textContent)
    expect(painted).toContain('0@760')
    expect(lightbox.querySelector('.cover-spread')).toBeNull()
  })
})
