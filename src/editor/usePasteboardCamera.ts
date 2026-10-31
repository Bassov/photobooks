import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { getSpreadPageCount } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import {
  centerSpreadScroll,
  clampZoom,
  fitZoom,
  FIT_BOTTOM_PX,
  FIT_TOP_PX,
  physicalZoom,
  pinchZoom,
  stepZoom,
  wheelZoomFactor,
  zoomAtPoint,
  zoomLimits,
  type CameraPoint,
  type ZoomFrame,
} from './camera'
import { mergePendingWheel, type PendingWheel } from './wheelCoalesce'
import {
  commitZoom,
  getCommittedCamera,
  getCommittedZoom,
  setLiveZoom,
} from './cameraStore'
import { setEditorGestureActive } from './editorGesture'
import { getEditorTool } from './editorToolStore'
import {
  beginDelayedFitFollow,
  createDelayedFitFollow,
  fitViewportSize,
  resolveDelayedFitFrame,
  scheduleDelayedFitDoubleRaf,
  shouldHoldCameraScroll,
  stopDelayedFitFollow,
} from './pasteboardCameraFit'
import { PASTEBOARD_PAD_PX, stackHeightFitZoom } from './pasteboardView'
import { pasteboardStridePx } from './pasteboardWindow'

const GESTURE_SETTLE_MS = 80

interface ScrollPosition {
  scrollLeft: number
  scrollTop: number
}

interface MutablePoint {
  x: number
  y: number
}

interface ActiveGesture {
  mode: 'wheel' | 'pinch'
  startZoom: number
  startScrollLeft: number
  startScrollTop: number
  originX: number
  originY: number
  liveZoom: number
  minZoom: number
  maxZoom: number
  frame: ZoomFrame
  startA: MutablePoint
  startB: MutablePoint
  currentA: MutablePoint
  currentB: MutablePoint
}

interface StackMetrics {
  spreadWidth: number
  spreadHeight: number
  stackWidth: number
  count: number
}

function blankFrame(): ZoomFrame {
  return {
    zoom: 1,
    scrollLeft: 0,
    scrollTop: 0,
    translateX: 0,
    translateY: 0,
    scale: 1,
  }
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true
  }
  if (!(target instanceof HTMLInputElement)) {
    return false
  }
  return (
    target.type === 'text' ||
    target.type === 'search' ||
    target.type === 'number' ||
    target.type === 'email' ||
    target.type === 'url' ||
    target.type === 'password'
  )
}

function zoomDirection(event: KeyboardEvent): 1 | -1 | null {
  if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') {
    return 1
  }
  if (
    event.key === '-' ||
    event.key === '_' ||
    event.code === 'NumpadSubtract'
  ) {
    return -1
  }
  return null
}

function stackMetrics(
  trimWidthMm: number,
  trimHeightMm: number,
  spreadCount: number,
  activeIndex: number,
): StackMetrics {
  const pages = getSpreadPageCount(activeIndex, spreadCount)
  const widest = spreadCount >= 2 ? 2 : 1
  return {
    spreadWidth: trimWidthMm * pages * SPREAD_PX_PER_MM,
    spreadHeight: trimHeightMm * SPREAD_PX_PER_MM,
    stackWidth: trimWidthMm * widest * SPREAD_PX_PER_MM,
    count: Math.max(spreadCount, 0),
  }
}

function fitFor(
  metrics: StackMetrics,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const viewport = fitViewportSize(viewportWidth, viewportHeight)
  return fitZoom({
    contentWidthPx: metrics.spreadWidth,
    contentHeightPx: metrics.spreadHeight,
    viewportWidth: viewport.viewportWidth,
    viewportHeight: viewport.viewportHeight,
    mode: 'contain',
  })
}

