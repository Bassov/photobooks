import { COVER_CROP, MAX_CROP_ZOOM, type Frame, type RectMm } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import {
  dispatchBookOp,
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
} from './bookStore'
import { cropWheelFactor, panCrop, zoomCrop, type FramePx } from './cropMath'
import { exitCropMode, getCropTarget, type CropTarget } from './cropMode'

type Crop = NonNullable<Frame['crop']>

/** Pointer travel below this is a click, not a pan. */
const DRAG_SLOP_PX = 3
/** Wheel bursts commit this long after the last notch. */
const WHEEL_SETTLE_MS = 140
const NUDGE_PX = 1
const NUDGE_SHIFT_FACTOR = 10

const CROP_FRAME_SELECTOR = '[data-crop-active="true"]'
/** Controls that keep crop mode alive when pressed (inspector section). */
const CROP_KEEP_SELECTOR = '[data-crop-keep]'

interface FrameContext {
  element: HTMLElement
  rect: RectMm
  crop: Crop
  fit: Frame['fit']
  aspect: number
  framePx: FramePx
  /** Layout px per client px (camera zoom inverse). */
  toLayout: number
  target: CropTarget
}

interface PanSession {
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  moved: boolean
  frame: FrameContext
  raf: number | null
}

function activeFrameElement(): HTMLElement | null {
  const element = document.querySelector(CROP_FRAME_SELECTOR)
  return element instanceof HTMLElement ? element : null
}

function frameContext(
  element: HTMLElement,
  target: CropTarget,
): FrameContext | null {
  const book = getBookStoreSnapshot().book
  const frame = book.spreads
    .find((spread) => spread.id === target.spreadId)
    ?.frames.find((item) => item.id === target.frameId)
  if (frame?.assetId === undefined) {
    return null
  }
  const width = element.offsetWidth || frame.rect.width * SPREAD_PX_PER_MM
  const height = element.offsetHeight || frame.rect.height * SPREAD_PX_PER_MM
  const client = element.getBoundingClientRect().width
  return {
    element,
    rect: frame.rect,
    crop: frame.crop ?? COVER_CROP,
    fit: frame.fit,
    aspect: getAssetAspectSnapshot(frame.assetId),
    framePx: { width, height },
    toLayout: client > 0 && element.offsetWidth > 0 ? width / client : 1,
    target,
  }
}

function previewImages(element: HTMLElement): HTMLImageElement[] {
  return Array.from(element.querySelectorAll('img'))
}

function clearPreview(element: HTMLElement): void {
  for (const img of previewImages(element)) {
    img.style.transform = ''
    img.style.transformOrigin = ''
  }
}

function commit(frame: FrameContext, next: Crop): void {
  const prev = frame.crop
  if (
    prev.zoom === next.zoom &&
    prev.center.x === next.center.x &&
    prev.center.y === next.center.y
  ) {
    clearPreview(frame.element)
    return
  }
  dispatchBookOp({
    type: 'setCrop',
    spreadId: frame.target.spreadId,
    frameId: frame.target.frameId,
    crop: next,
  })
}

function isArrow(key: string): boolean {
  return (
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown'
  )
}

function arrowVector(key: string): [number, number] {
  switch (key) {
    case 'ArrowLeft':
      return [-1, 0]
    case 'ArrowRight':
      return [1, 0]
    case 'ArrowUp':
      return [0, -1]
    default:
      return [0, 1]
  }
}

/**
 * Crop-mode gestures: drag pans, wheel zooms, arrows nudge, Esc exits.
 * Preview is a `transform` on the frame images painted in rAF; one crop op is
 * committed at gesture end. Capture-phase so the pasteboard camera never sees
 * wheel / drag events aimed at the cropped frame.
 */
