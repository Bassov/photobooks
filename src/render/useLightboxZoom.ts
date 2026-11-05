import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { swipeDelta } from './pagerIndex'
import {
  clampPan,
  settle,
  wheelFactor,
  ZOOM_TOGGLE,
  zoomAt,
  type Rect,
  type Zoom,
} from './pagerZoom'

const Z1: Zoom = { z: 1, x: 0, y: 0 }
/** Continuous input (wheel, pan, pinch) counts as over after this quiet. */
const LIVE_MS = 150
/** A discrete change animates 200 ms; its flags drop after it ends. */
const ANIM_MS = 350
/** Double-tap: two taps this close in time and space. */
const TAP_MS = 300
const TAP_PX = 16
const DOM_DELTA_LINE = 1
const LINE_PX = 16

/** Marks a control inside the dialog: it never starts a gesture. */
const PAGER_CONTROL = 'data-pager-control'

interface Pt {
  x: number
  y: number
}

type Gesture =
  | { kind: 'swipe'; p0: Pt }
  | { kind: 'pan'; p0: Pt; z0: Zoom }
  | { kind: 'pinch'; d0: number; m0: Pt; z0: Zoom }

/** `live`: input runs (will-change); `anim`: a discrete change animates. */
type Motion = 'idle' | 'live' | 'anim'

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const point = (e: { clientX: number; clientY: number }): Pt => ({
  x: e.clientX,
  y: e.clientY,
})

/**
 * Lightbox zoom and gestures (Designer site-lightbox §3): one zoom per slide
 * (a step keeps only the old slide's, so it slides away at its zoom and the
 * new one opens at 1), pan / pinch / wheel per frame, discrete changes
 * animated. `box` is the active slide's fitted rect, `area` the fit area.
 */