function limitsFor(
  metrics: StackMetrics,
  viewportWidth: number,
  viewportHeight: number,
): { minZoom: number; maxZoom: number } {
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) {
    // No layout yet: the kit's absolute clamp stands in for the Fit ratios.
    return zoomLimits(1)
  }
  const limits = zoomLimits(
    fitFor(metrics, viewportWidth, viewportHeight),
    // Whole-stack fit: the narrower of the stack width and the stack height.
    Math.min(
      fitZoom({
        contentWidthPx: metrics.stackWidth,
        contentHeightPx: 0,
        viewportWidth,
        viewportHeight,
        mode: 'width',
      }),
      stackHeightFitZoom(metrics.count, metrics.spreadHeight, viewportHeight),
    ),
  )
  const widthFit = fitZoom({
    contentWidthPx: metrics.spreadWidth,
    contentHeightPx: metrics.spreadHeight,
    viewportWidth,
    viewportHeight,
    mode: 'width',
  })
  return {
    minZoom: limits.minZoom,
    // 400% physical stays reachable on small spreads.
    maxZoom: Math.max(limits.maxZoom, widthFit, physicalZoom() * 4),
  }
}

function clearGesturePaint(
  world: HTMLElement | null,
  scroll: HTMLElement | null,
): void {
  if (world !== null) {
    world.style.transform = ''
    world.style.willChange = ''
    world.style.removeProperty('--cam-scale')
    delete world.dataset.gesture
  }
  if (scroll !== null) {
    scroll.style.touchAction = ''
  }
}

/** Scroll that centres the active spread in the kit band `[56, H − 48]`. */
function placedScroll(
  metrics: StackMetrics,
  zoom: number,
  activeIndex: number,
  viewportWidth: number,
  viewportHeight: number,
): ScrollPosition {
  const spreadWidth = metrics.spreadWidth * zoom
  const spreadHeight = metrics.spreadHeight * zoom
  const stride = pasteboardStridePx(spreadHeight)
  return centerSpreadScroll({
    spreadLeftPx:
      PASTEBOARD_PAD_PX + (metrics.stackWidth * zoom - spreadWidth) / 2,
    // The band centre sits (bottom − top) / 2 below the viewport centre.
    spreadTopPx:
      PASTEBOARD_PAD_PX +
      activeIndex * stride -
      (FIT_TOP_PX - FIT_BOTTOM_PX) / 2,
    spreadWidthPx: spreadWidth,
    spreadHeightPx: spreadHeight,
    viewportWidth,
    viewportHeight,
    contentWidth: 2 * PASTEBOARD_PAD_PX + metrics.stackWidth * zoom,
    contentHeight: 2 * PASTEBOARD_PAD_PX + metrics.count * stride,
  })
}

