import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import { commitZoom, getCommittedCamera, getCommittedZoom } from './cameraStore'
import {
  restoreRevealSlotVisibility,
  turnPendingReveal,
  type PendingRevealState,
} from './pasteboardReveal'
import { nextTrackedScroll } from './pasteboardView'

type TurnFn = typeof turnPendingReveal

function findPasteboardSlot(
  scroll: HTMLElement,
  spreadId: string,
): HTMLElement | null {
  for (const slot of scroll.querySelectorAll<HTMLElement>(
    '[data-pasteboard-slot]',
  )) {
    if (slot.dataset.spreadId === spreadId) {
      return slot
    }
  }
  return null
}

export function usePasteboardReveal({
  scrollRef,
  worldRef,
  spreadIds,
  stride,
  windowKey,
  setTrackedScroll,
  turnFn = turnPendingReveal,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  worldRef: RefObject<HTMLDivElement | null>
  spreadIds: readonly string[]
  stride: number
  windowKey: string
  setTrackedScroll: Dispatch<SetStateAction<{ top: number; epoch: number }>>
  /**
   * Test seam: inject a turn planner so RTL can drive exact turn kinds without
   * stubbing layout geometry. Production always uses `turnPendingReveal`.
   */
  turnFn?: TurnFn
}): {
  holdCameraScrollRef: RefObject<boolean>
  beginRevealForNewSpread: (newSpreadId: string | null) => void
  /** Monotonic layout-turn counter; exposed for tests / diagnostics. */
  revealTick: number
} {
  const revealSpreadId = useRef<string | null>(null)
  const revealState = useRef<PendingRevealState>({
    tries: 0,
    paintConfirmed: false,
  })
  const revealSlotRef = useRef<HTMLElement | null>(null)
  const holdCameraScrollRef = useRef(false)
  /** Bumped to cancel a deferred hold release when a new reveal starts. */
  const holdReleaseGenRef = useRef(0)
  const [revealTick, setRevealTick] = useState(0)

  const clearRevealState = (): void => {
    restoreRevealSlotVisibility(revealSlotRef.current)
    revealSlotRef.current = null
    revealState.current = { tries: 0, paintConfirmed: false }
    revealSpreadId.current = null
  }

  /**
   * Drop hold after one frame so trailing scroll events from the last reveal
   * nudge still see hold=true (Pasteboard clears the add-spread pin on scroll
   * only when hold is false).
   */
  const scheduleHoldRelease = (): void => {
    const gen = ++holdReleaseGenRef.current
    requestAnimationFrame(() => {
      if (gen === holdReleaseGenRef.current) {
        holdCameraScrollRef.current = false
      }
    })
  }

  const beginRevealForNewSpread = (newSpreadId: string | null): void => {
    clearRevealState()
    // Cancel any deferred hold release from a prior reveal.
    holdReleaseGenRef.current += 1
    revealSpreadId.current = newSpreadId
    holdCameraScrollRef.current = newSpreadId !== null
    // Refs alone do not invalidate layout deps; bump tick so the turn runs.
    setRevealTick((tick) => tick + 1)
  }

  const scheduleRetry = (): void => {
    requestAnimationFrame(() => {
      setRevealTick((tick) => tick + 1)
    })
  }

  // Subscribe once on mount (stable scroll/world refs). Re-subscribing on every
  // spread change would drop in-flight size notifications mid-reveal.
  useEffect(() => {
    const scroll = scrollRef.current
    const world = worldRef.current
    if (
      scroll === null ||
      world === null ||
      typeof ResizeObserver === 'undefined'
    ) {
      return
    }
    const observer = new ResizeObserver(() => {
      if (revealSpreadId.current !== null) {
        setRevealTick((tick) => tick + 1)
      }
    })
    observer.observe(scroll)
    observer.observe(world)
    return () => {
      observer.disconnect()
    }
  }, [scrollRef, worldRef])

  useLayoutEffect(() => {
    const id = revealSpreadId.current
    if (id === null || windowKey.length === 0) {
      return
    }
    const scroll = scrollRef.current
    if (scroll === null) {
      return
    }
    const slot = findPasteboardSlot(scroll, id)
    const { turn, state } = turnFn({
      slot,
      scroll,
      spreadCount: spreadIds.length,
      stride,
      state: revealState.current,
    })
    revealState.current = state
    if (slot !== null) {
      revealSlotRef.current = slot
    }
    if (turn.kind === 'await-slot') {
      const epoch = getCommittedCamera().epoch
      setTrackedScroll((current) => nextTrackedScroll(current, turn.top, epoch))
      return
    }
    if (turn.kind === 'retry') {
      scheduleRetry()
      return
    }
    if (turn.kind === 'clear') {
      clearRevealState()
      scheduleHoldRelease()
      return
    }
    if (turn.kind === 'paint-confirm') {
      commitZoom(getCommittedZoom(), turn.scrollLeft, turn.scrollTop)
      const epoch = getCommittedCamera().epoch
      setTrackedScroll((current) =>
        nextTrackedScroll(current, turn.scrollTop, epoch),
      )
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRevealTick((tick) => tick + 1)
        })
      })
      return
    }
    if (turn.action === 'retry') {
      scheduleRetry()
      return
    }
    clearRevealState()
    scheduleHoldRelease()
  }, [
    scrollRef,
    setTrackedScroll,
    spreadIds,
    stride,
    windowKey,
    revealTick,
    turnFn,
  ])

  return { holdCameraScrollRef, beginRevealForNewSpread, revealTick }
}
