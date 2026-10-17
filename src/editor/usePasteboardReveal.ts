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
  isScrollNearMax,
  planRevealAttempt,
  revealLaidOutSpread,
  spreadBoxContained,
} from './pasteboardReveal'

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
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  worldRef: RefObject<HTMLDivElement | null>
  spreadIds: readonly string[]
  stride: number
  windowKey: string
  setTrackedScroll: Dispatch<SetStateAction<{ top: number; epoch: number }>>
}): {
  holdCameraScrollRef: RefObject<boolean>
  beginRevealForNewSpread: (newSpreadId: string | null) => void
} {
  const revealSpreadId = useRef<string | null>(null)
  const revealTries = useRef(0)
  const revealPaintConfirm = useRef(false)
  const revealSlotRef = useRef<HTMLElement | null>(null)
  const holdCameraScrollRef = useRef(false)
  const [revealTick, setRevealTick] = useState(0)

  const clearReveal = (restoreVisibility: boolean): void => {
    const slot = revealSlotRef.current
    if (slot !== null) {
      if (restoreVisibility) {
        slot.style.contentVisibility = ''
      }
      revealSlotRef.current = null
    }
    revealTries.current = 0
    revealPaintConfirm.current = false
    revealSpreadId.current = null
    holdCameraScrollRef.current = false
  }

  const beginRevealForNewSpread = (newSpreadId: string | null): void => {
    clearReveal(true)
    revealSpreadId.current = newSpreadId
    holdCameraScrollRef.current = newSpreadId !== null
  }

  useEffect(() => {
    if (revealSpreadId.current === null) {
      return
    }
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
  }, [scrollRef, spreadIds.length, worldRef])

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
    const epoch = getCommittedCamera().epoch
    if (slot === null) {
      const top = Math.max(0, (spreadIds.length - 1) * stride)
      setTrackedScroll((current) =>
        current.top === top && current.epoch === epoch
          ? current
          : { top, epoch },
      )
      return
    }
    revealSlotRef.current = slot
    const revealed = revealLaidOutSpread(scroll, slot)
    const atMaxScroll = isScrollNearMax(
      scroll.scrollTop,
      scroll.scrollHeight,
      scroll.clientHeight,
    )
    if (!revealed) {
      revealPaintConfirm.current = false
      revealTries.current += 1
      const plan = planRevealAttempt({
        revealed: false,
        atMaxScroll,
        tries: revealTries.current,
        paintConfirmed: false,
        containedAfterPaint: false,
      })
      if (plan.kind === 'retry') {
        requestAnimationFrame(() => {
          setRevealTick((tick) => tick + 1)
        })
        return
      }
      clearReveal(true)
      return
    }
    commitZoom(getCommittedZoom(), scroll.scrollLeft, scroll.scrollTop)
    const top = scroll.scrollTop
    const committedEpoch = getCommittedCamera().epoch
    setTrackedScroll((current) =>
      current.top === top && current.epoch === committedEpoch
        ? current
        : { top, epoch: committedEpoch },
    )
    if (!revealPaintConfirm.current) {
      revealPaintConfirm.current = true
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRevealTick((tick) => tick + 1)
        })
      })
      return
    }
    const view = slot.querySelector('[data-testid="spread-view"]')
    const target = view instanceof HTMLElement ? view : slot
    const containedAfterPaint = spreadBoxContained(
      scroll.getBoundingClientRect(),
      target.getBoundingClientRect(),
    )
    if (!containedAfterPaint) {
      revealPaintConfirm.current = false
      revealTries.current += 1
    }
    const plan = planRevealAttempt({
      revealed: true,
      atMaxScroll,
      tries: revealTries.current,
      paintConfirmed: true,
      containedAfterPaint,
    })
    if (plan.kind === 'confirm-paint') {
      return
    }
    if (plan.kind === 'retry') {
      requestAnimationFrame(() => {
        setRevealTick((tick) => tick + 1)
      })
      return
    }
    if (plan.kind === 'exhaust') {
      clearReveal(true)
      return
    }
    clearReveal(false)
  }, [scrollRef, setTrackedScroll, spreadIds, stride, windowKey, revealTick])

  return { holdCameraScrollRef, beginRevealForNewSpread }
}
