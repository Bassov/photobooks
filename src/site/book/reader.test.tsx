import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from '../sampleSite'
import { SiteRoom } from '../SiteRoom'

const gl = vi.hoisted(() => ({
  wanted: false,
  open: vi.fn(),
}))
vi.mock('./glWanted', () => ({ glWanted: () => gl.wanted }))
vi.mock('./roomGl', () => ({ openReaderGl: gl.open }))

/** A 1440 × 900 room on a fine pointer; boxes are their inline size at 0, 0. */
function desk(reduce = false) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1440)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(900)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return new DOMRect(
        0,
        0,
        parseFloat(this.style.width) || 0,
        parseFloat(this.style.height) || 0,
      )
    },
  )
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduced-motion') ? reduce : q.includes('fine'),
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
  // the reader is in view: its keys are live
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(
        private readonly cb: (e: { intersectionRatio: number }[]) => void,
      ) {}
      observe() {
        this.cb([{ intersectionRatio: 1 }])
      }
      disconnect() {
        return undefined
      }
    },
  )
}

function mount(hash = '', reduce = false) {
  window.history.replaceState(null, '', `/site.html?book=alps${hash}`)
  desk(reduce)
  vi.useFakeTimers()
  const input = sampleSiteInput('?book=alps')
  if (input.kind !== 'book') throw new Error('sample book missing')
  render(<SiteRoom input={input} />)
  reader().setPointerCapture = () => undefined
}

const reader = () => screen.getByTestId('ps-reader')
const W = () => parseFloat(reader().style.width)
const H = () => parseFloat(reader().style.height)
const label = () => screen.getByTestId('site-label').textContent
const turnOf = () => reader().dataset.turn

function key(k: string, init: KeyboardEventInit = {}) {
  act(() => {
    fireEvent.keyDown(window, { key: k, ...init })
  })
}
function settle(ms = 1500) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}
function ptr(
  type: string,
  x: number,
  y = H() / 2,
  pointerType = 'mouse',
  pointerId = 1,
) {
  fireEvent(
    reader(),
    Object.assign(
      new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }),
      { pointerId, pointerType },
    ),
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  gl.wanted = false
  gl.open.mockReset()
})

describe('BookReader keys', () => {
  it('turns a leaf per arrow, queues a press made mid-turn, and lands on the back cover', () => {
    mount('#p20')

    key('ArrowRight')
    expect(turnOf()).toBe('anim')
    expect(screen.getAllByTestId('ps-leaf').length).toBeGreaterThan(0)
    settle()
    expect(label()).toBe('Back cover')
    expect(reader().dataset.cursor).toBe('←')

    key('PageUp')
    key('ArrowLeft')
    settle()
    settle()
    expect(label()).toBe('Pages 18–19 of 20')
  })

  it('crossfades Home and End; leaves modified keys and text fields alone', () => {
    mount('#p4')

    key('Home')
    expect(turnOf()).toBe('fade')
    act(() => {
      fireEvent.animationEnd(reader().querySelector('.sd-fade') ?? reader())
    })
    expect(turnOf()).toBe('rest')
    expect(label()).toBe('Cover')
    key('End')
    expect(label()).toBe('Page 20 of 20')

    key('ArrowLeft', { altKey: true })
    const field = document.body.appendChild(document.createElement('input'))
    act(() => {
      fireEvent.keyDown(field, { key: 'ArrowLeft' })
    })
    expect(turnOf()).toBe('fade')
    expect(label()).toBe('Page 20 of 20')
  })

  it('crossfades every change under reduced motion', () => {
    mount('', true)

    key('ArrowRight')

    expect(turnOf()).toBe('fade')
    expect(label()).toBe('Page 1 of 20')
  })
})

