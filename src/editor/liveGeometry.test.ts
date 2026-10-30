import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearLiveGeometry,
  getLiveGeometry,
  liveGeometryFor,
  publishLiveGeometry,
  subscribeLiveGeometry,
  type LiveGeometry,
} from './liveGeometry'

const geo = (width: number): LiveGeometry => ({
  spreadId: 's1',
  frameId: 'f1',
  rect: { x: 0, y: 0, width, height: 10 },
  rotationDeg: 0,
})

describe('liveGeometry', () => {
  afterEach(() => {
    clearLiveGeometry()
    vi.unstubAllGlobals()
  })

  it('coalesces publishes to one notification per animation frame', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      frames.push(cb),
    )
    const listener = vi.fn()
    const off = subscribeLiveGeometry(listener)
    publishLiveGeometry(geo(10))
    publishLiveGeometry(geo(20))
    expect(frames).toHaveLength(1)
    expect(getLiveGeometry()).toBeNull()
    frames[0]?.(0)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getLiveGeometry()?.rect.width).toBe(20)
    off()
  })

  it('clear drops the pending frame and notifies once', () => {
    const cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', () => 7)
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const listener = vi.fn()
    const off = subscribeLiveGeometry(listener)
    publishLiveGeometry(geo(10))
    clearLiveGeometry()
    expect(cancel).toHaveBeenCalledWith(7)
    expect(listener).not.toHaveBeenCalled()
    expect(getLiveGeometry()).toBeNull()
    off()
  })

  it('unsubscribe stops notifications; clear without a frame is silent', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const listener = vi.fn()
    const off = subscribeLiveGeometry(listener)
    off()
    clearLiveGeometry()
    expect(cancel).not.toHaveBeenCalled()
    publishLiveGeometry(geo(10))
    expect(listener).not.toHaveBeenCalled()
  })

  it('matches only the dragged frame', () => {
    const live = geo(10)
    expect(liveGeometryFor(live, 's1', 'f1')).toBe(live)
    expect(liveGeometryFor(live, 's1', 'f2')).toBeNull()
    expect(liveGeometryFor(live, 's2', 'f1')).toBeNull()
    expect(liveGeometryFor(null, 's1', 'f1')).toBeNull()
  })
})
