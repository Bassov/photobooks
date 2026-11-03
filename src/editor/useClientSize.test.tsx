import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useClientSize } from './useClientSize'

/** ResizeObserver stand-in: `resize()` calls back only for observed, connected nodes. */
class FakeObserver {
  static all: FakeObserver[] = []
  readonly nodes = new Set<Element>()
  constructor(private readonly callback: () => void) {
    FakeObserver.all.push(this)
  }
  observe(node: Element): void {
    this.nodes.add(node)
  }
  disconnect(): void {
    this.nodes.clear()
  }
  static resize(): void {
    for (const observer of FakeObserver.all) {
      if (observer.nodes.size > 0) {
        observer.callback()
      }
    }
  }
}

function Probe() {
  const [size, attach] = useClientSize()
  return (
    <div ref={attach} data-testid="probe">
      {size === null ? 'none' : `${String(size.width)}x${String(size.height)}`}
    </div>
  )
}

function mockClientSize(width: number, height: number): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
}

describe('useClientSize', () => {
  afterEach(() => {
    cleanup()
    FakeObserver.all = []
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('measures on attach and again on every resize', () => {
    vi.stubGlobal('ResizeObserver', FakeObserver)
    mockClientSize(320, 200)
    render(<Probe />)
    const first = screen.getByTestId('probe').textContent

    mockClientSize(400, 250)
    act(() => {
      FakeObserver.resize()
    })

    expect(first).toBe('320x200')
    expect(screen.getByTestId('probe').textContent).toBe('400x250')
  })

  it('keeps one observer across re-renders and disconnects on unmount', () => {
    vi.stubGlobal('ResizeObserver', FakeObserver)
    mockClientSize(320, 200)
    const { rerender, unmount } = render(<Probe />)
    rerender(<Probe />)
    const observers = FakeObserver.all.length

    unmount()

    expect(observers).toBe(1)
    expect(FakeObserver.all[0]?.nodes.size).toBe(0)
  })

  it('exposes the attached element through its ref', () => {
    vi.stubGlobal('ResizeObserver', FakeObserver)
    let seen: HTMLDivElement | null = null
    function RefProbe() {
      const [, attach, ref] = useClientSize()
      return (
        <div
          ref={attach}
          data-testid="probe"
          onClick={() => {
            seen = ref.current
          }}
        />
      )
    }
    render(<RefProbe />)
    const probe = screen.getByTestId('probe')

    probe.click()

    expect(seen).toBe(probe)
  })
})
