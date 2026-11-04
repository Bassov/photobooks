import { act, cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useViewport, type Viewport } from './useViewport'

const size = { width: 1440, height: 900 }
const observers: {
  callback: () => void
  disconnect: ReturnType<typeof vi.fn>
}[] = []
const seen: (Viewport | null)[] = []

function Probe({ attach = true }: { attach?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  seen.push(useViewport(ref))
  return attach ? <div ref={ref} /> : null
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    () => size.width,
  )
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockImplementation(
    () => size.height,
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = vi.fn()
      constructor(callback: () => void) {
        observers.push({ callback, disconnect: this.disconnect })
      }
      observe() {
        return undefined
      }
    },
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  observers.length = 0
  seen.length = 0
  Object.assign(size, { width: 1440, height: 900 })
})

describe('useViewport', () => {
  it('is null in the first render, then the root width and window height', () => {
    render(<Probe />)

    expect(seen[0]).toBeNull()
    expect(seen.at(-1)).toStrictEqual({ vw: 1440, vh: 900 })
  })

  it('follows root resizes and window resizes, keeping the value when nothing moved', () => {
    render(<Probe />)
    const settled = seen.at(-1)

    act(() => {
      observers[0]?.callback()
    })
    expect(seen.at(-1)).toBe(settled)

    size.width = 390
    act(() => {
      observers[0]?.callback()
    })
    expect(seen.at(-1)).toStrictEqual({ vw: 390, vh: 900 })

    size.height = 844
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(seen.at(-1)).toStrictEqual({ vw: 390, vh: 844 })
  })

  it('stops observing on unmount', () => {
    const { unmount } = render(<Probe />)
    const count = seen.length

    unmount()
    size.width = 500
    window.dispatchEvent(new Event('resize'))

    expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1)
    expect(seen).toHaveLength(count)
  })

  it('stays null without an element', () => {
    render(<Probe attach={false} />)

    expect(seen.every((value) => value === null)).toBe(true)
    expect(observers).toHaveLength(0)
  })
})
