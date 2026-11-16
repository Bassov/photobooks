import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteRoom } from './SiteRoom'
import { bookInput, id, pointer, stubBox } from './siteRoom.test-helpers'

// Swipe back over the home (phones): the room follows a rightward swipe and
// closes past a quarter of its width or on a flick.

const room = () => screen.getByTestId('site-room')
const at = (
  type: string,
  x: number,
  opts: Parameters<typeof pointer>[4] = {},
) => {
  pointer(room(), type, x, 100, opts)
}
const wait = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function mount(
  w = 390,
  h = 844,
  { reduce = false, onClose = vi.fn<() => void>() } = {},
) {
  vi.useFakeTimers()
  stubBox(w, h, { reduce })
  const view = render(<SiteRoom input={bookInput()} over onClose={onClose} />)
  const capture = vi.fn()
  room().setPointerCapture = capture
  return { onClose, capture, view }
}

/** a slow drag from x 10 to `x` (t 1 → 1000: no flick) */
function drag(x: number, opts: Parameters<typeof pointer>[4] = {}) {
  at('pointerdown', 10, { t: 1, ...opts })
  at('pointermove', 40, { t: 500, ...opts })
  at('pointermove', x, { t: 1000, ...opts })
}

beforeEach(() => {
  window.history.replaceState(null, '', '/site.html?book=alps')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('swipe back', () => {
  it('follows the finger, then slides out past a quarter of the width and closes', () => {
    const { onClose, capture } = mount()

    drag(200)
    expect(room().dataset.swipe).toBe('move')
    expect(room().style.transform).toBe('translate3d(190px,0,0)')
    expect(capture).toHaveBeenCalledWith(1)
    at('pointerup', 200, { t: 1000 })
    expect(room().style.transform).toBe('translate3d(390px,0,0)')
    wait(199)
    expect(onClose).not.toHaveBeenCalled()
    wait(1)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('springs back from a short slow swipe', () => {
    const { onClose } = mount()

    drag(100)
    at('pointerup', 100, { t: 1000 })
    expect(room().style.transform).toBe('')
    expect(room().dataset.swipe).toBe('move')
    wait(200)

    expect(room().dataset.swipe).toBe('')
    expect(room().style.transition).toBe('none')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on a flick faster than 0.5 px/ms', () => {
    const { onClose } = mount()

    at('pointerdown', 10, { t: 1 })
    at('pointermove', 30, { t: 960 })
    at('pointermove', 90, { t: 1000 })
    at('pointerup', 90, { t: 1000 })
    wait(200)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('springs back on a cancel, however far', () => {
    const { onClose } = mount()

    drag(300)
    at('pointercancel', 300, { t: 1000 })
    wait(200)

    expect(onClose).not.toHaveBeenCalled()
    expect(room().dataset.swipe).toBe('')
  })

  it('swallows the click that follows a swipe, not a later one', () => {
    const { onClose } = mount()
    drag(100)
    at('pointerup', 100, { t: 1000 })

    act(() => {
      id('site-all-books')?.click()
    })
    expect(onClose).not.toHaveBeenCalled()
    wait(0)
    act(() => {
      id('site-all-books')?.click()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('lets a tap through', () => {
    const { onClose } = mount()

    at('pointerdown', 10)
    at('pointerup', 10)
    act(() => {
      id('site-all-books')?.click()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(room().dataset.swipe).toBeUndefined()
  })

  it.each([
    ['a mouse', { kind: 'mouse' }],
    ['another pointer', { id: 2 }],
  ])('ignores %s', (_, opts) => {
    const { onClose } = mount()

    at('pointerdown', 10, { t: 1, ...opts })
    at('pointermove', 40, { t: 500 })
    at('pointermove', 300, { t: 1000 })
    at('pointerup', 300, { t: 1000 })
    wait(200)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the first press while a second finger lands', () => {
    const { onClose } = mount()

    at('pointerdown', 10, { t: 1 })
    at('pointerdown', 300, { t: 2, id: 2 })
    at('pointermove', 40, { t: 500 })
    at('pointermove', 300, { t: 1000 })
    at('pointerup', 300, { t: 1000, id: 2 })
    at('pointerup', 300, { t: 1000 })
    wait(200)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves a press on the page to the page turn', () => {
    const { onClose } = mount()

    pointer(screen.getByTestId('pt-stage'), 'pointerdown', 10, 100, { t: 1 })
    at('pointermove', 40, { t: 500 })
    at('pointermove', 300, { t: 1000 })
    at('pointerup', 300, { t: 1000 })
    wait(200)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('drops a press that goes vertical first', () => {
    const { onClose } = mount()

    at('pointerdown', 10, { t: 1 })
    pointer(room(), 'pointermove', 12, 120, { t: 100 })
    at('pointermove', 300, { t: 1000 })
    at('pointerup', 300, { t: 1000 })
    wait(200)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('under reduced motion does not follow and closes at once', () => {
    const { onClose } = mount(390, 844, { reduce: true })

    drag(200)
    expect(room().style.transform).toBe('')
    at('pointerup', 200, { t: 1000 })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('under reduced motion stays on a short swipe', () => {
    const { onClose } = mount(390, 844, { reduce: true })

    drag(100)
    at('pointerup', 100, { t: 1000 })
    wait(200)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('works in phone landscape outside the reader', () => {
    const { onClose } = mount(844, 390)

    drag(300)
    at('pointerup', 300, { t: 1000 })
    wait(200)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is off on desktop', () => {
    const { onClose } = mount(1440, 900)

    drag(600)
    at('pointerup', 600, { t: 1000 })
    wait(200)

    expect(onClose).not.toHaveBeenCalled()
    expect(room().style.touchAction).toBe('')
  })

  it('is off without a home to return to', () => {
    vi.useFakeTimers()
    stubBox(390, 844)
    render(<SiteRoom input={bookInput()} />)

    expect(room().style.touchAction).toBe('')
  })

  it('does not close a room that left mid-slide', () => {
    const { onClose, view } = mount()
    drag(200)
    at('pointerup', 200, { t: 1000 })

    view.unmount()
    wait(200)

    expect(onClose).not.toHaveBeenCalled()
  })
})
