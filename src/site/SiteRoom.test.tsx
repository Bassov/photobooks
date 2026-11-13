import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { roomMode } from './book/roomLayout'
import { COVER_DELAY_MS, DWELL_MS, FADE_MS, SiteRoom } from './SiteRoom'
import { bookInput, id, key, label, stubBox } from './siteRoom.test-helpers'

beforeEach(() => {
  window.history.replaceState(null, '', '/site.html?book=alps')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('roomMode', () => {
  it('is portrait on a tall phone, landscape on a short wide box, else desktop', () => {
    expect(roomMode(390, 844)).toBe('port')
    expect(roomMode(844, 390)).toBe('land')
    expect(roomMode(767, 768)).toBe('port')
    expect(roomMode(768, 1024)).toBe('desk')
    expect(roomMode(1440, 900)).toBe('desk')
    expect(roomMode(1440, 499)).toBe('land')
  })
})

describe('SiteRoom desktop', () => {
  beforeEach(() => {
    stubBox(1440, 900)
  })

  it('lays the foot row out: about · pager · Share, Fullscreen, Play', () => {
    render(<SiteRoom input={bookInput()} />)

    expect(id('site-room')?.getAttribute('data-mode')).toBe('desk')
    expect(id('site-name')?.textContent).toBe('A. Photographer')
    expect(id('site-all-books')?.getAttribute('href')).toBe('./site.html')
    expect(id('site-all-books')?.textContent).toBe('All books')
    expect(id('site-about')?.textContent).toBe(
      'Alps2024 · 20 pages · 19 × 23 cm',
    )
    expect(
      [...(id('site-pager')?.children ?? [])].map((c) => c.textContent),
    ).toStrictEqual(['Previous', 'Cover', 'Next'])
    expect(id('site-prev')?.hasAttribute('disabled')).toBe(true)
    expect(
      [...(id('site-actions')?.children ?? [])].map((c) =>
        c.getAttribute('data-testid'),
      ),
    ).toStrictEqual(['site-share', 'site-fullscreen-btn', 'site-play'])
    expect(label()).toBe('Cover')
    expect(id('ps-reader')).not.toBeNull()
  })

  it('pages with Next and writes the first page into the hash', () => {
    render(<SiteRoom input={bookInput()} />)

    act(() => {
      id('site-next')?.click()
    })

    expect(label()).toBe('Page 1 of 20')
    expect(window.location.hash).toBe('#p1')
    expect(window.location.search).toBe('?book=alps')
  })

  it('opens a #pN deep link at the spread holding page N, and follows hash changes', () => {
    window.history.replaceState(null, '', '/site.html?book=alps#p4')
    render(<SiteRoom input={bookInput()} />)

    expect(label()).toBe('Pages 4–5 of 20')
    act(() => {
      window.location.hash = '#p20'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(label()).toBe('Page 20 of 20')
  })

  it('drops the hash on the back cover', () => {
    window.history.replaceState(null, '', '/site.html?book=alps#p20')
    render(<SiteRoom input={bookInput()} />)

    act(() => {
      id('site-next')?.click()
    })

    expect(label()).toBe('Back cover')
    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('?book=alps')
    expect(id('site-next')?.hasAttribute('disabled')).toBe(true)
  })

  it('is a plain link home on a direct visit; Esc stays', () => {
    render(<SiteRoom input={bookInput()} />)
    const all = id('site-all-books')

    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    all?.dispatchEvent(click)
    key('Escape')

    expect(click.defaultPrevented).toBe(false)
    expect(id('site-room')).not.toBeNull()
  })

  it('closes over the home with All books and with Esc', () => {
    const onClose = vi.fn()
    render(<SiteRoom input={bookInput()} over onClose={onClose} />)

    act(() => {
      id('site-all-books')?.click()
    })
    key('Escape')

    expect(onClose).toHaveBeenCalledTimes(2)
    expect(id('site-room')?.hasAttribute('data-over')).toBe(true)
  })

  it('turns the cover once the room has faded in over the home', () => {
    vi.useFakeTimers()
    render(<SiteRoom input={bookInput()} over onClose={vi.fn()} />)

    act(() => {
      vi.advanceTimersByTime(FADE_MS + COVER_DELAY_MS - 1)
    })
    expect(label()).toBe('Cover')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(label()).toBe('Page 1 of 20')
  })

  it('opens Fullscreen on the shown spread; Esc there closes it alone and focus returns', () => {
    const onClose = vi.fn()
    window.history.replaceState(null, '', '/site.html?book=alps#p4')
    render(<SiteRoom input={bookInput()} onClose={onClose} />)

    act(() => {
      id('site-fullscreen-btn')?.click()
    })
    expect(id('lightbox')).not.toBeNull()
    expect(id('site-room')?.hasAttribute('data-full')).toBe(true)
    key('Escape')

    expect(id('lightbox')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(label()).toBe('Pages 4–5 of 20')
  })

  it('plays: Pause with a progress line, any other key pauses', () => {
    vi.useFakeTimers()
    render(<SiteRoom input={bookInput()} />)
    const play = () => id('site-play')

    act(() => {
      play()?.click()
    })
    expect(play()?.getAttribute('aria-pressed')).toBe('true')
    expect(play()?.textContent).toBe('Pause')
    expect(id('site-progress')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(DWELL_MS)
    })
    expect(label()).toBe('Page 1 of 20')

    key('ArrowDown')
    expect(play()?.textContent).toBe('Play')
    expect(id('site-progress')).toBeNull()
  })

  it('pauses on Pause and when the page is hidden', () => {
    vi.useFakeTimers()
    render(<SiteRoom input={bookInput()} />)
    const pressed = () => id('site-play')?.getAttribute('aria-pressed')

    act(() => {
      id('site-play')?.click()
    })
    act(() => {
      id('site-play')?.click()
    })
    expect(pressed()).toBe('false')

    act(() => {
      id('site-play')?.click()
    })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(pressed()).toBe('false')
  })

  it('shares the page URL and opens Fullscreen on the cover', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<SiteRoom input={bookInput()} />)

    await act(async () => {
      id('site-share')?.click()
      await Promise.resolve()
    })
    act(() => {
      id('site-fullscreen-btn')?.click()
    })

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/site.html?book=alps`,
    )
    expect(id('lightbox')).not.toBeNull()
  })

  it('restarts Play from page 1 at the back cover', () => {
    window.history.replaceState(null, '', '/site.html?book=sea#p6')
    render(<SiteRoom input={bookInput('sea')} />)
    act(() => {
      id('site-next')?.click()
    })
    expect(label()).toBe('Back cover')

    act(() => {
      id('site-play')?.click()
    })

    expect(label()).toBe('Page 1 of 6')
  })
})

describe('SiteRoom narrow desktop', () => {
  it('stacks the pager over about and the buttons', () => {
    stubBox(620, 560)
    render(<SiteRoom input={bookInput()} />)

    const actions = id('site-actions')
    expect(id('site-room')?.getAttribute('data-mode')).toBe('desk')
    expect(actions?.firstElementChild?.getAttribute('data-testid')).toBe(
      'site-about',
    )
    expect(id('site-fullscreen-btn')).not.toBeNull()
  })
})

describe('SiteRoom phone', () => {
  it('portrait: the page turn under a back row with Share and Play; no Fullscreen or pager', () => {
    stubBox(390, 844)
    render(<SiteRoom input={bookInput()} />)

    expect(id('site-room')?.getAttribute('data-mode')).toBe('port')
    expect(id('pt-stage')).not.toBeNull()
    expect(id('ps-strip')).toBeNull()
    expect(id('site-all-books')?.textContent).toBe('‹ Alps')
    expect(id('site-all-books')?.getAttribute('aria-label')).toBe('All books')
    expect(id('site-share')).not.toBeNull()
    expect(id('site-play')).not.toBeNull()
    expect(id('site-fullscreen-btn')).toBeNull()
    expect(id('site-prev')).toBeNull()
    expect(id('site-next')).toBeNull()
    expect(label()).toBe('Cover')
  })

  it('portrait with ?reader=carousel: the carousel', () => {
    stubBox(390, 844)
    window.history.replaceState(
      null,
      '',
      '/site.html?book=alps&reader=carousel',
    )
    render(<SiteRoom input={bookInput()} />)

    expect(id('ps-strip')).not.toBeNull()
    expect(id('pt-stage')).toBeNull()
  })

  it('landscape: the reader with Share and Play, no Fullscreen', () => {
    stubBox(844, 390)
    render(<SiteRoom input={bookInput()} />)

    expect(id('site-room')?.getAttribute('data-mode')).toBe('land')
    expect(id('ps-reader')).not.toBeNull()
    expect(id('site-fullscreen-btn')).toBeNull()
    expect(id('site-share')).not.toBeNull()
  })
})