describe('BookReader pointer', () => {
  it('opens the closed book on a click on it, not beside it', () => {
    mount()

    ptr('pointerdown', 10)
    ptr('pointerup', 10)
    expect(turnOf()).toBe('rest')
    ptr('pointerdown', W() / 2)
    ptr('pointerup', W() / 2)
    expect(turnOf()).toBe('anim')
    settle()

    expect(label()).toBe('Page 1 of 20')
  })

  it('turns back on a click on the left page, and closes from the back cover', () => {
    mount('#p20')

    ptr('pointerdown', 100)
    ptr('pointerup', 100)
    settle()
    expect(label()).toBe('Pages 18–19 of 20')

    key('End')
    settle()
    key('ArrowRight')
    settle()
    expect(label()).toBe('Back cover')
    ptr('pointerdown', 10)
    ptr('pointerup', 10)
    expect(turnOf()).toBe('rest')
    ptr('pointerdown', W() / 2)
    ptr('pointerup', W() / 2)
    settle()
    expect(label()).toBe('Page 20 of 20')
  })

  it('drags the right page over the spine to turn it', () => {
    mount('#p2')

    ptr('pointerdown', W() - 20)
    ptr('pointermove', W() - 40)
    expect(turnOf()).toBe('drag')
    ptr('pointermove', 40)
    ptr('pointerup', 40)
    settle()

    expect(label()).toBe('Pages 4–5 of 20')
  })

  it('springs a short drag back; a cancel drops it', () => {
    mount('#p2')

    ptr('pointerdown', 20)
    ptr('pointermove', 40)
    ptr('pointerup', 40)
    settle()
    expect(label()).toBe('Pages 2–3 of 20')

    ptr('pointerdown', W() - 20)
    ptr('pointermove', W() - 40)
    act(() => {
      fireEvent.pointerCancel(reader())
    })
    expect(turnOf()).toBe('rest')
  })

  it('leaves a vertical touch move to the page scroll', () => {
    mount('#p2')

    ptr('pointerdown', W() - 20, 200, 'touch')
    ptr('pointermove', W() - 22, 260, 'touch')
    ptr('pointerup', W() - 22, 260, 'touch')
    settle()

    expect(turnOf()).toBe('rest')
    expect(label()).toBe('Pages 2–3 of 20')
  })

  it('lifts a page corner under the mouse and lays it back on leave', () => {
    mount('#p2')

    ptr('pointermove', W() - 10)
    expect(turnOf()).toBe('lift')
    expect(reader().dataset.cursor).toBe('→')
    settle(300)
    ptr('pointermove', W() / 2 + 40)
    settle(300)
    expect(turnOf()).toBe('rest')

    ptr('pointermove', 10)
    expect(turnOf()).toBe('lift')
    act(() => {
      fireEvent.pointerLeave(reader())
    })
    settle(300)
    expect(turnOf()).toBe('rest')
  })
})

describe('BookReader with WebGL', () => {
  function fakeGl() {
    return {
      book: {
        set: vi.fn(),
        frame: vi.fn(),
        dispose: vi.fn(),
        onChange: () => undefined,
        loading: false,
      },
      faces: { focus: vi.fn(), dispose: vi.fn() },
      draw: vi.fn(),
    }
  }
  const flush = async () => {
    await act(async () => {
      await vi.dynamicImportSettled()
      await Promise.resolve()
    })
  }

  it('draws the book on the canvas and crossfades jumps over a snapshot', async () => {
    gl.wanted = true
    const made = fakeGl()
    gl.open.mockResolvedValue(made)
    const fade = { onfinish: null as (() => void) | null }
    const animate = vi.fn(() => fade as never)
    HTMLCanvasElement.prototype.animate = animate
    mount()
    await flush()

    const root = screen.getByTestId('ps-reader-gl')
    expect(root.dataset.gl).toBe('ready')
    expect(root.dataset.faces).toBe('done')
    expect(made.book.set).toHaveBeenLastCalledWith(0, 0)
    expect(made.faces.focus).toHaveBeenLastCalledWith(0)

    act(() => {
      made.book.onChange()
    })
    key('End')
    expect(animate).toHaveBeenCalledTimes(1)
    act(() => {
      fade.onfinish?.()
    })
    expect(turnOf()).toBe('rest')
    expect(made.book.set).toHaveBeenLastCalledWith(11, 0)

    cleanup()
    expect(made.book.dispose).toHaveBeenCalledTimes(1)
  })

  it('falls back to the CSS book when GL fails', async () => {
    gl.wanted = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    gl.open.mockRejectedValue(new Error('no context'))
    mount()
    await flush()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('ps-reader-gl')).toBeNull()
  })

  it('drops a book that arrives after the reader is gone', async () => {
    gl.wanted = true
    const made = fakeGl()
    let resolve: (made: unknown) => void = () => undefined
    gl.open.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    mount()
    await flush()

    cleanup()
    resolve(made)
    await flush()

    expect(made.book.dispose).toHaveBeenCalledTimes(1)
    expect(made.faces.dispose).toHaveBeenCalledTimes(1)
  })
})