export function installCropGesture(): () => void {
  let pan: PanSession | null = null
  let swallowClick = false
  let wheel: {
    frame: FrameContext
    factor: number
    timer: number
    raf: number | null
  } | null = null

  const paintPan = (session: PanSession): void => {
    session.raf = null
    const dx = (session.x - session.startX) * session.frame.toLayout
    const dy = (session.y - session.startY) * session.frame.toLayout
    for (const img of previewImages(session.frame.element)) {
      img.style.transform = `translate(${String(dx)}px, ${String(dy)}px)`
    }
  }

  const finishPan = (commitPan: boolean): void => {
    const session = pan
    if (session === null) {
      return
    }
    pan = null
    if (session.raf !== null) {
      cancelAnimationFrame(session.raf)
    }
    if (!session.moved || !commitPan) {
      clearPreview(session.frame.element)
      return
    }
    swallowClick = true
    const dx = (session.x - session.startX) * session.frame.toLayout
    const dy = (session.y - session.startY) * session.frame.toLayout
    commit(
      session.frame,
      panCrop(
        session.frame.rect,
        session.frame.crop,
        session.frame.aspect,
        session.frame.framePx,
        dx,
        dy,
        session.frame.fit,
      ),
    )
  }

  const paintWheel = (current: NonNullable<typeof wheel>): void => {
    current.raf = null
    const { frame } = current
    const scale = Math.min(
      MAX_CROP_ZOOM / frame.crop.zoom,
      Math.max(1 / frame.crop.zoom, current.factor),
    )
    for (const img of previewImages(frame.element)) {
      const ox = frame.framePx.width / 2 - img.offsetLeft
      const oy = frame.framePx.height / 2 - img.offsetTop
      img.style.transformOrigin = `${String(ox)}px ${String(oy)}px`
      img.style.transform = `scale(${String(scale)})`
    }
  }

  const flushWheel = (): void => {
    const current = wheel
    if (current === null) {
      return
    }
    wheel = null
    window.clearTimeout(current.timer)
    if (current.raf !== null) {
      cancelAnimationFrame(current.raf)
    }
    const { frame } = current
    commit(
      frame,
      zoomCrop(frame.rect, frame.crop, frame.aspect, current.factor, frame.fit),
    )
  }

  const onPointerDown = (event: PointerEvent): void => {
    swallowClick = false
    const cropTarget = getCropTarget()
    if (cropTarget === null || event.button !== 0) {
      return
    }
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const element = target.closest(CROP_FRAME_SELECTOR)
    if (!(element instanceof HTMLElement)) {
      if (target.closest(CROP_KEEP_SELECTOR) === null) {
        flushWheel()
        exitCropMode()
      }
      return
    }
    flushWheel()
    const frame = frameContext(element, cropTarget)
    if (frame === null) {
      return
    }
    event.preventDefault()
    pan = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      frame,
      raf: null,
    }
  }

  const onPointerMove = (event: PointerEvent): void => {
    const session = pan
    if (session?.pointerId !== event.pointerId) {
      return
    }
    measureHandlerSync('crop-pan', () => {
      session.x = event.clientX
      session.y = event.clientY
      if (
        !session.moved &&
        Math.hypot(session.x - session.startX, session.y - session.startY) <
          DRAG_SLOP_PX
      ) {
        return
      }
      session.moved = true
      session.raf ??= requestAnimationFrame(() => {
        paintPan(session)
      })
    })
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (pan !== null && event.pointerId === pan.pointerId) {
      finishPan(event.type === 'pointerup')
    }
  }

  const onClick = (event: MouseEvent): void => {
    if (swallowClick) {
      swallowClick = false
      event.stopPropagation()
      event.preventDefault()
    }
  }

  const onWheel = (event: WheelEvent): void => {
    const cropTarget = getCropTarget()
    if (cropTarget === null || !(event.target instanceof Element)) {
      return
    }
    const element = event.target.closest(CROP_FRAME_SELECTOR)
    if (!(element instanceof HTMLElement)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (wheel === null) {
      const frame = frameContext(element, cropTarget)
      if (frame === null) {
        return
      }
      wheel = { frame, factor: 1, timer: 0, raf: null }
    }
    const current = wheel
    current.factor *= cropWheelFactor(event.deltaY)
    window.clearTimeout(current.timer)
    current.timer = window.setTimeout(flushWheel, WHEEL_SETTLE_MS)
    current.raf ??= requestAnimationFrame(() => {
      paintWheel(current)
    })
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const cropTarget = getCropTarget()
    if (cropTarget === null) {
      return
    }
    if (event.key === 'Escape') {
      flushWheel()
      finishPan(false)
      exitCropMode()
      return
    }
    if (
      !isArrow(event.key) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return
    }
    const element = activeFrameElement()
    const frame = element === null ? null : frameContext(element, cropTarget)
    if (frame === null) {
      return
    }
    event.preventDefault()
    const step = NUDGE_PX * (event.shiftKey ? NUDGE_SHIFT_FACTOR : 1)
    const [vx, vy] = arrowVector(event.key)
    commit(
      frame,
      panCrop(
        frame.rect,
        frame.crop,
        frame.aspect,
        frame.framePx,
        vx * step,
        vy * step,
        frame.fit,
      ),
    )
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointermove', onPointerMove, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerUp, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('wheel', onWheel, { capture: true, passive: false })
  document.addEventListener('keydown', onKeyDown, true)
  return () => {
    finishPan(false)
    flushWheel()
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('pointermove', onPointerMove, true)
    document.removeEventListener('pointerup', onPointerUp, true)
    document.removeEventListener('pointercancel', onPointerUp, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('wheel', onWheel, true)
    document.removeEventListener('keydown', onKeyDown, true)
  }
}