export function usePasteboardCamera({
  scrollRef,
  worldRef,
  spreadCount,
  trimWidthMm,
  trimHeightMm,
  activeIndex,
  committedEpoch,
  holdScrollRef,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  worldRef: RefObject<HTMLDivElement | null>
  spreadCount: number
  trimWidthMm: number
  trimHeightMm: number
  activeIndex: number
  committedEpoch: number
  holdScrollRef?: RefObject<boolean>
}): {
  fitSpread: () => void
  fitWidth: () => void
  actualSize: () => void
  zoomTo: (zoom: number) => void
  zoomStep: (direction: 1 | -1) => void
  refitIfFitted: () => void
  fitSpreadZoom: () => number | null
} {
  const bookRef = useRef({
    spreadCount,
    trimWidthMm,
    trimHeightMm,
    activeIndex,
  })
  const gestureRef = useRef<ActiveGesture | null>(null)
  const pointersRef = useRef(new Map<number, CameraPoint>())
  /** True while Space is physically held (even off the pasteboard). */
  const spaceHeldRef = useRef(false)
  /** True when Space-pan is armed (held + pointer over pasteboard). */
  const spaceRef = useRef(false)
  const pointerOverPasteboardRef = useRef(false)
  /** Last pointer client point for hover recovery when enter was missed. */
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null)
  /**
   * Focus target whose Space activation was deferred while pan was armed.
   * Cleared when a pasteboard Space-drag starts; clicked on Space keyup otherwise.
   */
  const pendingSpaceActivationRef = useRef<HTMLElement | null>(null)
  const panRef = useRef<{
    id: number
    x: number
    y: number
    left: number
    top: number
  } | null>(null)
  const rafRef = useRef(0)
  const settleRef = useRef(0)
  const delayedFitRef = useRef(createDelayedFitFollow())

  const placeZoom = (zoom: number): number | null => {
    const scroll = scrollRef.current
    if (scroll === null) {
      return null
    }
    const metrics = stackMetrics(
      trimWidthMm,
      trimHeightMm,
      spreadCount,
      activeIndex,
    )
    const limits = limitsFor(metrics, scroll.clientWidth, scroll.clientHeight)
    const next = clampZoom(zoom, limits.minZoom, limits.maxZoom)
    const placed = placedScroll(
      metrics,
      next,
      activeIndex,
      scroll.clientWidth,
      scroll.clientHeight,
    )
    commitZoom(next, placed.scrollLeft, placed.scrollTop)
    return next
  }

  const fitSpreadZoom = (): number | null => {
    const scroll = scrollRef.current
    if (scroll === null) {
      return null
    }
    return fitFor(
      stackMetrics(trimWidthMm, trimHeightMm, spreadCount, activeIndex),
      scroll.clientWidth,
      scroll.clientHeight,
    )
  }

  /** Zoom of the last explicit Fit; the view follows viewport resizes while at it. */
  const lastFitRef = useRef<number | null>(null)

  const placeFit = (zoom: number): void => {
    const placed = placeZoom(zoom)
    if (placed !== null) {
      lastFitRef.current = placed
    }
  }

  const applyFitSpread = (): void => {
    const next = fitSpreadZoom()
    if (next !== null) {
      placeFit(next)
    }
  }

  const stopFollowingFit = (): void => {
    stopDelayedFitFollow(delayedFitRef.current, cancelAnimationFrame)
  }

  /** Kit ×/÷ 1.25 about the viewport centre; keeps the pan (no recentre). */
  const stepAtCentre = (direction: 1 | -1): void => {
    const port = scrollRef.current
    if (port === null) {
      return
    }
    const book = bookRef.current
    const limits = limitsFor(
      stackMetrics(
        book.trimWidthMm,
        book.trimHeightMm,
        book.spreadCount,
        book.activeIndex,
      ),
      port.clientWidth,
      port.clientHeight,
    )
    const start = getCommittedZoom()
    const next = stepZoom(start, direction, limits.minZoom, limits.maxZoom)
    if (next === start) {
      return
    }
    stopFollowingFit()
    const frame = blankFrame()
    zoomAtPoint(
      {
        zoom: start,
        scrollLeft: port.scrollLeft,
        scrollTop: port.scrollTop,
        anchorX: port.clientWidth / 2,
        anchorY: port.clientHeight / 2,
        factor: next / start,
        minZoom: limits.minZoom,
        maxZoom: limits.maxZoom,
        originX: PASTEBOARD_PAD_PX,
        originY: PASTEBOARD_PAD_PX,
      },
      frame,
    )
    commitZoom(frame.zoom, frame.scrollLeft, frame.scrollTop)
  }

  // Reads only refs, so the first render's closure stays valid.
  const stepRef = useRef(stepAtCentre)

  useLayoutEffect(() => {
    bookRef.current = {
      spreadCount,
      trimWidthMm,
      trimHeightMm,
      activeIndex,
    }
  }, [activeIndex, spreadCount, trimHeightMm, trimWidthMm])

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const world = worldRef.current
    if (scroll === null || world === null) {
      return
    }
    if (shouldHoldCameraScroll(holdScrollRef)) {
      return
    }
    const camera = getCommittedCamera()
    clearGesturePaint(world, scroll)
    scroll.scrollLeft = camera.scrollLeft
    scroll.scrollTop = camera.scrollTop
  }, [committedEpoch, scrollRef, worldRef, holdScrollRef])

  useEffect(() => {
    const scroll = scrollRef.current
    const world = worldRef.current
    if (scroll === null) {
      return
    }

    let pendingWheel: PendingWheel | null = null

    const flushPendingWheel = (port: HTMLElement): void => {
      const pending = pendingWheel
      if (pending === null) {
        return
      }
      pendingWheel = null
      measureHandlerSync('wheel-zoom', () => {
        const gesture = beginGesture('wheel', port)
        const requested = gesture.liveZoom * wheelZoomFactor(pending.deltaY)
        zoomAtPoint(
          {
            zoom: gesture.startZoom,
            scrollLeft: gesture.startScrollLeft,
            scrollTop: gesture.startScrollTop,
            anchorX: pending.clientX - gesture.originX,
            anchorY: pending.clientY - gesture.originY,
            factor: requested / gesture.startZoom,
            minZoom: gesture.minZoom,
            maxZoom: gesture.maxZoom,
            originX: PASTEBOARD_PAD_PX,
            originY: PASTEBOARD_PAD_PX,
          },
          gesture.frame,
        )
        gesture.liveZoom = gesture.frame.zoom
      })
    }

    const paint = (): void => {
      rafRef.current = 0
      const port = scrollRef.current
      const pan = panRef.current
      if (pan !== null && port !== null) {
        port.scrollLeft = pan.left
        port.scrollTop = pan.top
      }
      if (port !== null) {
        flushPendingWheel(port)
      }
      const gesture = gestureRef.current
      const world = worldRef.current
      if (gesture === null || world === null) {
        return
      }
      const frame = gesture.frame
      world.style.transformOrigin = `${String(PASTEBOARD_PAD_PX)}px ${String(PASTEBOARD_PAD_PX)}px`
      world.style.transform = `translate(${String(frame.translateX)}px, ${String(frame.translateY)}px) scale(${String(frame.scale)})`
      world.style.willChange = 'transform'
      // Screen-px chrome (page shadow, page numbers) divides by this.
      world.style.setProperty('--cam-scale', String(frame.scale))
      world.dataset.gesture = 'zoom'
      setLiveZoom(gesture.liveZoom)
    }

    const schedulePaint = (): void => {
      if (rafRef.current !== 0) {
        return
      }
      rafRef.current = requestAnimationFrame(paint)
    }

    let zoomGestureHeld = false
    let panGestureHeld = false
    const holdZoomGesture = (): void => {
      if (!zoomGestureHeld) {
        zoomGestureHeld = true
        setEditorGestureActive(true)
      }
    }
    const releaseZoomGesture = (): void => {
      if (zoomGestureHeld) {
        zoomGestureHeld = false
        setEditorGestureActive(false)
      }
    }
    const holdPanGesture = (): void => {
      if (!panGestureHeld) {
        panGestureHeld = true
        setEditorGestureActive(true)
      }
    }
    const releasePanGesture = (): void => {
      if (panGestureHeld) {
        panGestureHeld = false
        setEditorGestureActive(false)
      }
    }

    const settle = (): void => {
      settleRef.current = 0
      const port = scrollRef.current
      if (port !== null) {
        flushPendingWheel(port)
      }
      const gesture = gestureRef.current
      gestureRef.current = null
      const world = worldRef.current
      if (gesture === null) {
        clearGesturePaint(world, port)
        releaseZoomGesture()
        return
      }
      if (gesture.frame.zoom === getCommittedZoom()) {
        clearGesturePaint(world, port)
        setLiveZoom(gesture.frame.zoom)
        releaseZoomGesture()
        return
      }
      commitZoom(
        gesture.frame.zoom,
        gesture.frame.scrollLeft,
        gesture.frame.scrollTop,
      )
      releaseZoomGesture()
    }

    const scheduleSettle = (): void => {
      window.clearTimeout(settleRef.current)
      settleRef.current = window.setTimeout(settle, GESTURE_SETTLE_MS)
    }

    const beginGesture = (
      mode: 'wheel' | 'pinch',
      port: HTMLElement,
    ): ActiveGesture => {
      const existing = gestureRef.current
      if (existing !== null && existing.mode === mode) {
        return existing
      }
      stopFollowingFit()
      if (existing === null) {
        holdZoomGesture()
      }
      const rect = port.getBoundingClientRect()
      const book = bookRef.current
      const limits = limitsFor(
        stackMetrics(
          book.trimWidthMm,
          book.trimHeightMm,
          book.spreadCount,
          book.activeIndex,
        ),
        port.clientWidth,
        port.clientHeight,
      )
      const zoom = getCommittedZoom()
      const startZoom = zoom > 0 ? zoom : 1
      const gesture: ActiveGesture = {
        mode,
        startZoom,
        startScrollLeft: port.scrollLeft,
        startScrollTop: port.scrollTop,
        originX: rect.left,
        originY: rect.top,
        liveZoom: startZoom,
        minZoom: limits.minZoom,
        maxZoom: limits.maxZoom,
        frame: {
          zoom: startZoom,
          scrollLeft: port.scrollLeft,
          scrollTop: port.scrollTop,
          translateX: 0,
          translateY: 0,
          scale: 1,
        },
        startA: { x: 0, y: 0 },
        startB: { x: 0, y: 0 },
        currentA: { x: 0, y: 0 },
        currentB: { x: 0, y: 0 },
      }
      gestureRef.current = gesture
      return gesture
    }

    const onWheel = (event: WheelEvent): void => {
      // Kit hard-no: wheel over pasteboard always zooms to pointer (no wheel-pan).
      // Ctrl/Cmd still accepted for trackpad pinch-emulation and existing e2e.
      if (pointersRef.current.size >= 2) {
        return
      }
      event.preventDefault()
      const port = scrollRef.current
      if (port === null) {
        return
      }
      // Coalesce trackpad/test bursts into one zoom apply per frame (paint).
      // Only the flush is measured as `wheel-zoom` — enqueue must stay cheap and
      // must not dilute handler p95 under burst input.
      // First-event gesture setup is intentionally unmeasured (cheap after warm).
      beginGesture('wheel', port)
      pendingWheel = mergePendingWheel(pendingWheel, event)
      schedulePaint()
      scheduleSettle()
    }

    const onPointerDown = (event: PointerEvent): void => {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
      const port = scrollRef.current
      if (port === null) {
        return
      }
      // Hand tool pans on a plain primary drag (kit canvas hand tool); Space
      // is the temporary hand from any other tool.
      if (
        spaceRef.current ||
        (getEditorTool() === 'hand' && event.button === 0)
      ) {
        event.preventDefault()
        // A real pasteboard drag wins over deferred chrome Space activation.
        pendingSpaceActivationRef.current = null
        panRef.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: port.scrollLeft,
          top: port.scrollTop,
        }
        holdPanGesture()
        port.setPointerCapture(event.pointerId)
        return
      }
      if (pointersRef.current.size < 2) {
        return
      }
      const points = [...pointersRef.current.values()]
      const first = points[0]
      const second = points[1]
      if (first === undefined || second === undefined) {
        return
      }
      event.preventDefault()
      const gesture = beginGesture('pinch', port)
      gesture.startA.x = first.x - gesture.originX
      gesture.startA.y = first.y - gesture.originY
      gesture.startB.x = second.x - gesture.originX
      gesture.startB.y = second.y - gesture.originY
      gesture.currentA.x = gesture.startA.x
      gesture.currentA.y = gesture.startA.y
      gesture.currentB.x = gesture.startB.x
      gesture.currentB.y = gesture.startB.y
      port.style.touchAction = 'none'
    }

    const onPointerMove = (event: PointerEvent): void => {
      const pan = panRef.current
      const port = scrollRef.current
      if (pan !== null && pan.id === event.pointerId && port !== null) {
        event.preventDefault()
        pan.left -= event.clientX - pan.x
        pan.top -= event.clientY - pan.y
        pan.x = event.clientX
        pan.y = event.clientY
        schedulePaint()
        return
      }
      if (!pointersRef.current.has(event.pointerId)) {
        return
      }
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
      const gesture = gestureRef.current
      if (gesture?.mode !== 'pinch' || pointersRef.current.size < 2) {
        return
      }
      event.preventDefault()
      const points = [...pointersRef.current.values()]
      const first = points[0]
      const second = points[1]
      if (first === undefined || second === undefined) {
        return
      }
      gesture.currentA.x = first.x - gesture.originX
      gesture.currentA.y = first.y - gesture.originY
      gesture.currentB.x = second.x - gesture.originX
      gesture.currentB.y = second.y - gesture.originY
      pinchZoom(
        {
          zoom: gesture.startZoom,
          scrollLeft: gesture.startScrollLeft,
          scrollTop: gesture.startScrollTop,
          startA: gesture.startA,
          startB: gesture.startB,
          currentA: gesture.currentA,
          currentB: gesture.currentB,
          minZoom: gesture.minZoom,
          maxZoom: gesture.maxZoom,
          originX: PASTEBOARD_PAD_PX,
          originY: PASTEBOARD_PAD_PX,
        },
        gesture.frame,
      )
      gesture.liveZoom = gesture.frame.zoom
      schedulePaint()
      scheduleSettle()
    }

    const endPointer = (event: PointerEvent): void => {
      pointersRef.current.delete(event.pointerId)
      if (panRef.current?.id === event.pointerId) {
        panRef.current = null
        releasePanGesture()
      }
      if (
        pointersRef.current.size < 2 &&
        gestureRef.current?.mode === 'pinch'
      ) {
        scheduleSettle()
      }
    }

    const syncSpacePanArm = (): void => {
      spaceRef.current =
        spaceHeldRef.current && pointerOverPasteboardRef.current
    }

    const setPointerOverPasteboard = (over: boolean): void => {
      pointerOverPasteboardRef.current = over
      if (over) {
        syncSpacePanArm()
        return
      }
      // Keep arming through an in-flight pan; otherwise drop so Space can
      // activate chrome again once the pointer leaves the pasteboard.
      if (panRef.current === null) {
        spaceRef.current = false
      }
    }

    const refreshPointerOverFromLastPoint = (): void => {
      const port = scrollRef.current
      const point = lastPointerClientRef.current
      if (port === null || point === null) {
        return
      }
      const under = document.elementFromPoint(point.x, point.y)
      setPointerOverPasteboard(
        under !== null && (under === port || port.contains(under)),
      )
    }

    const onPointerEnterPasteboard = (): void => {
      setPointerOverPasteboard(true)
    }
    const onPointerLeavePasteboard = (): void => {
      setPointerOverPasteboard(false)
    }

    const onWindowPointerMove = (event: PointerEvent): void => {
      lastPointerClientRef.current = { x: event.clientX, y: event.clientY }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTextField(event.target)) {
        return
      }
      if (event.code === 'Space' || event.key === ' ') {
        // Capture-phase: filmstrip GridListItem rows consume Space before bubble.
        // Steal Space only while the pointer is over the pasteboard so keyboard
        // activation still works when the pointer is elsewhere. When stolen,
        // defer activation of the focused control until keyup unless a
        // pasteboard Space-drag starts (PB-04b).
        if (!event.repeat) {
          spaceHeldRef.current = true
        }
        // Recover if pointerenter was missed (listeners attached under cursor).
        if (!pointerOverPasteboardRef.current) {
          refreshPointerOverFromLastPoint()
        }
        if (!pointerOverPasteboardRef.current) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        syncSpacePanArm()
        if (!event.repeat) {
          const active = document.activeElement
          const port = scrollRef.current
          // Only chrome outside the scrollport (filmstrip tiles, camera bar, …).
          pendingSpaceActivationRef.current =
            active instanceof HTMLElement &&
            !isTextField(active) &&
            (port === null || (active !== port && !port.contains(active)))
              ? active
              : null
        }
        return
      }
      const direction = zoomDirection(event)
      if (direction === null) {
        return
      }
      event.preventDefault()
      stepRef.current(direction)
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space' || event.key === ' ') {
        spaceHeldRef.current = false
        spaceRef.current = false
        if (panRef.current !== null) {
          panRef.current = null
          releasePanGesture()
        }
        const pending = pendingSpaceActivationRef.current
        pendingSpaceActivationRef.current = null
        if (pending !== null && document.contains(pending)) {
          pending.click()
        }
      }
    }

    const pointers = pointersRef.current
    scroll.addEventListener('wheel', onWheel, { passive: false })
    scroll.addEventListener('pointerdown', onPointerDown)
    scroll.addEventListener('pointermove', onPointerMove)
    scroll.addEventListener('pointerup', endPointer)
    scroll.addEventListener('pointercancel', endPointer)
    scroll.addEventListener('pointerenter', onPointerEnterPasteboard)
    scroll.addEventListener('pointerleave', onPointerLeavePasteboard)
    // Capture so Space still arms before react-aria filmstrip rows handle it.
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointermove', onWindowPointerMove, {
      passive: true,
    })

    return () => {
      scroll.removeEventListener('wheel', onWheel)
      scroll.removeEventListener('pointerdown', onPointerDown)
      scroll.removeEventListener('pointermove', onPointerMove)
      scroll.removeEventListener('pointerup', endPointer)
      scroll.removeEventListener('pointercancel', endPointer)
      scroll.removeEventListener('pointerenter', onPointerEnterPasteboard)
      scroll.removeEventListener('pointerleave', onPointerLeavePasteboard)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointermove', onWindowPointerMove)
      window.clearTimeout(settleRef.current)
      pendingWheel = null
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current)
      }
      const gesture = gestureRef.current
      gestureRef.current = null
      if (gesture !== null) {
        setLiveZoom(getCommittedZoom())
      }
      clearGesturePaint(world, scroll)
      releaseZoomGesture()
      releasePanGesture()
      pointers.clear()
    }
  }, [scrollRef, worldRef])

  return {
    zoomTo: (zoom) => {
      stopFollowingFit()
      placeZoom(zoom)
    },
    zoomStep: stepAtCentre,
    /**
     * Re-fit when the view is still at Fit (never zoomed away): a resized
     * pasteboard (panel toggle, window) keeps the spread inside it. Before any
     * zoom was committed this is the open-time fit.
     */
    refitIfFitted: () => {
      const last = lastFitRef.current
      const atFit =
        last === null
          ? getCommittedCamera().epoch === 0
          : Math.abs(getCommittedZoom() - last) <= last * 1e-6
      if (atFit) {
        applyFitSpread()
      }
    },
    fitSpreadZoom,
    fitSpread: () => {
      beginDelayedFitFollow(delayedFitRef.current)
      applyFitSpread()
      // After chrome/filmstrip finishes laying out, only zoom out if the port
      // shrank. Never zoom back in — a larger transient clientHeight overflows.
      scheduleDelayedFitDoubleRaf(
        delayedFitRef.current,
        requestAnimationFrame,
        cancelAnimationFrame,
        () => {
          const next = fitSpreadZoom()
          const resolved = resolveDelayedFitFrame(
            delayedFitRef.current,
            next,
            getCommittedZoom(),
          )
          if (resolved.apply && resolved.zoom !== null) {
            placeFit(resolved.zoom)
          }
        },
      )
    },
    fitWidth: () => {
      stopFollowingFit()
      const scroll = scrollRef.current
      if (scroll === null) {
        return
      }
      const metrics = stackMetrics(
        trimWidthMm,
        trimHeightMm,
        spreadCount,
        activeIndex,
      )
      placeZoom(
        fitZoom({
          contentWidthPx: metrics.spreadWidth,
          contentHeightPx: metrics.spreadHeight,
          viewportWidth: scroll.clientWidth,
          viewportHeight: scroll.clientHeight,
          mode: 'width',
        }),
      )
    },
    actualSize: () => {
      stopFollowingFit()
      placeZoom(physicalZoom())
    },
  }
}
