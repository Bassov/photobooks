import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from '../sampleSite'
import { SiteRoom } from '../SiteRoom'
import { slideKey } from './roomLayout'

describe('slideKey', () => {
  const k = (key: string, init: KeyboardEventInit = {}, target?: Element) => {
    const e = new KeyboardEvent('keydown', { key, ...init })
    if (target) Object.defineProperty(e, 'target', { value: target })
    return slideKey(e)
  }

  it('maps the arrows to steps and Home / End to jumps', () => {
    expect([
      k('ArrowRight'),
      k('ArrowLeft'),
      k('Home'),
      k('End'),
    ]).toStrictEqual([1, -1, 'home', 'end'])
    expect(k('ArrowUp')).toBeNull()
  })

  it('leaves modified keys and text fields alone', () => {
    expect(k('ArrowRight', { shiftKey: true })).toBeNull()
    expect(k('ArrowRight', { metaKey: true })).toBeNull()
    expect(k('ArrowRight', {}, document.createElement('input'))).toBeNull()
  })
})

function carousel(reduce = false) {
  window.history.replaceState(null, '', '/site.html?book=alps&reader=carousel')
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(844)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 390, 500),
  )
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduced-motion'),
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
  const scrolls: ScrollToOptions[] = []
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(
    (o?: ScrollToOptions | number) => {
      if (typeof o === 'object') scrolls.push(o)
    },
  )
  vi.useFakeTimers()
  const input = sampleSiteInput('?book=alps')
  if (input.kind !== 'book') throw new Error('sample book missing')
  render(<SiteRoom input={input} />)
  return scrolls
}

const strip = () => screen.getByTestId('ps-strip')
const label = () => screen.getByTestId('site-label').textContent
/** the strip scrolled to `left`, then quiet */
function scrollTo(left: number, end: 'quiet' | 'scrollend' = 'quiet') {
  act(() => {
    strip().scrollLeft = left
    fireEvent.scroll(strip())
  })
  act(() => {
    if (end === 'quiet') vi.advanceTimersByTime(150)
    else fireEvent(strip(), new Event('scrollend'))
  })
}
function tap(x: number) {
  fireEvent.pointerDown(strip(), { clientX: x, clientY: 200 })
  fireEvent.pointerUp(strip(), { clientX: x, clientY: 200 })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Slides (carousel)', () => {
  it('opens at the start slide and follows the scroll, at rest after 150 ms', () => {
    const scrolls = carousel()
    expect(scrolls[0]).toStrictEqual({ left: 0, behavior: 'instant' })

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    const step = scrolls.at(-1)
    expect(step?.behavior).toBe('smooth')
    scrollTo(Number(step?.left))

    expect(label()).toBe('Page 1 of 20')
    expect(strip().dataset.scroll).toBe('rest')
  })

  it('turns with taps and jumps with End / Home; rests on scrollend', () => {
    const scrolls = carousel()

    tap(300)
    const pitch = Number(scrolls.at(-1)?.left)
    scrollTo(pitch, 'scrollend')
    expect(label()).toBe('Page 1 of 20')
    tap(40)
    expect(scrolls.at(-1)?.left).toBe(0)
    act(() => {
      fireEvent.keyDown(window, { key: 'End' })
    })
    expect(scrolls.at(-1)?.left).toBe(20 * pitch)
    scrollTo(20 * pitch)
    expect(label()).toBe('Page 20 of 20')
    act(() => {
      fireEvent.keyDown(window, { key: 'Home' })
    })
    expect(scrolls.at(-1)?.left).toBe(0)
  })

  it('ignores a drag, and scrolls at once under reduced motion', () => {
    const scrolls = carousel(true)
    const before = scrolls.length

    fireEvent.pointerDown(strip(), { clientX: 300, clientY: 200 })
    fireEvent.pointerUp(strip(), { clientX: 200, clientY: 200 })
    fireEvent.pointerDown(strip(), { clientX: 300, clientY: 200 })
    fireEvent.pointerCancel(strip())
    fireEvent.pointerUp(strip(), { clientX: 300, clientY: 200 })
    expect(scrolls.length).toBe(before)

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(scrolls.at(-1)?.behavior).toBe('instant')
  })

  it('jumps to a view set from outside', () => {
    const scrolls = carousel()

    act(() => {
      window.location.hash = '#p4'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(scrolls.at(-1)?.behavior).toBe('instant')
    expect(label()).toBe('Page 4 of 20')
  })
})
