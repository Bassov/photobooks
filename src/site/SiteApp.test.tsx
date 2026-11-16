import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from './sampleSite'
import { fetchBook } from './loadBook'
import { SiteApp } from './SiteApp'
import type { BookInput } from './SiteRoom'

const home = sampleSiteInput('')
const sea = sampleSiteInput('?book=sea') as BookInput

const link = (book: string) =>
  document.querySelector<HTMLAnchorElement>(
    `[data-testid="ss9-book"][data-book="${book}"]`,
  )
const room = () => screen.queryByTestId('site-room')

beforeEach(() => {
  window.history.replaceState(null, '', '/site.html')
  document.title = 'Sample photobooks'
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function open(
  load = vi.fn<(href: string) => Promise<BookInput>>(() =>
    Promise.resolve(sea),
  ),
) {
  render(<SiteApp input={home} load={load} />)
  act(() => {
    link('sea')?.click()
  })
  await vi.waitFor(() => {
    expect(room()).not.toBeNull()
  })
  return load
}

describe('SiteApp', () => {
  it('renders a book page as the room, with no home under it', () => {
    render(<SiteApp input={sea} />)

    expect(room()).not.toBeNull()
    expect(room()?.hasAttribute('data-over')).toBe(false)
    expect(screen.queryByTestId('site-home')).toBeNull()
  })

  it('reads a book once, on hover or focus, before the click', async () => {
    const load = vi.fn(() => Promise.resolve(sea))
    render(<SiteApp input={home} load={load} />)
    const a = screen.getByRole('link', { name: /^Sea,/ })

    fireEvent.pointerOver(a)
    fireEvent.focus(a)
    await act(async () => {
      await Promise.resolve()
    })

    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('site.html?book=sea')
    expect(room()).toBeNull()
  })

  it('opens the room over the home and pushes the book URL and title', async () => {
    const push = vi.spyOn(window.history, 'pushState')
    const load = await open()

    expect(load).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('site-home')).toBeTruthy()
    expect(room()?.hasAttribute('data-over')).toBe(true)
    expect(push).toHaveBeenCalledWith(
      { siteBook: 'site.html?book=sea' },
      '',
      './site.html?book=sea',
    )
    expect(document.title).toBe('Sea · Sample photobooks')
  })

  it('goes back one history step from All books; Back closes the room and refocuses the book', async () => {
    await open()
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })

    act(() => {
      screen.getByTestId('site-all-books').click()
    })

    expect(back).toHaveBeenCalledTimes(1)
    expect(room()).toBeNull()
    expect(document.title).toBe('Sample photobooks')
    expect(document.activeElement).toBe(link('sea'))
  })

  it('reopens the room on Forward from the history state', async () => {
    await open()
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    expect(room()).toBeNull()

    act(() => {
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: { siteBook: 'site.html?book=sea' },
        }),
      )
    })

    await vi.waitFor(() => {
      expect(room()).not.toBeNull()
    })
  })

  it('reloads the page when Forward cannot read the book', async () => {
    const reload = vi
      .spyOn(window.location, 'reload')
      .mockImplementation(() => undefined)
    await open(
      vi.fn((href: string) =>
        href === 'site.html?book=gone'
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(sea),
      ),
    )

    act(() => {
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: { siteBook: 'site.html?book=gone' },
        }),
      )
    })

    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1)
    })
  })

  it('leaves modified clicks to the browser', () => {
    const load = vi.fn(() => Promise.resolve(sea))
    render(<SiteApp input={home} load={load} />)
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    })

    link('sea')?.dispatchEvent(click)

    expect(click.defaultPrevented).toBe(false)
    expect(load).not.toHaveBeenCalled()
  })

  it('falls back to the book page when its data cannot be read', async () => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined)
    render(
      <SiteApp
        input={home}
        load={() => Promise.reject(new Error('offline'))}
      />,
    )

    act(() => {
      link('sea')?.click()
    })

    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalledWith('./site.html?book=sea')
    })
    expect(room()).toBeNull()
  })
})

describe('fetchBook', () => {
  it('reads book.json beside the book page', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(sea), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetch)

    await expect(fetchBook('books/sea/')).resolves.toStrictEqual(sea)
    expect(fetch).toHaveBeenCalledWith('./books/sea/book.json')
  })

  it('fails on an error status', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('', { status: 404 })),
    )

    await expect(fetchBook('books/sea/')).rejects.toThrow('book.json 404')
  })
})
