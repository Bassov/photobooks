import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, type RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Rulers } from './Rulers'

const startGuideDrag = vi.hoisted(() =>
  vi.fn<(start: import('./guideGesture').GuideDragStart) => void>(),
)
vi.mock('./guideGesture', () => ({ startGuideDrag }))

const camera = vi.hoisted(() => ({ listener: null as null | (() => void) }))
vi.mock('./cameraStore', () => ({
  getCommittedCamera: () => ({ zoom: 2 }),
  subscribeCommitted: (listener: () => void) => {
    camera.listener = listener
    return () => {
      camera.listener = null
    }
  },
}))

function Stage({
  scrollRef,
  pageMm = 200,
  active = true,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  pageMm?: number
  active?: boolean
}) {
  return (
    <div data-testid="stage">
      <div ref={scrollRef} data-testid="scroll">
        <div data-pasteboard-slot="" data-active={active ? 'true' : 'false'}>
          <div data-testid="spread-view" />
        </div>
      </div>
      <Rulers scrollRef={scrollRef} pageMm={pageMm} />
    </div>
  )
}

function rect(left: number, top: number, width: number): DOMRect {
  return { left, top, width } as DOMRect
}

function fakeContext() {
  return {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    measureText: () => ({ width: 10 }),
    globalAlpha: 1,
    fillStyle: '',
    font: '',
    textBaseline: '',
  }
}

