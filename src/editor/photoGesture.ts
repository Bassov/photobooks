import { COVER_CROP, findSpreadFrame, type Frame } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { dispatchBookOp, getAssetAspectSnapshot } from './bookStore'
import { panCrop, scaleCrop, type PhotoCorner } from './cropMath'
import { getCropTarget } from './cropMode'
import { getEditorTool } from './editorToolStore'
import { spreadContext, type SpreadContext } from './frameGesture'
import { photoBoxPainter, type PhotoBoxPainter } from './photoBoxPaint'

type Crop = NonNullable<Frame['crop']>

const SPREAD_SELECTOR = '[data-testid="spread-view"]'
/** Grabber and shown ghost (src/render/PhotoChrome.tsx). */
const PAN_SELECTOR = '[data-photo-pan]'
const HANDLE_SELECTOR = '[data-photo-handle]'
const TAG_SELECTOR = '[data-testid="photo-crop-tag"]'
/** On the frame button while a photo gesture runs: chrome follows in CSS. */
const GESTURE_ATTR = 'data-photo-gesture'
/** Pointer travel (client px) before a press becomes a gesture. */
const SLOP_PX = 2
const CORNERS: readonly string[] = ['nw', 'ne', 'sw', 'se']

interface Session {
  pointerId: number
  kind: 'pan' | PhotoCorner
  button: HTMLElement
  handle: HTMLElement | null
  tag: HTMLElement | null
  ctx: SpreadContext
  frame: Frame
  crop: Crop
  aspect: number
  painter: PhotoBoxPainter
  startX: number
  startY: number
  started: boolean
  next: { crop: Crop; fit: NonNullable<Frame['fit']> } | null
}

function isCorner(id: string): id is PhotoCorner {
  return CORNERS.includes(id)
}

