import { act, cleanup, render, screen } from '@testing-library/react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type RefObject,
  type SetStateAction,
} from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as cameraStore from './cameraStore'
import { getCommittedZoom, resetCameraStore } from './cameraStore'
import * as reveal from './pasteboardReveal'
import { usePasteboardReveal } from './usePasteboardReveal'

interface RevealApi {
  holdCameraScrollRef: RefObject<boolean>
  beginRevealForNewSpread: (newSpreadId: string | null) => void
  revealTick: number
}

interface TrackedScroll {
  top: number
  epoch: number
}

function Harness({
  spreadIds,
  stride = 100,
  windowKey,
  turnFn,
  onTrackedScroll,
  apiRef,
  scrollRefExternal,
}: {
  spreadIds: string[]
  stride?: number
  windowKey?: string
  turnFn?: typeof reveal.turnPendingReveal
  onTrackedScroll?: (value: TrackedScroll) => void
  apiRef: { current: RevealApi | null }
  scrollRefExternal?: RefObject<HTMLDivElement | null>
}): ReactElement {
  const localScrollRef = useRef<HTMLDivElement>(null)
  const scrollRef = scrollRefExternal ?? localScrollRef
  const worldRef = useRef<HTMLDivElement>(null)
  const [trackedScroll, setTrackedScrollState] = useState<TrackedScroll>({
    top: 0,
    epoch: 0,
  })
  const onTrackedScrollRef = useRef(onTrackedScroll)
  useEffect(() => {
    onTrackedScrollRef.current = onTrackedScroll
  }, [onTrackedScroll])
  const setTrackedScroll: Dispatch<SetStateAction<TrackedScroll>> = useCallback(
    (action) => {
      setTrackedScrollState((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        onTrackedScrollRef.current?.(next)
        return next
      })
    },
    [],
  )
  const revealApi = usePasteboardReveal({
    scrollRef,
    worldRef,
    spreadIds,
    stride,
    windowKey: windowKey ?? spreadIds.join('\0'),
    setTrackedScroll,
    ...(turnFn !== undefined ? { turnFn } : {}),
  })
  useEffect(() => {
    apiRef.current = revealApi
  }, [apiRef, revealApi])
  return (
    <div>
      <div data-testid="tracked-top">{trackedScroll.top}</div>
      <div ref={localScrollRef} data-testid="pasteboard-scroll">
        <div ref={worldRef} data-testid="pasteboard-world">
          {spreadIds.map((id, index) => (
            <div
              key={id}
              data-pasteboard-slot=""
              data-spread-id={id}
              data-slot-index={String(index)}
              data-testid="pasteboard-slot"
            >
              <div data-testid="spread-view" />
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          revealApi.beginRevealForNewSpread(
            spreadIds[spreadIds.length - 1] ?? null,
          )
        }}
      >
        Begin
      </button>
      <button
        type="button"
        onClick={() => {
          revealApi.beginRevealForNewSpread(null)
        }}
      >
        Begin null
      </button>
    </div>
  )
}

function flushRaf(rafQueue: FrameRequestCallback[], time = 0): void {
  const batch = rafQueue.splice(0, rafQueue.length)
  act(() => {
    for (const cb of batch) {
      cb(time)
    }
  })
}

function stubRaf(): FrameRequestCallback[] {
  const rafQueue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  return rafQueue
}

function stubResizeObserver(): {
  observers: ResizeObserverCallback[]
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
} {
  const observers: ResizeObserverCallback[] = []
  const observe = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        observers.push(cb)
      }
      observe = observe
      disconnect = disconnect
      unobserve(): void {
        /* no-op */
      }
    },
  )
  return { observers, observe, disconnect }
}

