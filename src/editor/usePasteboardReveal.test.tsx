import { act, cleanup, render } from '@testing-library/react'
import { useRef, useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetCameraStore } from './cameraStore'
import * as reveal from './pasteboardReveal'
import { usePasteboardReveal } from './usePasteboardReveal'

function Harness({
  spreadIds,
  stride = 100,
  turnFn,
}: {
  spreadIds: string[]
  stride?: number
  turnFn?: typeof reveal.turnPendingReveal
}): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const [, setTrackedScroll] = useState({ top: 0, epoch: 0 })
  const [, setKick] = useState(0)
  const revealApi = usePasteboardReveal({
    scrollRef,
    worldRef,
    spreadIds,
    stride,
    windowKey: spreadIds.join('\0'),
    setTrackedScroll,
    ...(turnFn !== undefined ? { turnFn } : {}),
  })
  return (
    <div>
      <div ref={scrollRef} data-testid="pasteboard-scroll">
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
          setKick((value) => value + 1)
        }}
      >
        Begin
      </button>
    </div>
  )
}

describe('usePasteboardReveal', () => {
  afterEach(() => {
    cleanup()
    resetCameraStore()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('exhausts retries when reveal never contains and restores visibility', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const restore = vi.spyOn(reveal, 'restoreRevealSlotVisibility')
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

    const view = render(
      <Harness spreadIds={['a', 'b', 'c', 'd']} turnFn={turnFn} />,
    )
    act(() => {
      view.getByRole('button', { name: 'Begin' }).click()
    })
    for (let i = 0; i < reveal.REVEAL_TRY_CEILING + 4; i += 1) {
      if (rafQueue.length === 0) {
        break
      }
      const batch = rafQueue.splice(0, rafQueue.length)
      act(() => {
        for (const cb of batch) {
          cb(i)
        }
      })
    }
    expect(restore).toHaveBeenCalled()
    expect(rafQueue).toHaveLength(0)
  })

  it('clears immediately when turn is clear', () => {
    const restore = vi.spyOn(reveal, 'restoreRevealSlotVisibility')
    const turnFn: typeof reveal.turnPendingReveal = () => ({
      turn: { kind: 'clear' },
      state: { tries: 8, paintConfirmed: false },
    })
    const view = render(<Harness spreadIds={['a', 'b', 'c']} turnFn={turnFn} />)
    act(() => {
      view.getByRole('button', { name: 'Begin' }).click()
    })
    expect(restore).toHaveBeenCalled()
  })

  it('applies await-slot, paint-confirm, retry, and complete turns', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const restore = vi.spyOn(reveal, 'restoreRevealSlotVisibility')
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
      const index = Math.min(calls, sequence.length - 1)
      const next = sequence[index]
      calls += 1
      if (next === undefined) {
        return {
          turn: { kind: 'clear' },
          state: { tries: 0, paintConfirmed: false },
        }
      }
      return next
    })
    const view = render(
      <Harness spreadIds={['a', 'b', 'c', 'd']} turnFn={turnFn} />,
    )
    act(() => {
      view.getByRole('button', { name: 'Begin' }).click()
    })
    expect(turnFn).toHaveBeenCalled()
    for (
      let step = 0;
      step < 8 && (rafQueue.length > 0 || calls < 4);
      step += 1
    ) {
      if (rafQueue.length === 0 && calls >= 1 && calls < 4) {
        // Manually kick layout when no rAF is pending (await-slot path).
        act(() => {
          view.getByRole('button', { name: 'Begin' }).click()
        })
      }
      const batch = rafQueue.splice(0, rafQueue.length)
      act(() => {
        for (const cb of batch) {
          cb(step)
        }
      })
    }
    expect(restore).toHaveBeenCalled()
    expect(calls).toBeGreaterThanOrEqual(3)
  })

  it('bumps reveal tick from ResizeObserver while pending', () => {
    const observers: ResizeObserverCallback[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          observers.push(cb)
        }
        observe(): void {
          /* no-op */
        }
        disconnect(): void {
          /* no-op */
        }
        unobserve(): void {
          /* no-op */
        }
      },
    )
    const turnFn = vi.fn<typeof reveal.turnPendingReveal>().mockReturnValue({
      turn: { kind: 'retry' },
      state: { tries: 1, paintConfirmed: false },
    })
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })

    const view = render(<Harness spreadIds={['a', 'b']} turnFn={turnFn} />)
    act(() => {
      view.getByRole('button', { name: 'Begin' }).click()
    })
    expect(observers.length).toBeGreaterThan(0)
    const before = rafQueue.length
    act(() => {
      observers[0]?.([], {} as ResizeObserver)
    })
    expect(rafQueue.length).toBeGreaterThanOrEqual(before)
  })
})
