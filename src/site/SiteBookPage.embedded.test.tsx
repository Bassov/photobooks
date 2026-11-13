import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from './sampleSite'
import { SiteRoom } from './SiteRoom'

// The book page embedded in the editor preview: the room with the host owning the view.

function bookInput() {
  const input = sampleSiteInput('?book=alps')
  if (input.kind !== 'book') throw new Error('sample book missing')
  return input
}

/** The room box (it measures itself); no GL in happy-dom (the CSS reader). */
function stubBox(w: number, h: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(w)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(h)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
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
}

const id = (testId: string) => screen.queryByTestId(testId)
const label = () => id('site-label')?.textContent

function room(slide: number, onSlide = vi.fn()) {
  return (
    <SiteRoom
      input={bookInput()}
      embedded={{ slide, onSlide }}
      allBooks={false}
      share={false}
      onClose={vi.fn()}
    />
  )
}

beforeEach(() => {
  window.history.replaceState(null, '', '/site.html')
  stubBox(1440, 900)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SiteRoom embedded', () => {
  it('the host owns the view; no URL, no name, no Share', () => {
    const onSlide = vi.fn()
    render(room(2, onSlide))

    expect(label()).toBe('Pages 2–3 of 20')
    expect(id('site-name')).toBeNull()
    expect(id('site-share')).toBeNull()
    expect(id('site-all-books')).toBeNull()
    expect(id('site-room')?.hasAttribute('data-embedded')).toBe(true)
    act(() => {
      id('site-next')?.click()
    })
    expect(onSlide).toHaveBeenCalledWith(3)
    expect(window.location.hash).toBe('')
  })

  it('follows the host: a new slide is the shown view', () => {
    const { rerender } = render(room(0))
    expect(label()).toBe('Cover')

    rerender(room(5))

    expect(label()).toBe('Pages 8–9 of 20')
    expect(id('site-room')?.getAttribute('data-view')).toBe('5')
  })

  it('leaves the keys and Esc to the host', () => {
    const onSlide = vi.fn()
    render(room(1, onSlide))

    for (const key of ['ArrowRight', 'ArrowLeft', 'Escape']) {
      act(() => {
        fireEvent.keyDown(window, { key })
      })
    }

    expect(onSlide).not.toHaveBeenCalled()
    expect(label()).toBe('Page 1 of 20')
  })
})
