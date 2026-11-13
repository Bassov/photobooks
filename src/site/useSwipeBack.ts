import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import {
  paintSwipe,
  swipeMove,
  swipeShuts,
  swipeStart,
  SWIPE_MS,
  type Swipe,
} from './swipeBack'

/** Presses on these follow the book, not the room. */
const BOOK =
  '[data-testid="ps-strip"],[data-testid="pt-stage"],[data-testid="site-reader"]'

/**
 * The room's swipe back (see `swipeBack`): its props for the room element,
 * none when `onClose` is unset. Reduced motion: no follow, no slide.
 */
export function useSwipeBack(
  onClose: (() => void) | undefined,
  w: number,
  reduced: () => boolean,
) {
  const s = useRef<Swipe | null>(null)
  const timer = useRef(0)
  // the click that may follow an active swipe's release is swallowed
  const swallow = useRef(false)
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )
  if (onClose === undefined) return {}
  const end = (e: PointerEvent<HTMLElement>, cancel: boolean) => {
    const g = s.current
    if (g?.id !== e.pointerId) return
    s.current = null
    if (!g.active) return
    window.setTimeout(() => {
      swallow.current = false
    }, 0)
    const shut = !cancel && swipeShuts(g, e.timeStamp, w)
    if (reduced()) {
      if (shut) onClose()
      return
    }
    const el = e.currentTarget
    paintSwipe(el, shut ? w : 0, SWIPE_MS)
    timer.current = window.setTimeout(() => {
      if (shut) onClose()
      else paintSwipe(el, 0, 0)
    }, SWIPE_MS)
  }
  return {
    style: { touchAction: 'none' } as CSSProperties,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' || s.current) return
      if ((e.target as Element).closest(BOOK)) return
      s.current = swipeStart(e.pointerId, e.clientX, e.clientY)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const g = s.current
      if (g?.id !== e.pointerId) return
      const next = swipeMove(g, e.clientX, e.clientY, e.timeStamp)
      s.current = next
      if (!next?.active) return
      if (!g.active) {
        e.currentTarget.setPointerCapture(e.pointerId)
        swallow.current = true
      }
      if (!reduced()) paintSwipe(e.currentTarget, next.dx, 0)
    },
    onClickCapture: (e: {
      stopPropagation: () => void
      preventDefault: () => void
    }) => {
      if (!swallow.current) return
      e.stopPropagation()
      e.preventDefault()
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      end(e, false)
    },
    onPointerCancel: (e: PointerEvent<HTMLElement>) => {
      end(e, true)
    },
  }
}
