import { describe, expect, it } from 'vitest'
import {
  filmstripWheelDelta,
  installFilmstripWheel,
  WHEEL_LINE_PX,
} from './filmstripWheel'

describe('filmstripWheelDelta', () => {
  it('maps a vertical wheel to horizontal pixels', () => {
    expect(filmstripWheelDelta({ deltaY: 300, deltaMode: 0 }, 900)).toBe(300)
    expect(filmstripWheelDelta({ deltaY: -120, deltaMode: 0 }, 900)).toBe(-120)
  })

  it('scales line and page modes', () => {
    expect(filmstripWheelDelta({ deltaY: 3, deltaMode: 1 }, 900)).toBe(
      3 * WHEEL_LINE_PX,
    )
    expect(WHEEL_LINE_PX).toBe(16)
    expect(filmstripWheelDelta({ deltaY: -1, deltaMode: 2 }, 900)).toBe(-900)
  })
})

function scroller() {
  const node = document.createElement('div')
  let left = 0
  Object.defineProperty(node, 'scrollLeft', {
    get: () => left,
    set: (value: number) => {
      left = value
    },
  })
  Object.defineProperty(node, 'clientWidth', { value: 900 })
  return { node, left: () => left }
}

function wheel(init: WheelEventInit): WheelEvent {
  return new WheelEvent('wheel', { cancelable: true, bubbles: true, ...init })
}

describe('installFilmstripWheel', () => {
  it('is a no-op without a node', () => {
    expect(installFilmstripWheel(null)).toBeUndefined()
  })

  it('scrolls the node sideways on a vertical wheel, passively', () => {
    const strip = scroller()
    const cleanup = installFilmstripWheel(strip.node)
    const event = wheel({ deltaX: 2, deltaY: 300 })
    strip.node.dispatchEvent(event)
    expect(strip.left()).toBe(300)
    // Passive: the browser keeps the default (no long-frame blocking handler).
    expect(event.defaultPrevented).toBe(false)
    strip.node.dispatchEvent(wheel({ deltaY: 1, deltaMode: 2 }))
    expect(strip.left()).toBe(1200)

    cleanup?.()
    strip.node.dispatchEvent(wheel({ deltaY: 300 }))
    expect(strip.left()).toBe(1200)
  })

  it('leaves a horizontal swipe to the native scroll', () => {
    const strip = scroller()
    installFilmstripWheel(strip.node)
    strip.node.dispatchEvent(wheel({ deltaX: 40, deltaY: 10 }))
    strip.node.dispatchEvent(wheel({ deltaX: -30, deltaY: 30 }))
    expect(strip.left()).toBe(0)
  })
})
