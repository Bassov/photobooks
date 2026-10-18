import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { getSpreadPageCount } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import {
  centerSpreadScroll,
  clampZoom,
  fitStackZoom,
  fitZoom,
  physicalZoom,
  pinchZoom,
  stepZoom,
  wheelZoomFactor,
  zoomAtPoint,
  zoomLimits,
  type CameraPoint,
  type ZoomFrame,
} from './camera'
import {
  commitZoom,
  getCommittedCamera,
  getCommittedZoom,
  setLiveZoom,
} from './cameraStore'
import { setEditorGestureActive } from './editorGesture'
import {
  beginDelayedFitFollow,
  createDelayedFitFollow,
  fitViewportSize,
  resolveDelayedFitFrame,
  scheduleDelayedFitDoubleRaf,
  shouldHoldCameraScroll,
  stopDelayedFitFollow,
} from './pasteboardCameraFit'
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
  stackHeight: number
  stride: number
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
  const stride = pasteboardStridePx(trimHeightMm * SPREAD_PX_PER_MM)
  return {
    spreadWidth: trimWidthMm * pages * SPREAD_PX_PER_MM,
    spreadHeight: trimHeightMm * SPREAD_PX_PER_MM,
    stackWidth: trimWidthMm * widest * SPREAD_PX_PER_MM,
    stackHeight: Math.max(spreadCount, 0) * stride,
    stride,
  }
}

function limitsFor(
  metrics: StackMetrics,
  viewportWidth: number,
  viewportHeight: number,
): { minZoom: number; maxZoom: number } {
  return zoomLimits({
    fitSpread: fitZoom({
      contentWidthPx: metrics.spreadWidth,
      contentHeightPx: metrics.spreadHeight,
      viewportWidth,
      viewportHeight,
      mode: 'contain',
    }),
    fitWidth: fitZoom({
      contentWidthPx: metrics.spreadWidth,
      contentHeightPx: metrics.spreadHeight,
      viewportWidth,
      viewportHeight,
      mode: 'width',
    }),
    fitStack: fitStackZoom({
      stackWidthPx: metrics.stackWidth,
      stackHeightPx: metrics.stackHeight,
      viewportWidth,
      viewportHeight,
    }),
  })
}

function clearGesturePaint(
  world: HTMLElement | null,
  scroll: HTMLElement | null,
): void {
  if (world !== null) {
    world.style.transform = ''
    world.style.willChange = ''
    delete world.dataset.gesture
  }
  if (scroll !== null) {
    scroll.style.touchAction = ''
  }
}

