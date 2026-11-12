import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleSiteInput } from '../sampleSite'
import type { RoomSlide } from '../siteModel'
import { SiteRoom } from '../SiteRoom'
import { fromDrag, scripted, sheetOf } from './motion'

const gl = vi.hoisted(() => ({
  wanted: false,
  open: vi.fn(),
}))
vi.mock('./gl/three', async (real) => ({
  ...(await real<typeof import('./gl/three')>()),
  glWanted: () => gl.wanted,
}))
vi.mock('./roomGl', () => ({ openCurlGl: gl.open }))

const rad = (d: number) => (d * Math.PI) / 180

describe('the curl model', () => {
  it('starts a scripted turn with the axis on the corner and ends past the edge', () => {
    const start = scripted(300, 400, 27, 0)
    const end = scripted(300, 400, 27, 1)

    expect(start.xm).toBeCloseTo(300 + 200 * Math.tan(rad(15)))
    expect(start.beta).toBeCloseTo(rad(15))
    expect(end).toStrictEqual({ xm: -45, beta: 0, r: 27 })
  })

  it('follows an edge drag; past πr the fold sits under the finger', () => {
    const C = { x: 300, y: 200 }

    expect(fromDrag(300, 400, 27, C, false, 0, 0).xm).toBeCloseTo(300)
    expect(fromDrag(300, 400, 27, C, false, -50, 30).xm).toBeCloseTo(250)
    expect(fromDrag(300, 400, 27, C, false, -100, 0).xm).toBeCloseTo(
      300 - (100 + Math.PI * 27) / 2,
    )
  })

  it('leads with the grabbed corner, within 25°', () => {
    const bottom = fromDrag(300, 400, 27, { x: 300, y: 400 }, true, -60, 0)
    const top = fromDrag(300, 400, 27, { x: 300, y: 0 }, true, -60, 0)
    const steep = fromDrag(300, 400, 27, { x: 300, y: 400 }, true, -60, -300)

    expect(bottom.beta).toBeCloseTo(rad(12))
    expect(top.beta).toBeCloseTo(-rad(12))
    expect(steep.beta).toBeCloseTo(rad(25))
  })

  it('maps slides to curl sheets', () => {
    const s = (page?: RoomSlide['page']): RoomSlide =>
      page === undefined ? { view: 0, label: '' } : { view: 1, label: '', page }

    expect(sheetOf(s())).toStrictEqual({ kind: 'cover' })
    expect(sheetOf(s({ spread: 0, side: 'right' }))).toStrictEqual({
      kind: 'page',
      page: 0,
    })
    expect(sheetOf(s({ spread: 2, side: 'left' }))).toStrictEqual({
      kind: 'page',
      page: 3,
    })
    expect(sheetOf(s({ spread: 2, side: 'right' }))).toStrictEqual({
      kind: 'page',
      page: 4,
    })
    expect(sheetOf(s({ spread: 3, side: 'both' }))).toStrictEqual({
      kind: 'spread',
      left: 5,
      right: 6,
    })
  })
})

function book() {
  const input = sampleSiteInput('?book=alps')
  if (input.kind !== 'book') throw new Error('sample book missing')
  return input
}

function phone(reduce = false) {
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
}

const stage = () => screen.getByTestId('pt-stage')
const label = () => screen.getByTestId('site-label').textContent

function at(type: string, x: number, y: number, pointerId = 1) {
  fireEvent(
    stage(),
    Object.assign(
      new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }),
      { pointerId, pointerType: 'touch' },
    ),
  )
}
function drag(x0: number, y0: number, xs: number[]) {
  at('pointerdown', x0, y0)
  for (const x of xs) at('pointermove', x, y0)
}
function settle() {
  act(() => {
    vi.advanceTimersByTime(1200)
  })
}
function key(k: string) {
  act(() => {
    fireEvent.keyDown(window, { key: k })
  })
}

function mount(hash = '', reduce = false) {
  window.history.replaceState(null, '', `/site.html?book=alps${hash}`)
  phone(reduce)
  vi.useFakeTimers()
  render(<SiteRoom input={book()} />)
  stage().setPointerCapture = () => undefined
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  gl.wanted = false
  gl.open.mockReset()
})

