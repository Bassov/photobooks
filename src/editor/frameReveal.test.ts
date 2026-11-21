import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
} from './photoRootSession'
import { revealDelta, revealFrames, type ClientBox } from './frameReveal'

const VIEW: ClientBox = { left: 0, top: 0, right: 400, bottom: 300 }
const at = (left: number, top: number, w = 100, h = 100): ClientBox => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
})

describe('revealDelta', () => {
  it('stays when at least half of the box shows', () => {
    expect(revealDelta(at(50, 50), VIEW)).toStrictEqual({ dx: 0, dy: 0 })
    expect(revealDelta(at(350, 50), VIEW)).toStrictEqual({ dx: 0, dy: 0 })
    expect(revealDelta(at(-50, 50), VIEW)).toStrictEqual({ dx: 0, dy: 0 })
  })

  it('scrolls the least to show the whole box when less than half shows', () => {
    expect(revealDelta(at(351, 50), VIEW)).toStrictEqual({ dx: 51, dy: 0 })
    expect(revealDelta(at(50, -60), VIEW)).toStrictEqual({ dx: 0, dy: -60 })
    expect(revealDelta(at(500, 400), VIEW)).toStrictEqual({ dx: 200, dy: 200 })
    expect(revealDelta(at(-300, 250), VIEW)).toStrictEqual({ dx: -300, dy: 50 })
  })

  it('centres the box on an axis where it is bigger than the view', () => {
    expect(revealDelta(at(-600, 500, 1000, 100), VIEW)).toStrictEqual({
      dx: -300,
      dy: 300,
    })
    expect(revealDelta(at(500, -400, 100, 1000), VIEW)).toStrictEqual({
      dx: 200,
      dy: -50,
    })
  })
})

describe('revealFrames', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    resetActiveSpreadIdForTests()
  })

  function mount(frameBox: ClientBox | null) {
    document.body.innerHTML = `<div class="pasteboard-scroll"><div data-spread-id="s"><button class="spread-frame" data-frame-id="f"></button></div></div>`
    const port = document.querySelector<HTMLElement>('.pasteboard-scroll')
    const frame = document.querySelector('button')
    if (port === null || frame === null) {
      throw new Error('not mounted')
    }
    if (frameBox === null) {
      frame.remove()
    }
    port.getBoundingClientRect = () =>
      DOMRect.fromRect({ width: 400, height: 300 })
    frame.getBoundingClientRect = () =>
      DOMRect.fromRect({
        x: frameBox?.left ?? 0,
        y: frameBox?.top ?? 0,
        width: 100,
        height: 100,
      })
    const scrollBy = vi.fn()
    port.scrollBy = scrollBy as typeof port.scrollBy
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    return scrollBy
  }

  it('scrolls the pasteboard by the reveal delta after a frame', () => {
    const scrollBy = mount(at(500, 400))
    revealFrames('s', ['f', 'missing'])
    expect(scrollBy).toHaveBeenCalledWith({
      left: 200,
      top: 200,
      behavior: 'instant',
    })
  })

  it('scrolls on one axis only', () => {
    const scrollBy = mount(at(351, 50))
    revealFrames('s', ['f'])
    expect(scrollBy).toHaveBeenCalledWith({
      left: 51,
      top: 0,
      behavior: 'instant',
    })
    const scrollY = mount(at(50, -60))
    revealFrames('s', ['f'])
    expect(scrollY).toHaveBeenCalledWith({
      left: 0,
      top: -60,
      behavior: 'instant',
    })
  })

  it('leaves a shown frame and reveals an unmounted spread', () => {
    const scrollBy = mount(at(10, 10))
    revealFrames('s', ['f'])
    expect(scrollBy).not.toHaveBeenCalled()
    mount(null)
    revealFrames('s', ['f'])
    expect(getActiveSpreadId()).toBe('s')
  })

  it('does nothing without a pasteboard', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    expect(() => {
      revealFrames('s', ['f'])
    }).not.toThrow()
    expect(getActiveSpreadId()).toBeNull()
  })
})
