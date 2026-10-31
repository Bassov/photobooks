import { describe, expect, it } from 'vitest'
import {
  filmstripWheelDelta,
  installFilmstripWheel,
  WHEEL_LINE_PX,
} from './filmstripWheel'

describe('filmstripWheelDelta', () => {
  it('maps a vertical wheel to horizontal pixels', () => {
    expect(
      filmstripWheelDelta({ deltaX: 0, deltaY: 300, deltaMode: 0 }, 900),
    ).toBe(300)
    expect(
      filmstripWheelDelta({ deltaX: 2, deltaY: -120, deltaMode: 0 }, 900),
    ).toBe(-120)
  })

  it('keeps a horizontal swipe on its own axis', () => {
    expect(
      filmstripWheelDelta({ deltaX: 40, deltaY: 10, deltaMode: 0 }, 900),
    ).toBe(40)
    expect(
      filmstripWheelDelta({ deltaX: -30, deltaY: 30, deltaMode: 0 }, 900),
    ).toBe(-30)
  })

  it('scales line and page modes', () => {
    expect(
      filmstripWheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 }, 900),
    ).toBe(3 * WHEEL_LINE_PX)
    expect(WHEEL_LINE_PX).toBe(16)
    expect(
      filmstripWheelDelta({ deltaX: 0, deltaY: -1, deltaMode: 2 }, 900),
    ).toBe(-900)
  })
})

describe('installFilmstripWheel', () => {
  it('is a no-op without a node', () => {
    expect(installFilmstripWheel(null)).toBeUndefined()
  })

  it('scrolls the node sideways and keeps the wheel from the page', () => {
    const node = document.createElement('div')
    let left = 0
    Object.defineProperty(node, 'scrollLeft', {
      get: () => left,
      set: (value: number) => {
        left = value
      },
    })
    const cleanup = installFilmstripWheel(node)
    const event = new WheelEvent('wheel', {
      deltaY: 300,
      cancelable: true,
      bubbles: true,
    })
    const outer = document.createElement('div')
    outer.append(node)
    let reached = false
    outer.addEventListener('wheel', (e) => {
      reached = e.defaultPrevented
    })
    node.dispatchEvent(event)
    expect(left).toBe(300)
    expect(event.defaultPrevented).toBe(true)
    expect(reached).toBe(true)

    cleanup?.()
    const after = new WheelEvent('wheel', { deltaY: 300, cancelable: true })
    node.dispatchEvent(after)
    expect(left).toBe(300)
    expect(after.defaultPrevented).toBe(false)
  })
})