/** A client-px vector in the frame's own (unrotated) axes, in mm. */
function frameVector(
  session: Session,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const rad = (-(session.frame.rotationDeg ?? 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const { pxPerMm } = session.ctx
  return {
    x: (dx * cos - dy * sin) / pxPerMm,
    y: (dx * sin + dy * cos) / pxPerMm,
  }
}

function nextCrop(
  session: Session,
  event: PointerEvent,
): NonNullable<Session['next']> {
  const { frame, ctx, crop, aspect } = session
  const { rect } = frame
  const fit = frame.fit ?? 'fill'
  if (session.kind === 'pan') {
    const move = frameVector(
      session,
      event.clientX - session.startX,
      event.clientY - session.startY,
    )
    return {
      crop: panCrop(
        rect,
        crop,
        aspect,
        { width: rect.width, height: rect.height },
        move.x,
        move.y,
        fit,
      ),
      fit,
    }
  }
  // The pointer in frame-local mm (from the frame's top-left corner).
  const centreX = ctx.left + (rect.x + rect.width / 2) * ctx.pxPerMm
  const centreY = ctx.top + (rect.y + rect.height / 2) * ctx.pxPerMm
  const local = frameVector(
    session,
    event.clientX - centreX,
    event.clientY - centreY,
  )
  return scaleCrop(
    rect,
    crop,
    aspect,
    fit,
    session.kind,
    { x: local.x + rect.width / 2, y: local.y + rect.height / 2 },
    event.altKey,
  )
}

/**
 * Direct-crop photo gestures on a selected photo frame (Designer
 * walkthrough-ux-review §A): the grabber or the shown ghost pans the photo,
 * a corner photo handle scales it aspect-locked about the opposite corner
 * (Alt: centre). Previews write the photo box (the committed layout); one
 * history step per gesture, also when Fit grows into Fill. Window capture, so
 * the press never reaches the frame / crop / marquee gestures.
 */
export function installPhotoGesture(): () => void {
  let session: Session | null = null
  let swallowClick = false
  let gestures = 0

  const finish = (): Session | null => {
    const current = session
    session = null
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onCancel, true)
    if (current !== null) {
      current.painter.restore()
      current.button.removeAttribute(GESTURE_ATTR)
      current.handle?.removeAttribute('data-active')
    }
    return current
  }

  const onDown = (event: PointerEvent): void => {
    if (
      session !== null ||
      event.button !== 0 ||
      !(event.target instanceof Element)
    ) {
      return
    }
    const handle = event.target.closest<HTMLElement>(HANDLE_SELECTOR)
    const grip = handle ?? event.target.closest<HTMLElement>(PAN_SELECTOR)
    const button = grip?.closest<HTMLElement>('button.spread-frame')
    const spreadEl = button?.closest<HTMLElement>(SPREAD_SELECTOR)
    const corner = handle?.getAttribute('data-photo-handle') ?? ''
    const frameId = button?.getAttribute('data-frame-id') ?? ''
    const pinned = getCropTarget()
    if (
      !button ||
      !spreadEl ||
      getEditorTool() !== 'select' ||
      // Pinned crop (§A): only the cropped frame's corner handles; its pans
      // stay with src/editor/cropGesture.ts.
      (pinned !== null && (pinned.frameId !== frameId || handle === null)) ||
      (handle !== null && !isCorner(corner))
    ) {
      return
    }
    const ctx = spreadContext(spreadEl, [frameId])
    const frame =
      ctx === null ? undefined : findSpreadFrame(ctx.spread, frameId)
    if (ctx === null || frame?.assetId === undefined || frame.locked === true) {
      return
    }
    // The press belongs to the photo: no frame move, marquee or drag.
    event.preventDefault()
    event.stopPropagation()
    const aspect = getAssetAspectSnapshot(frame.assetId)
    session = {
      pointerId: event.pointerId,
      kind: isCorner(corner) ? corner : 'pan',
      button,
      handle,
      tag: button.querySelector<HTMLElement>(TAG_SELECTOR),
      ctx,
      frame,
      crop: frame.crop ?? COVER_CROP,
      aspect,
      painter: photoBoxPainter(
        button,
        aspect,
        button.offsetWidth / frame.rect.width,
      ),
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      next: null,
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
  }

  function onMove(event: PointerEvent): void {
    const current = session
    if (current?.pointerId !== event.pointerId) {
      return
    }
    if (
      !current.started &&
      Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY,
      ) < SLOP_PX
    ) {
      return
    }
    if (!current.started) {
      current.started = true
      current.button.setAttribute(GESTURE_ATTR, current.kind)
      current.handle?.setAttribute('data-active', 'true')
    }
    measureHandlerSync('photo-gesture', () => {
      const next = nextCrop(current, event)
      current.next = next
      current.painter.paint({ rect: current.frame.rect, ...next })
      if (current.tag !== null) {
        current.tag.textContent = `Crop · ${String(Math.round(next.crop.zoom * 100))}%`
      }
    })
  }

  function onUp(event: PointerEvent): void {
    const current = session
    if (current?.pointerId !== event.pointerId) {
      return
    }
    finish()
    const { next } = current
    if (!current.started || next === null) {
      return
    }
    // A clamped drag that moved nothing: a click, no history step.
    swallowClick = true
    setTimeout(() => {
      swallowClick = false
    }, 0)
    const unchanged =
      next.fit === (current.frame.fit ?? 'fill') &&
      next.crop.zoom === current.crop.zoom &&
      next.crop.center.x === current.crop.center.x &&
      next.crop.center.y === current.crop.center.y
    if (unchanged) {
      return
    }
    const spreadId = current.ctx.spreadId
    const frameId = current.frame.id
    // One step per gesture: Fit → Fill and the crop share a fresh key.
    gestures += 1
    const key = `photo:${spreadId}:${frameId}:${String(gestures)}`
    if (next.fit !== (current.frame.fit ?? 'fill')) {
      dispatchBookOp({ type: 'setFit', spreadId, frameId, fit: next.fit }, key)
    }
    dispatchBookOp({ type: 'setCrop', spreadId, frameId, crop: next.crop }, key)
  }

  function onCancel(): void {
    finish()
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && session !== null) {
      event.stopPropagation()
      onCancel()
    }
  }

  const onClick = (event: MouseEvent): void => {
    if (swallowClick) {
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
    }
  }

  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('click', onClick, true)
  window.addEventListener('keydown', onKey, true)
  return () => {
    finish()
    window.removeEventListener('pointerdown', onDown, true)
    window.removeEventListener('click', onClick, true)
    window.removeEventListener('keydown', onKey, true)
  }
}