function placedScroll(
  metrics: StackMetrics,
  zoom: number,
  activeIndex: number,
  viewportWidth: number,
  viewportHeight: number,
): ScrollPosition {
  const spreadWidth = metrics.spreadWidth * zoom
  const spreadHeight = metrics.spreadHeight * zoom
  const worldWidth = Math.max(viewportWidth, metrics.stackWidth * zoom)
  return centerSpreadScroll({
    spreadLeftPx: Math.max(0, (worldWidth - spreadWidth) / 2),
    spreadTopPx: activeIndex * metrics.stride * zoom,
    spreadWidthPx: spreadWidth,
    spreadHeightPx: spreadHeight,
    viewportWidth,
    viewportHeight,
    contentWidth: worldWidth,
    contentHeight: metrics.stackHeight * zoom,
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
} {
  const bookRef = useRef({
    spreadCount,
    trimWidthMm,
    trimHeightMm,
    activeIndex,
  })
  const gestureRef = useRef<ActiveGesture | null>(null)
  const pointersRef = useRef(new Map<number, CameraPoint>())
  const spaceRef = useRef(false)
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

  const placeZoom = (zoom: number): void => {
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
    const limits = limitsFor(metrics, scroll.clientWidth, scroll.clientHeight)
    const next = clampZoom(zoom, limits.minZoom, limits.maxZoom)
    if (next === getCommittedZoom()) {
      return
    }
    const placed = placedScroll(
      metrics,
      next,
      activeIndex,
      scroll.clientWidth,
      scroll.clientHeight,
    )
    commitZoom(next, placed.scrollLeft, placed.scrollTop)
  }

  const fitSpreadZoom = (): number | null => {
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
    // Inset absorbs subpixel / late chrome shrink so a fitted spread stays
    // strictly inside the pasteboard (add-spread reveal relies on this).
    const viewport = fitViewportSize(scroll.clientWidth, scroll.clientHeight)
    return fitZoom({
      contentWidthPx: metrics.spreadWidth,
      contentHeightPx: metrics.spreadHeight,
      viewportWidth: viewport.viewportWidth,
      viewportHeight: viewport.viewportHeight,
      mode: 'contain',
    })
  }

  const applyFitSpread = (): void => {
    const next = fitSpreadZoom()
    if (next !== null) {
      placeZoom(next)
    }
  }

  const stopFollowingFit = (): void => {
    stopDelayedFitFollow(delayedFitRef.current, cancelAnimationFrame)
  }

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

    let pendingWheel: {
      deltaY: number
      clientX: number
      clientY: number
    } | null = null

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
      world.style.transformOrigin = '0 0'
      world.style.transform = `translate(${String(frame.translateX)}px, ${String(frame.translateY)}px) scale(${String(frame.scale)})`
      world.style.willChange = 'transform'
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
      if ((!event.ctrlKey && !event.metaKey) || pointersRef.current.size >= 2) {
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
      beginGesture('wheel', port)
      if (pendingWheel === null) {
        pendingWheel = {
          deltaY: event.deltaY,
          clientX: event.clientX,
          clientY: event.clientY,
        }
      } else {
        pendingWheel.deltaY += event.deltaY
        pendingWheel.clientX = event.clientX
        pendingWheel.clientY = event.clientY
      }
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
      if (spaceRef.current) {
        event.preventDefault()
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

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTextField(event.target)) {
        return
      }
      if (event.code === 'Space' || event.key === ' ') {
        const target = event.target
        if (
          target instanceof HTMLButtonElement ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLAnchorElement
        ) {
          return
        }
        event.preventDefault()
        if (!event.repeat) {
          spaceRef.current = true
        }
        return
      }
      const direction = zoomDirection(event)
      if (direction === null) {
        return
      }
      event.preventDefault()
      const port = scrollRef.current
      if (port === null) {
        return
      }
      const book = bookRef.current
      const metrics = stackMetrics(
        book.trimWidthMm,
        book.trimHeightMm,
        book.spreadCount,
        book.activeIndex,
      )
      const limits = limitsFor(metrics, port.clientWidth, port.clientHeight)
      const next = stepZoom(
        getCommittedZoom(),
        direction,
        limits.minZoom,
        limits.maxZoom,
      )
      if (next === getCommittedZoom()) {
        return
      }
      stopFollowingFit()
      const frame = blankFrame()
      const start = getCommittedZoom()
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
        },
        frame,
      )
      commitZoom(frame.zoom, frame.scrollLeft, frame.scrollTop)
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space' || event.key === ' ') {
        spaceRef.current = false
        if (panRef.current !== null) {
          panRef.current = null
          releasePanGesture()
        }
      }
    }

    const pointers = pointersRef.current
    scroll.addEventListener('wheel', onWheel, { passive: false })
    scroll.addEventListener('pointerdown', onPointerDown)
    scroll.addEventListener('pointermove', onPointerMove)
    scroll.addEventListener('pointerup', endPointer)
    scroll.addEventListener('pointercancel', endPointer)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      scroll.removeEventListener('wheel', onWheel)
      scroll.removeEventListener('pointerdown', onPointerDown)
      scroll.removeEventListener('pointermove', onPointerMove)
      scroll.removeEventListener('pointerup', endPointer)
      scroll.removeEventListener('pointercancel', endPointer)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
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
            placeZoom(resolved.zoom)
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