export function useLightboxZoom({
  rootRef,
  index,
  box,
  area,
  onStep,
}: {
  rootRef: RefObject<HTMLElement | null>
  index: number
  box: Rect
  area: Rect
  onStep: (delta: 1 | -1) => void
}) {
  const [zooms, setZooms] = useState<Readonly<Record<number, Zoom>>>({})
  const [shown, setShown] = useState(index)
  if (shown !== index) {
    setShown(index)
    setZooms((zs) => ({ [shown]: zs[shown] ?? Z1 }))
  }
  const zoom = clampPan(zooms[index] ?? Z1, box, area)
  const [motion, setMotion] = useState<Motion>('idle')
  const [dragging, setDragging] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const update = (f: (z: Zoom) => Zoom, discrete: boolean) => {
    const { index: i, box: b, area: a } = cur.current
    setZooms((zs) => ({
      ...zs,
      [i]: clampPan(f(clampPan(zs[i] ?? Z1, b, a)), b, a),
    }))
    setMotion(discrete ? 'anim' : 'live')
    window.clearTimeout(timer.current)
    // Input over: a near-1 zoom snaps back and will-change goes, so Chrome
    // re-rasters the photos sharp at the final scale.
    timer.current = window.setTimeout(
      () => {
        setZooms((zs) => ({ ...zs, [i]: settle(zs[i] ?? Z1) }))
        setMotion('idle')
      },
      discrete ? ANIM_MS : LIVE_MS,
    )
  }

  /** Keys and the Zoom chip: scale about the fit-area centre. */
  const zoomBy = (factor: number) => {
    update((z) => {
      const { box: b, area: a } = cur.current
      return zoomAt(z, factor, a.x + a.w / 2, a.y + a.h / 2, b, a)
    }, true)
  }

  const reset = () => {
    update(() => Z1, true)
  }

  /** Double-click / double-tap: 2× about the point, or back to 1. */
  const toggleAt = (p: Pt) => {
    update((z) => {
      const { box: b, area: a } = cur.current
      return z.z > 1 ? Z1 : zoomAt(z, ZOOM_TOGGLE, p.x, p.y, b, a)
    }, true)
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      update((z) => {
        const { box: b, area: a } = cur.current
        const f = wheelFactor(e.deltaY, e.deltaMode)
        return zoomAt(z, f, e.clientX, e.clientY, b, a)
      }, false)
      return
    }
    const line = e.deltaMode === DOM_DELTA_LINE ? LINE_PX : 1
    // At 1× the pan clamps to 0: a plain wheel does nothing there.
    update(
      (z) => ({ ...z, x: z.x - e.deltaX * line, y: z.y - e.deltaY * line }),
      false,
    )
  }

  const cur = useRef({ index, box, area, zoom, onStep, onWheel })
  useLayoutEffect(() => {
    cur.current = { index, box, area, zoom, onStep, onWheel }
  })

  useEffect(() => {
    // Not passive: Ctrl + wheel must not zoom the page.
    const root = rootRef.current
    const listener = (e: WheelEvent) => {
      cur.current.onWheel(e)
    }
    root?.addEventListener('wheel', listener, { passive: false })
    return () => {
      root?.removeEventListener('wheel', listener)
    }
  }, [rootRef])

  const pointers = useRef(new Map<number, Pt>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ t: number; p: Pt } | null>(null)
  const mouse = useRef(true)

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    mouse.current = e.pointerType === 'mouse'
    if (mouse.current && e.button !== 0) return
    const p = point(e)
    pointers.current.set(e.pointerId, p)
    e.currentTarget.setPointerCapture(e.pointerId)
    const z = cur.current.zoom
    const [a = p, b] = [...pointers.current.values()]
    if (b !== undefined) {
      gesture.current = {
        kind: 'pinch',
        d0: Math.max(1, dist(a, b)),
        m0: mid(a, b),
        z0: z,
      }
      setDragging(false)
      return
    }
    const pan = z.z > 1
    gesture.current = pan
      ? { kind: 'pan', p0: p, z0: z }
      : { kind: 'swipe', p0: p }
    setDragging(pan)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = point(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    if (g?.kind === 'pan') {
      update(
        () => ({ ...g.z0, x: g.z0.x + p.x - g.p0.x, y: g.z0.y + p.y - g.p0.y }),
        false,
      )
      return
    }
    const [p1 = p, p2] = [...pointers.current.values()]
    if (g?.kind === 'pinch' && p2 !== undefined) {
      const m = mid(p1, p2)
      update(() => {
        const { box: b, area: a } = cur.current
        const z = zoomAt(g.z0, dist(p1, p2) / g.d0, g.m0.x, g.m0.y, b, a)
        return { ...z, x: z.x + m.x - g.m0.x, y: z.y + m.y - g.m0.y }
      }, false)
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.delete(e.pointerId)) return
    const g = gesture.current
    const p = point(e)
    const up = e.type === 'pointerup'
    if (g?.kind === 'swipe' && up) {
      const delta = swipeDelta(g.p0.x, p.x)
      if (delta !== 0) cur.current.onStep(delta)
    }
    // Touch / pen double-tap; the mouse uses dblclick.
    if (!mouse.current && up && g?.kind !== 'pinch') {
      const last = lastTap.current
      const tap = g !== null && dist(p, g.p0) <= TAP_PX
      const double =
        tap &&
        last !== null &&
        e.timeStamp - last.t <= TAP_MS &&
        dist(p, last.p) <= TAP_PX
      lastTap.current = tap && !double ? { t: e.timeStamp, p } : null
      if (double) toggleAt(p)
    }
    const [rest] = [...pointers.current.values()]
    gesture.current =
      rest === undefined
        ? null
        : { kind: 'pan', p0: rest, z0: cur.current.zoom }
    setDragging(rest !== undefined)
  }

  const onDoubleClick = (e: ReactMouseEvent<HTMLElement>) => {
    const control =
      e.target instanceof Element && e.target.closest(`[${PAGER_CONTROL}]`)
    if (mouse.current && !control) toggleAt(point(e))
  }

  return {
    zoom,
    /** A neighbour keeps the zoom it had when it was active. */
    zoomOf: (k: number): Zoom => (k === index ? zoom : (zooms[k] ?? Z1)),
    /** A discrete change runs: the layer animates `transform`. */
    anim: motion === 'anim',
    /** Input runs: the layer gets `will-change: transform`. */
    live: motion !== 'idle' || dragging,
    dragging,
    zoomBy,
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick,
      // A native image drag would cancel the pointer mid-swipe / mid-pan.
      onDragStart: (e: ReactMouseEvent<HTMLElement>) => {
        e.preventDefault()
      },
    },
  }
}