describe('PageTurn', () => {
  it('runs a scripted turn on a right-half tap: a CSS fold, then the next page', () => {
    mount()

    at('pointerdown', 300, 250)
    at('pointerup', 302, 251)
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(stage().dataset.turn).toBe('move')
    expect(stage().dataset.dir).toBe('fwd')
    expect(screen.getByTestId('pt-flap')).toBeTruthy()
    expect(Number(stage().dataset.xm)).toBeLessThan(390)
    settle()
    expect(stage().dataset.turn).toBe('rest')
    expect(label()).toBe('Page 1 of 20')
    expect(window.location.hash).toBe('#p1')
  })

  it('turns back on a left-half tap', () => {
    mount('#p1')

    at('pointerdown', 40, 250)
    at('pointerup', 40, 250)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(stage().dataset.dir).toBe('back')
    settle()

    expect(label()).toBe('Cover')
  })

  it('peels the page with a drag past half and lets it go', () => {
    mount()

    drag(380, 250, [365, 200, 40])
    expect(stage().dataset.turn).toBe('move')
    at('pointerup', 40, 250)
    settle()

    expect(label()).toBe('Page 1 of 20')
  })

  it('peels from the grabbed corner', () => {
    mount()

    drag(380, 10, [365, 300])
    expect(Number(stage().dataset.xm)).toBeLessThan(390)
    at('pointerup', 300, 10)
    settle()

    expect(label()).toBe('Cover')
  })

  it('springs back from a short drag and a cancel', () => {
    mount('#p1')

    drag(380, 250, [365])
    at('pointerup', 365, 250)
    settle()
    expect(label()).toBe('Page 1 of 20')

    drag(380, 250, [365, 200])
    at('pointercancel', 200, 250)
    settle()
    expect(label()).toBe('Page 1 of 20')
    expect(stage().dataset.turn).toBe('rest')
  })

  it('turns back with a rightward drag', () => {
    mount('#p1')

    drag(20, 250, [35, 300, 380])
    expect(stage().dataset.dir).toBe('back')
    at('pointerup', 380, 250)
    settle()

    expect(label()).toBe('Cover')
  })

  it('ignores a vertical drag, a back drag on the cover and a second finger', () => {
    mount()

    at('pointerdown', 300, 250)
    at('pointermove', 302, 280)
    at('pointerup', 302, 280)
    drag(20, 250, [40, 200])
    at('pointerup', 200, 250)
    at('pointerdown', 300, 250)
    at('pointerdown', 100, 250, 2)
    at('pointerup', 100, 250, 2)
    at('pointercancel', 300, 250)
    settle()

    expect(stage().dataset.turn).toBe('rest')
    expect(label()).toBe('Cover')
  })

  it('turns with the arrows; Home and End crossfade', () => {
    mount()

    key('ArrowRight')
    settle()
    expect(label()).toBe('Page 1 of 20')
    key('End')
    expect(stage().dataset.dir).toBe('')
    expect(stage().dataset.turn).toBe('move')
    settle()
    expect(label()).toBe('Page 20 of 20')
    key('ArrowLeft')
    settle()
    expect(label()).toBe('Page 19 of 20')
    key('Home')
    settle()
    expect(label()).toBe('Cover')
  })

  it('crossfades under reduced motion, for keys and drags', () => {
    mount('', true)

    key('ArrowRight')
    expect(screen.queryByTestId('pt-flap')).toBeNull()
    settle()
    expect(label()).toBe('Page 1 of 20')

    drag(380, 250, [365, 200])
    at('pointerup', 200, 250)
    settle()
    expect(label()).toBe('Page 2 of 20')

    drag(380, 250, [365])
    at('pointerup', 365, 250)
    drag(380, 250, [365])
    at('pointercancel', 365, 250)
    settle()
    expect(label()).toBe('Page 2 of 20')
  })

  it('follows a view change from outside without a turn', () => {
    mount()

    act(() => {
      window.location.hash = '#p4'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(stage().dataset.turn).toBe('rest')
    expect(label()).toBe('Page 4 of 20')
  })
})

describe('PageTurn with WebGL', () => {
  function fakeCurl() {
    const curl = {
      draw: vi.fn(() => true),
      ready: () => true,
      keep: vi.fn(),
      dispose: vi.fn(),
      onChange: () => undefined,
    }
    const faces = { focus: vi.fn(), dispose: vi.fn() }
    return { curl, faces }
  }
  const flush = async () => {
    await act(async () => {
      await vi.dynamicImportSettled()
      await Promise.resolve()
    })
  }

  it('draws the sheets on the canvas and turns there', async () => {
    gl.wanted = true
    const made = fakeCurl()
    gl.open.mockResolvedValue(made)
    mount()
    await flush()

    act(() => {
      made.curl.onChange()
    })
    expect(stage().dataset.gl).toBe('1')
    expect(screen.getByTestId('pt-gl')).toBeTruthy()
    expect(made.curl.keep).toHaveBeenCalledWith(0)
    key('ArrowRight')
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.queryByTestId('pt-flap')).toBeNull()
    expect(made.curl.draw).toHaveBeenLastCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ top: 0, under: 1 }),
    )
    settle()
    expect(label()).toBe('Page 1 of 20')
    expect(made.faces.focus).toHaveBeenLastCalledWith(1)

    cleanup()
    expect(made.curl.dispose).toHaveBeenCalledTimes(1)
  })

  it('falls back to the CSS fold when GL fails', async () => {
    gl.wanted = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    gl.open.mockRejectedValue(new Error('no context'))
    mount()
    await flush()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('pt-gl')).toBeNull()
  })

  it('drops a curl that arrives after the stage is gone', async () => {
    gl.wanted = true
    const made = fakeCurl()
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

    expect(made.curl.dispose).toHaveBeenCalledTimes(1)
    expect(made.faces.dispose).toHaveBeenCalledTimes(1)
  })
})