describe('Rulers', () => {
  let frames: FrameRequestCallback[]
  let ctx: ReturnType<typeof fakeContext>
  let boxLeft: number
  let offsetWidth: number
  let observers: {
    callback: () => void
    observe: ReturnType<typeof vi.fn>
    unobserve: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }[]

  const flush = () => {
    const queued = frames
    frames = []
    for (const cb of queued) cb(0)
  }

  beforeEach(() => {
    frames = []
    boxLeft = 122
    offsetWidth = 600
    ctx = fakeContext()
    observers = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(public callback: () => void) {
          observers.push(this)
        }
      },
    )
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
      () => offsetWidth,
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.testid === 'spread-view'
          ? rect(boxLeft, 72, 1200)
          : rect(22, 22, 0)
      },
    )
  })
  afterEach(() => {
    cleanup()
    startGuideDrag.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders both strips and the mm corner', () => {
    render(<Stage scrollRef={createRef()} />)
    expect(screen.getByTestId('ruler-x')).toBeTruthy()
    expect(screen.getByTestId('ruler-y')).toBeTruthy()
    expect(screen.getByTestId('ruler-corner').textContent).toBe('mm')
  })

  it('pulls a horizontal guide from the top strip and a vertical one from the left strip', () => {
    render(<Stage scrollRef={createRef()} />)
    const spread = screen.getByTestId('spread-view')
    fireEvent.pointerDown(screen.getByTestId('ruler-x'), { button: 0 })
    fireEvent.pointerDown(screen.getByTestId('ruler-y'), { button: 0 })
    expect(startGuideDrag).toHaveBeenCalledTimes(2)
    const top = startGuideDrag.mock.calls[0]?.[0]
    const left = startGuideDrag.mock.calls[1]?.[0]
    // Identity checks: deep-equal on DOM nodes is very slow.
    expect(top?.orientation).toBe('horizontal')
    expect(top?.spreadEl).toBe(spread)
    expect(top?.rulerEl).toBe(screen.getByTestId('ruler-x'))
    expect(left?.orientation).toBe('vertical')
    expect(left?.spreadEl).toBe(spread)
    expect(left?.rulerEl).toBe(screen.getByTestId('ruler-y'))
  })

  it('keeps the press from selecting text while a guide is pulled', () => {
    render(<Stage scrollRef={createRef()} />)
    const notPrevented = fireEvent.pointerDown(screen.getByTestId('ruler-x'), {
      button: 0,
    })
    expect(notPrevented).toBe(false)
  })

  it('ignores secondary buttons on the strips', () => {
    render(<Stage scrollRef={createRef()} />)
    const notPrevented = fireEvent.pointerDown(screen.getByTestId('ruler-x'), {
      button: 2,
    })
    expect(startGuideDrag).not.toHaveBeenCalled()
    expect(notPrevented).toBe(true)
  })

  it('pulls nothing while no spread is mounted', () => {
    offsetWidth = 0
    render(<Stage scrollRef={createRef()} />)
    fireEvent.pointerDown(screen.getByTestId('ruler-y'), { button: 0 })
    expect(startGuideDrag).not.toHaveBeenCalled()
  })

  it('paints ticks and labels at the spread origin and scale', () => {
    const { container } = render(<Stage scrollRef={createRef()} />)
    const [canvasX, canvasY] = container.querySelectorAll('canvas')
    expect(screen.getByTestId('ruler-x').dataset.origin).toBe('100')
    expect(screen.getByTestId('ruler-y').dataset.origin).toBe('50')
    expect([canvasX?.width, canvasX?.height]).toEqual([500, 22])
    expect([canvasY?.width, canvasY?.height]).toEqual([22, 300])
    // origin X = 122 - 22, origin Y = 72 - 22, scale 2 px/mm, step 10 mm.
    expect(ctx.fillRect).toHaveBeenCalledWith(100, 13, 1, 9)
    expect(ctx.fillRect).toHaveBeenCalledWith(104, 18, 1, 4)
    expect(ctx.fillRect).toHaveBeenCalledWith(13, 50, 9, 1)
    expect(ctx.fillText).toHaveBeenCalledWith('0', 102, 1)
    expect(ctx.fillText).toHaveBeenCalledWith('10', 122, 1)
    // X labels reset at the page edge (200 mm → 0); Y labels keep counting.
    expect(ctx.fillText).toHaveBeenCalledWith('0', 502, 1)
    expect(ctx.translate).toHaveBeenCalledWith(2, 62)
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 2)
    expect(ctx.fillText).toHaveBeenCalledWith('10', 0, 0)
  })

  it('places the spine marker for a two-page spread and hides it for one page', () => {
    const { container } = render(<Stage scrollRef={createRef()} />)
    const spine = container.querySelector<HTMLElement>('.ruler-spine')
    expect(spine?.hidden).toBe(false)
    expect(spine?.style.left).toBe('500px')
    cleanup()
    offsetWidth = 300
    const single = render(<Stage scrollRef={createRef()} />)
    expect(
      single.container.querySelector<HTMLElement>('.ruler-spine')?.hidden,
    ).toBe(true)
  })

  it('repaints once per frame on scroll and follows the spread', () => {
    render(<Stage scrollRef={createRef()} />)
    ctx.fillRect.mockClear()
    boxLeft = 222
    const scroll = screen.getByTestId('scroll')
    scroll.dispatchEvent(new Event('scroll'))
    scroll.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(1)
    flush()
    expect(ctx.fillRect).toHaveBeenCalledWith(200, 13, 1, 9)
    scroll.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(1)
  })

  it('repaints on a committed camera change', () => {
    render(<Stage scrollRef={createRef()} />)
    expect(frames).toHaveLength(0)
    camera.listener?.()
    expect(frames).toHaveLength(1)
  })

  it('shows the cursor ticks on pointer move and clears them on leave', () => {
    const { container } = render(<Stage scrollRef={createRef()} />)
    const stage = screen.getByTestId('stage')
    const cursorX = container.querySelector<HTMLElement>('.ruler-cursor-x')
    const cursorY = container.querySelector<HTMLElement>('.ruler-cursor-y')
    expect(cursorX?.hidden).toBe(true)
    expect(cursorY?.hidden).toBe(true)
    stage.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: 40,
        clientY: 35,
        bubbles: true,
      }),
    )
    expect(cursorX?.hidden).toBe(false)
    expect(cursorX?.style.left).toBe('18px')
    expect(cursorY?.hidden).toBe(false)
    expect(cursorY?.style.top).toBe('13px')
    stage.dispatchEvent(new MouseEvent('pointerleave'))
    expect(cursorX?.hidden).toBe(true)
    expect(cursorY?.hidden).toBe(true)
  })

  it('stays quiet while no spread is mounted or it has no width', () => {
    offsetWidth = 0
    render(<Stage scrollRef={createRef()} />)
    expect(ctx.fillRect).not.toHaveBeenCalled()
    expect(screen.getByTestId('ruler-x')).toBeTruthy()
  })

  it('falls back to any spread when none is marked active', () => {
    render(<Stage scrollRef={createRef()} active={false} />)
    expect(screen.getByTestId('ruler-x').dataset.origin).toBe('100')
  })

  it('paints at the device pixel ratio with the computed text style', () => {
    vi.stubGlobal('devicePixelRatio', 2)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontSize: '10px',
      fontFamily: 'Kit',
      color: 'rgb(1, 2, 3)',
    } as CSSStyleDeclaration)
    const { container } = render(<Stage scrollRef={createRef()} />)
    const [canvasX, canvasY] = container.querySelectorAll('canvas')
    expect([canvasX?.width, canvasX?.height]).toEqual([1000, 44])
    expect([canvasY?.width, canvasY?.height]).toEqual([44, 600])
    expect(ctx.scale).toHaveBeenCalledWith(2, 2)
    expect(ctx.font).toBe('10px Kit')
    expect(ctx.textBaseline).toBe('top')
    expect(ctx.fillStyle).toBe('rgb(1, 2, 3)')
  })

  it('still sizes the canvases when no 2d context is available', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { container } = render(<Stage scrollRef={createRef()} />)
    expect(container.querySelector('canvas')?.width).toBe(500)
    expect(ctx.scale).not.toHaveBeenCalled()
  })

  it('does nothing without a scroll area or a stage around it', () => {
    render(<Rulers scrollRef={createRef()} pageMm={200} />)
    expect(observers).toHaveLength(0)
    cleanup()
    const detached = document.createElement('div')
    render(<Rulers scrollRef={{ current: detached }} pageMm={200} />)
    detached.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(0)
    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  it('measures the cursor from a zero origin until a spread was measured', () => {
    offsetWidth = 0
    const { container } = render(<Stage scrollRef={createRef()} />)
    screen.getByTestId('stage').dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: 40,
        clientY: 35,
        bubbles: true,
      }),
    )
    expect(
      container.querySelector<HTMLElement>('.ruler-cursor-x')?.style.left,
    ).toBe('40px')
    expect(
      container.querySelector<HTMLElement>('.ruler-cursor-y')?.style.top,
    ).toBe('35px')
  })

  it('repaints when an observed box resizes', () => {
    render(<Stage scrollRef={createRef()} />)
    expect(frames).toHaveLength(0)
    observers[0]?.callback()
    expect(frames).toHaveLength(1)
  })

  it('observes the scroll area, its world and the spread once; follows a new active spread', () => {
    render(<Stage scrollRef={createRef()} />)
    const observe = observers[0]?.observe
    const scroll = screen.getByTestId('scroll')
    const spread = screen.getByTestId('spread-view')
    expect(observe).toHaveBeenCalledWith(scroll)
    expect(observe).toHaveBeenCalledWith(scroll.firstElementChild)
    expect(observe).toHaveBeenCalledWith(spread)
    camera.listener?.()
    flush()
    expect(observe?.mock.calls.filter(([el]) => el === spread)).toHaveLength(1)
    expect(observers[0]?.unobserve).not.toHaveBeenCalled()

    const next = document.createElement('div')
    next.dataset.testid = 'spread-view'
    const slot = document.createElement('div')
    slot.dataset.pasteboardSlot = ''
    slot.dataset.active = 'true'
    slot.append(next)
    spread.parentElement?.setAttribute('data-active', 'false')
    scroll.append(slot)
    camera.listener?.()
    flush()
    expect(observers[0]?.unobserve).toHaveBeenCalledWith(spread)
    expect(observe).toHaveBeenCalledWith(next)
  })

  it('registers a passive scroll listener', () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    render(<Stage scrollRef={createRef()} />)
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), {
      passive: true,
    })
  })

  it('repaints when the tree changes or the active mark moves, not on other attributes', async () => {
    render(<Stage scrollRef={createRef()} />)
    const scroll = screen.getByTestId('scroll')
    const slot = scroll.querySelector('[data-pasteboard-slot]')
    slot?.setAttribute('data-other', '1')
    await Promise.resolve()
    expect(frames).toHaveLength(0)
    slot?.setAttribute('data-active', 'false')
    await Promise.resolve()
    expect(frames).toHaveLength(1)
    flush()
    slot?.append(document.createElement('i'))
    await Promise.resolve()
    expect(frames).toHaveLength(1)
    flush()
    scroll.append(document.createElement('b'))
    await Promise.resolve()
    expect(frames).toHaveLength(1)
  })

  it('repaints with the new page width, but only when its inputs change', () => {
    const ref = createRef<HTMLDivElement>()
    const view = render(<Stage scrollRef={ref} pageMm={200} />)
    ctx.fillText.mockClear()
    view.rerender(<Stage scrollRef={ref} pageMm={200} />)
    expect(ctx.fillText).not.toHaveBeenCalled()
    view.rerender(<Stage scrollRef={ref} pageMm={100} />)
    // 100 mm page: mm 100 sits at 100 + 200 px and reads 0.
    expect(ctx.fillText).toHaveBeenCalledWith('0', 302, 1)
  })

  it('removes every listener and observer on unmount', async () => {
    const view = render(<Stage scrollRef={createRef()} />)
    const scroll = screen.getByTestId('scroll')
    const stage = screen.getByTestId('stage')
    const removeScroll = vi.spyOn(scroll, 'removeEventListener')
    const removeStage = vi.spyOn(stage, 'removeEventListener')
    view.unmount()
    expect(removeScroll).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(removeStage).toHaveBeenCalledWith(
      'pointermove',
      expect.any(Function),
    )
    expect(removeStage).toHaveBeenCalledWith(
      'pointerleave',
      expect.any(Function),
    )
    expect(observers[0]?.disconnect).toHaveBeenCalled()
    scroll.append(document.createElement('b'))
    await Promise.resolve()
    expect(frames).toHaveLength(0)
  })

  it('stops listening after unmount', () => {
    const view = render(<Stage scrollRef={createRef()} />)
    const scroll = screen.getByTestId('scroll')
    view.unmount()
    scroll.dispatchEvent(new Event('scroll'))
    expect(frames).toHaveLength(0)
    expect(camera.listener).toBeNull()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
