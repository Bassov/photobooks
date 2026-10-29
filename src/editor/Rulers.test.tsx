import { cleanup, render, screen } from '@testing-library/react'
import { createRef, type RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Rulers } from './Rulers'

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

function Stage({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div data-testid="stage">
      <div ref={scrollRef} data-testid="scroll">
        <div data-pasteboard-slot="" data-active="true">
          <div data-testid="spread-view" />
        </div>
      </div>
      <Rulers scrollRef={scrollRef} pageMm={200} />
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
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
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
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders both strips and the mm corner', () => {
    render(<Stage scrollRef={createRef()} />)
    expect(screen.getByTestId('ruler-x')).toBeTruthy()
    expect(screen.getByTestId('ruler-y')).toBeTruthy()
    expect(screen.getByTestId('ruler-corner').textContent).toBe('mm')
  })

  it('paints ticks and labels at the spread origin and scale', () => {
    const { container } = render(<Stage scrollRef={createRef()} />)
    const [canvasX, canvasY] = container.querySelectorAll('canvas')
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