describe('usePasteboardReveal', () => {
  afterEach(() => {
    cleanup()
    resetCameraStore()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('on clear restores slot visibility, clears hold, and queues no rAF', () => {
    const rafQueue = stubRaf()
    const restore = vi.spyOn(reveal, 'restoreRevealSlotVisibility')
    const apiRef: { current: RevealApi | null } = { current: null }
    const turnFn: typeof reveal.turnPendingReveal = () => ({
      turn: { kind: 'clear' },
      state: { tries: 8, paintConfirmed: false },
    })

    render(
      <Harness spreadIds={['a', 'b', 'c']} turnFn={turnFn} apiRef={apiRef} />,
    )
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })

    const slot = screen.getAllByTestId('pasteboard-slot').at(-1)
    expect(slot).toBeInstanceOf(HTMLElement)
    expect(restore).toHaveBeenCalledWith(slot)
    expect(apiRef.current?.holdCameraScrollRef.current).toBe(false)
    expect(rafQueue).toHaveLength(0)
  })

  it('bumps revealTick forward on begin', () => {
    const apiRef: { current: RevealApi | null } = { current: null }
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>().mockReturnValue({
      turn: { kind: 'retry' },
      state: { tries: 1, paintConfirmed: false },
    })
    stubRaf()
    render(<Harness spreadIds={['a', 'b']} turnFn={turnFn} apiRef={apiRef} />)
    expect(apiRef.current?.revealTick).toBe(0)
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })
    expect(apiRef.current?.revealTick).toBe(1)
  })

  it('on paint-confirm commits zoom, tracks scroll, and runs two nested rAFs', () => {
    const rafQueue = stubRaf()
    const commitSpy = vi.spyOn(cameraStore, 'commitZoom')
    const tracked: TrackedScroll[] = []
    const apiRef: { current: RevealApi | null } = { current: null }
    let calls = 0
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>(() => {
      calls += 1
      if (calls === 1) {
        return {
          turn: { kind: 'paint-confirm', scrollLeft: 12, scrollTop: 34 },
          state: { tries: 0, paintConfirmed: true },
        }
      }
      return {
        turn: { kind: 'post-paint', action: 'complete' },
        state: { tries: 0, paintConfirmed: true },
      }
    })

    render(
      <Harness
        spreadIds={['a', 'b', 'c', 'd']}
        turnFn={turnFn}
        apiRef={apiRef}
        onTrackedScroll={(value) => {
          tracked.push(value)
        }}
      />,
    )
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })

    expect(commitSpy).toHaveBeenCalledWith(getCommittedZoom(), 12, 34)
    expect(tracked.some((value) => value.top === 34)).toBe(true)
    expect(screen.getByTestId('tracked-top').textContent).toBe('34')
    expect(rafQueue).toHaveLength(1)
    expect(apiRef.current?.revealTick).toBe(1)
    flushRaf(rafQueue, 1)
    expect(rafQueue).toHaveLength(1)
    flushRaf(rafQueue, 2)
    expect(turnFn).toHaveBeenCalledTimes(2)
    expect(apiRef.current?.revealTick).toBe(2)
  })

  it('on post-paint retry queues exactly one rAF and keeps hold true', () => {
    const rafQueue = stubRaf()
    const apiRef: { current: RevealApi | null } = { current: null }
    const turnFn: typeof reveal.turnPendingReveal = () => ({
      turn: { kind: 'post-paint', action: 'retry' },
      state: { tries: 1, paintConfirmed: false },
    })

    render(<Harness spreadIds={['a', 'b']} turnFn={turnFn} apiRef={apiRef} />)
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })

    expect(rafQueue).toHaveLength(1)
    expect(apiRef.current?.holdCameraScrollRef.current).toBe(true)
  })

  it('beginRevealForNewSpread(null) clears hold and runs no turn', () => {
    const apiRef: { current: RevealApi | null } = { current: null }
    const restore = vi.spyOn(reveal, 'restoreRevealSlotVisibility')
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>().mockReturnValue({
      turn: { kind: 'retry' },
      state: { tries: 1, paintConfirmed: false },
    })
    stubRaf()

    render(<Harness spreadIds={['a', 'b']} turnFn={turnFn} apiRef={apiRef} />)
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })
    const slot = screen.getAllByTestId('pasteboard-slot').at(-1)
    restore.mockClear()
    act(() => {
      screen.getByRole('button', { name: 'Begin null' }).click()
    })

    expect(apiRef.current?.holdCameraScrollRef.current).toBe(false)
    expect(restore).toHaveBeenCalledWith(slot)
    expect(turnFn).toHaveBeenCalledTimes(1)
  })

  it('skips turns when windowKey is empty', () => {
    const apiRef: { current: RevealApi | null } = { current: null }
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>()

    render(
      <Harness
        spreadIds={['a']}
        windowKey=""
        turnFn={turnFn}
        apiRef={apiRef}
      />,
    )
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })
    expect(turnFn).not.toHaveBeenCalled()
  })

  it('skips the layout turn when scroll ref is null', () => {
    const apiRef: { current: RevealApi | null } = { current: null }
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>()
    const nullScrollRef: RefObject<HTMLDivElement | null> = { current: null }

    render(
      <Harness
        spreadIds={['a', 'b']}
        turnFn={turnFn}
        apiRef={apiRef}
        scrollRefExternal={nullScrollRef}
      />,
    )
    act(() => {
      apiRef.current?.beginRevealForNewSpread('b')
    })
    expect(turnFn).not.toHaveBeenCalled()
  })

  it('ResizeObserver triggers exactly one extra turn while pending and none while idle', () => {
    const { observers, observe, disconnect } = stubResizeObserver()
    stubRaf()
    const apiRef: { current: RevealApi | null } = { current: null }
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>().mockReturnValue({
      turn: { kind: 'retry' },
      state: { tries: 1, paintConfirmed: false },
    })

    const view = render(
      <Harness spreadIds={['a', 'b']} turnFn={turnFn} apiRef={apiRef} />,
    )
    expect(observers).toHaveLength(1)
    expect(observe).toHaveBeenCalledTimes(2)

    act(() => {
      observers[0]?.([], {} as ResizeObserver)
    })
    expect(turnFn).toHaveBeenCalledTimes(0)

    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })
    expect(turnFn).toHaveBeenCalledTimes(1)
    const afterBegin = turnFn.mock.calls.length

    act(() => {
      observers[0]?.([], {} as ResizeObserver)
    })
    expect(turnFn).toHaveBeenCalledTimes(afterBegin + 1)

    view.unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('does not subscribe ResizeObserver when the API is missing', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const apiRef: { current: RevealApi | null } = { current: null }
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>().mockReturnValue({
      turn: { kind: 'retry' },
      state: { tries: 1, paintConfirmed: false },
    })
    stubRaf()

    expect(() => {
      render(<Harness spreadIds={['a', 'b']} turnFn={turnFn} apiRef={apiRef} />)
    }).not.toThrow()
  })

  it('applies await-slot, paint-confirm, retry, then complete turns in order', () => {
    const rafQueue = stubRaf()
    const { observers } = stubResizeObserver()
    const restore = vi.spyOn(reveal, 'restoreRevealSlotVisibility')
    const apiRef: { current: RevealApi | null } = { current: null }
    const sequence: ReturnType<typeof reveal.turnPendingReveal>[] = [
      {
        turn: { kind: 'await-slot', top: 400 },
        state: { tries: 0, paintConfirmed: false },
      },
      {
        turn: { kind: 'paint-confirm', scrollLeft: 12, scrollTop: 34 },
        state: { tries: 0, paintConfirmed: true },
      },
      {
        turn: { kind: 'post-paint', action: 'retry' },
        state: { tries: 1, paintConfirmed: false },
      },
      {
        turn: { kind: 'post-paint', action: 'complete' },
        state: { tries: 1, paintConfirmed: true },
      },
    ]
    let calls = 0
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>(() => {
      const next = sequence[calls]
      calls += 1
      if (next === undefined) {
        return {
          turn: { kind: 'clear' },
          state: { tries: 0, paintConfirmed: false },
        }
      }
      return next
    })

    render(
      <Harness
        spreadIds={['a', 'b', 'c', 'd']}
        turnFn={turnFn}
        apiRef={apiRef}
      />,
    )
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })
    expect(turnFn).toHaveBeenCalledTimes(1)
    expect(turnFn.mock.results[0]?.value.turn).toEqual({
      kind: 'await-slot',
      top: 400,
    })
    expect(rafQueue).toHaveLength(0)
    expect(screen.getByTestId('tracked-top').textContent).toBe('400')

    act(() => {
      observers[0]?.([], {} as ResizeObserver)
    })
    expect(turnFn).toHaveBeenCalledTimes(2)
    expect(turnFn.mock.results[1]?.value.turn.kind).toBe('paint-confirm')
    expect(rafQueue).toHaveLength(1)
    flushRaf(rafQueue, 1)
    expect(rafQueue).toHaveLength(1)
    flushRaf(rafQueue, 2)

    expect(turnFn).toHaveBeenCalledTimes(3)
    expect(turnFn.mock.results[2]?.value.turn).toEqual({
      kind: 'post-paint',
      action: 'retry',
    })
    expect(rafQueue).toHaveLength(1)
    expect(apiRef.current?.holdCameraScrollRef.current).toBe(true)
    flushRaf(rafQueue, 3)

    expect(turnFn).toHaveBeenCalledTimes(4)
    expect(turnFn.mock.results[3]?.value.turn).toEqual({
      kind: 'post-paint',
      action: 'complete',
    })
    expect(restore).toHaveBeenCalled()
    expect(apiRef.current?.holdCameraScrollRef.current).toBe(false)
    expect(rafQueue).toHaveLength(0)
  })

  it('keeps the same tracked scroll object when await-slot repeats the same top', () => {
    const { observers } = stubResizeObserver()
    const apiRef: { current: RevealApi | null } = { current: null }
    const identities: TrackedScroll[] = []
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>().mockReturnValue({
      turn: { kind: 'await-slot', top: 400 },
      state: { tries: 0, paintConfirmed: false },
    })

    render(
      <Harness
        spreadIds={['a', 'b', 'c', 'd']}
        turnFn={turnFn}
        apiRef={apiRef}
        onTrackedScroll={(value) => {
          identities.push(value)
        }}
      />,
    )
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })
    expect(identities).toHaveLength(1)
    act(() => {
      observers[0]?.([], {} as ResizeObserver)
    })
    expect(identities).toHaveLength(2)
    expect(identities[1]).toBe(identities[0])
  })

  it('exhausts retries when reveal never contains and restores visibility', () => {
    const rafQueue = stubRaf()
    const restore = vi.spyOn(reveal, 'restoreRevealSlotVisibility')
    const apiRef: { current: RevealApi | null } = { current: null }
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>((input) => {
      const tries = input.state.tries + 1
      return {
        turn:
          tries < reveal.REVEAL_TRY_CEILING
            ? { kind: 'retry' }
            : { kind: 'clear' },
        state: { tries, paintConfirmed: false },
      }
    })

    render(
      <Harness
        spreadIds={['a', 'b', 'c', 'd']}
        turnFn={turnFn}
        apiRef={apiRef}
      />,
    )
    act(() => {
      screen.getByRole('button', { name: 'Begin' }).click()
    })
    for (let i = 0; i < reveal.REVEAL_TRY_CEILING + 4; i += 1) {
      if (rafQueue.length === 0) {
        break
      }
      flushRaf(rafQueue, i)
    }
    expect(restore).toHaveBeenCalled()
    expect(apiRef.current?.holdCameraScrollRef.current).toBe(false)
    expect(rafQueue).toHaveLength(0)
  })
})
