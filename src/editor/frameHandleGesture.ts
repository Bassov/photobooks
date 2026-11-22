import {
  findBookFrame,
  findSpreadFrame,
  MIN_FRAME_EDGE_MM,
  resizeFrameKeepPhoto,
  type Book,
  type Frame,
} from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import {
  dispatchBookOp,
  getAssetAspectSnapshot,
  getBookStoreSnapshot,
} from './bookStore'
import { getCropTarget } from './cropMode'
import { editorKeysSuspended } from './editorKeysGate'
import { STATUS_FRAME_LOCKED, setEditorStatus } from './editorStatus'
import { getEditorTool } from './editorToolStore'
import {
  getFrameSelection,
  setFrameSource,
  sourceFrame,
} from './frameSelection'
import {
  clearSnapLines,
  gridSnapActive,
  paintSnapLines,
  placeBox,
  round,
  snapBypassed,
  spreadContext,
  type SpreadContext,
} from './frameGesture'
import { clearLiveGeometry, publishLiveGeometry } from './liveGeometry'
import { setSnapHint } from './snapHint'
import { snapEdges, type SnapLine } from './snapIndex'
import {
  RESIZE_HANDLES,
  ROTATE_HANDLE,
  pointerAngleDeg,
  resizeRectByHandle,
  rotatedDeg,
  type ResizeHandle,
} from './frameHandleMath'
import { isTypingTarget } from './isTypingTarget'
import { photoBoxPainter, type PhotoBoxPainter } from './photoBoxPaint'
import { handleOwner, paintedOf } from './selectionPeer'

const SPREAD_SELECTOR = '[data-testid="spread-view"]'
const NUDGE_MM = 1
const NUDGE_SHIFT_MM = 10
/** Pointer travel (client px) before a handle press becomes a gesture. */
const SLOP_PX = 2
/** On the frame while the rotate knob is dragged: the angle chip shows. */
const ROTATING_ATTR = 'data-rotating'
const ROTATE_CHIP_SELECTOR = '[data-rotate-chip]'

const ARROW_DELTAS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

type Rect = Frame['rect']

interface Session {
  pointerId: number
  ctx: SpreadContext
  frameId: string
  /** The frame button (a copy's, for a handle on its selection peer). */
  button: HTMLElement
  /** The frame button, plus a copy's selection peer (live writes on both). */
  painted: HTMLElement[]
  handle: ResizeHandle | typeof ROTATE_HANDLE
  startX: number
  startY: number
  rect0: Rect
  rotation0: number
  /** Pointer angle at press (rotate only). */
  startAngle: number
  rect: Rect
  rotation: number
  started: boolean
  saved: { left: string; top: string; width: string; height: string }
  savedTransform: string
  /** A photo frame keeps its photo on the page (direct crop). */
  photo: { book: Book; aspect: number; painter: PhotoBoxPainter } | null
}

function photoSession(
  button: HTMLElement,
  frame: Frame,
  aspect: number,
): NonNullable<Session['photo']> {
  return {
    book: getBookStoreSnapshot().book,
    aspect,
    // Layout px per mm: the frame's own box, whatever the camera zoom.
    painter: photoBoxPainter(
      button,
      aspect,
      button.offsetWidth / frame.rect.width,
    ),
  }
}

function isResizeHandle(id: string): id is ResizeHandle {
  return (RESIZE_HANDLES as readonly string[]).includes(id)
}

/**
 * Selection handles on the selected frame: resize (8 handles), rotate (round
 * handle), arrow-key nudges and click-empty deselect. Previews are direct DOM
 * writes on the frame button; one BookOp is committed at gesture end (one undo
 * step). Alt = from centre, Shift = keep proportions / 15° rotation steps.
 * Resizes snap their dragged edges to frames / page anchors (Alt or the snap
 * toggle off: no snap) and, while the grid is shown, to column / row edges.
 */
export function installFrameHandleGesture(): () => void {
  let session: Session | null = null
  let swallowClick = false

  const armSwallow = (): void => {
    swallowClick = true
    setTimeout(() => {
      swallowClick = false
    }, 0)
  }

  const swallowRelease = (): void => {
    window.removeEventListener('pointerup', swallowRelease)
    armSwallow()
  }

  const restore = (current: Session): void => {
    for (const { style } of current.painted) {
      style.left = current.saved.left
      style.top = current.saved.top
      style.width = current.saved.width
      style.height = current.saved.height
      style.transform = current.savedTransform
    }
    for (const element of current.painted) {
      element.removeAttribute(ROTATING_ATTR)
    }
    current.photo?.painter.restore()
  }

  const finish = (): Session | null => {
    const current = session
    session = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    if (current !== null) {
      clearSnapLines(current.ctx)
      setSnapHint(null)
      clearLiveGeometry()
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
    const handleEl = event.target.closest<HTMLElement>('[data-handle]')
    const button = handleEl === null ? null : handleOwner(handleEl)
    const spreadEl = button?.closest<HTMLElement>(SPREAD_SELECTOR)
    const handle = handleEl?.getAttribute('data-handle') ?? ''
    if (
      !button ||
      !spreadEl ||
      getEditorTool() !== 'select' ||
      !(handle === ROTATE_HANDLE || isResizeHandle(handle)) ||
      getCropTarget() !== null
    ) {
      return
    }
    const frameId = button.getAttribute('data-frame-id') ?? ''
    const ctx = spreadContext(spreadEl, [frameId])
    if (ctx === null) {
      return
    }
    const frame = findSpreadFrame(ctx.spread, frameId)
    if (frame === undefined) {
      return
    }
    // The press belongs to the handle: no frame move, no click toggle.
    event.preventDefault()
    if (frame.locked === true) {
      setEditorStatus(STATUS_FRAME_LOCKED)
      armSwallow()
      return
    }
    const centerX =
      ctx.left + (frame.rect.x + frame.rect.width / 2) * ctx.pxPerMm
    const centerY =
      ctx.top + (frame.rect.y + frame.rect.height / 2) * ctx.pxPerMm
    const { style } = button
    session = {
      pointerId: event.pointerId,
      ctx,
      frameId,
      button,
      painted: paintedOf(button),
      handle,
      startX: event.clientX,
      startY: event.clientY,
      rect0: frame.rect,
      rotation0: frame.rotationDeg ?? 0,
      startAngle: pointerAngleDeg(
        centerX,
        centerY,
        event.clientX,
        event.clientY,
      ),
      rect: frame.rect,
      rotation: frame.rotationDeg ?? 0,
      started: false,
      saved: {
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
      },
      savedTransform: style.transform,
      photo:
        frame.assetId === undefined
          ? null
          : photoSession(button, frame, getAssetAspectSnapshot(frame.assetId)),
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
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
    current.started = true
    measureHandlerSync('frame-handle-gesture', () => {
      if (current.handle === ROTATE_HANDLE) {
        rotateMove(current, event)
      } else {
        resizeMove(current, current.handle, event)
      }
      publishLiveGeometry({
        spreadId: current.ctx.spreadId,
        frameId: current.frameId,
        rect: current.rect,
        rotationDeg: current.rotation,
      })
    })
  }

  function resizeMove(
    current: Session,
    handle: ResizeHandle,
    event: PointerEvent,
  ): void {
    const { ctx } = current
    current.rect = resizeRectByHandle(
      current.rect0,
      current.rotation0,
      handle,
      (event.clientX - current.startX) / ctx.pxPerMm,
      (event.clientY - current.startY) / ctx.pxPerMm,
      { keepRatio: event.shiftKey, fromCenter: event.altKey },
    )
    // Axis-aligned, free-ratio resizes snap the dragged edges; Alt / snap off
    // / rotated / Shift-ratio leave the pointer result untouched.
    const snapped =
      current.rotation0 === 0 && !event.shiftKey && !snapBypassed(event)
        ? snapResizedRect(current, handle, event)
        : null
    if (snapped !== null) {
      current.rect = snapped.rect
    }
    paintSnapLines(ctx, snapped?.lines ?? [])
    setSnapHint(snapped?.hint ?? null, ctx.spreadId)
    for (const el of current.painted) {
      placeBox(el, ctx, current.rect)
    }
    // The commit's own op on the gesture's book: the photo stays put.
    const { photo } = current
    const kept =
      photo === null
        ? undefined
        : findBookFrame(
            resizeFrameKeepPhoto(
              photo.book,
              ctx.spreadId,
              current.frameId,
              current.rect,
              photo.aspect,
            ),
            ctx.spreadId,
            current.frameId,
          )
    if (kept !== undefined) {
      photo?.painter.paint(kept)
    }
  }

  function snapResizedRect(
    current: Session,
    handle: ResizeHandle,
    event: PointerEvent,
  ): { rect: Rect; lines: SnapLine[]; hint: string | null } | null {
    const { rect } = current
    const hit = snapEdges(
      current.ctx.index,
      rect,
      {
        left: handle.includes('w'),
        right: handle.includes('e'),
        top: handle.includes('n'),
        bottom: handle.includes('s'),
      },
      {
        pxPerMm: current.ctx.pxPerMm,
        altKey: false,
        grid: gridSnapActive(event),
      },
    )
    const west = handle.includes('w')
    const north = handle.includes('n')
    const width = rect.width + (west ? -hit.dx : hit.dx)
    const height = rect.height + (north ? -hit.dy : hit.dy)
    if (width < MIN_FRAME_EDGE_MM || height < MIN_FRAME_EDGE_MM) {
      return null
    }
    return {
      rect: {
        x: west ? rect.x + hit.dx : rect.x,
        y: north ? rect.y + hit.dy : rect.y,
        width,
        height,
      },
      lines: hit.lines,
      hint: hit.hint,
    }
  }

  function rotateMove(current: Session, event: PointerEvent): void {
    const { ctx, rect0 } = current
    const centerX = ctx.left + (rect0.x + rect0.width / 2) * ctx.pxPerMm
    const centerY = ctx.top + (rect0.y + rect0.height / 2) * ctx.pxPerMm
    current.rotation = rotatedDeg(
      current.rotation0,
      current.startAngle,
      pointerAngleDeg(centerX, centerY, event.clientX, event.clientY),
      event.shiftKey,
    )
    const angle = `${String(Math.round(current.rotation))}°`
    for (const element of current.painted) {
      element.style.transform = `rotate(${String(current.rotation)}deg)`
      // §A rotate chip (src/render/SpreadView.tsx): shown while rotating.
      element.setAttribute(ROTATING_ATTR, '')
      const chip = element.querySelector(ROTATE_CHIP_SELECTOR)
      if (chip !== null) {
        chip.textContent = angle
      }
    }
  }

  function onUp(event: PointerEvent): void {
    const current = session
    if (current?.pointerId !== event.pointerId) {
      return
    }
    finish()
    // The press never reaches the frame's click toggle.
    armSwallow()
    // A copy's handle sits outside its button: the press focused the
    // pasteboard, so Delete / arrows would miss the frame. Own: a no-op.
    current.button.focus({ preventScroll: true })
    if (!current.started) {
      return
    }
    // Back to the React-owned styles, then one op for the whole gesture.
    restore(current)
    const { spreadId } = current.ctx
    if (current.handle === ROTATE_HANDLE) {
      dispatchBookOp({
        type: 'rotateFrame',
        spreadId,
        frameId: current.frameId,
        rotationDeg: round(current.rotation),
      })
    } else {
      // Direct crop: the frame reveals or hides the photo, which stays put
      // (a frame without a photo just takes the rect).
      dispatchBookOp({
        type: 'resizeFrameKeepPhoto',
        spreadId,
        frameId: current.frameId,
        rect: {
          x: round(current.rect.x),
          y: round(current.rect.y),
          width: round(current.rect.width),
          height: round(current.rect.height),
        },
        ...(current.photo === null
          ? {}
          : { aspectRatio: current.photo.aspect }),
      })
    }
  }

  function onCancel(): void {
    const current = finish()
    if (current?.started === true) {
      restore(current)
    }
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && session !== null) {
      event.stopPropagation()
      onCancel()
      // The button is still down (resize or rotate handle): its release must
      // not click through and deselect the frame that was just restored.
      window.addEventListener('pointerup', swallowRelease)
      return
    }
    const arrow = ARROW_DELTAS[event.key]
    const selection = getFrameSelection()
    if (
      arrow === undefined ||
      editorKeysSuspended() ||
      selection === null ||
      session !== null ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTypingTarget(event.target) ||
      getCropTarget() !== null ||
      !(event.target instanceof Element) ||
      (event.target !== document.body &&
        event.target.closest('button.spread-frame') === null)
    ) {
      return
    }
    const { spreadId } = selection
    const frames = selection.frameIds.flatMap((frameId) => {
      const frame = sourceFrame({ spreadId, frameId })
      return frame === undefined ? [] : [frame]
    })
    if (frames.length === 0) {
      return
    }
    // A set must not fall through to the pasteboard's arrow scroll either.
    event.preventDefault()
    const unlocked = frames.filter((frame) => frame.locked !== true)
    if (unlocked.length === 0) {
      setEditorStatus(STATUS_FRAME_LOCKED)
      return
    }
    const step = event.shiftKey ? NUDGE_SHIFT_MM : NUDGE_MM
    // One step per press for one frame or a set ("Move frame" / "Move N frames").
    dispatchBookOp({
      type: 'moveFrames',
      spreadId,
      frameIds: unlocked.map((frame) => frame.id),
      dx: arrow[0] * step,
      dy: arrow[1] * step,
    })
  }

  const onClick = (event: MouseEvent): void => {
    if (swallowClick) {
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    // A click on bare pasteboard / spread paper clears the selection.
    if (
      getEditorTool() === 'select' &&
      getFrameSelection() !== null &&
      event.target instanceof Element &&
      event.target.closest('[data-testid="pasteboard"]') !== null &&
      event.target.closest('.spread-frame') === null &&
      !isTypingTarget(event.target)
    ) {
      setFrameSource(null)
      setEditorStatus('')
    }
  }

  document.addEventListener('pointerdown', onDown, true)
  document.addEventListener('click', onClick, true)
  window.addEventListener('keydown', onKey, true)
  return () => {
    finish()
    document.removeEventListener('pointerdown', onDown, true)
    document.removeEventListener('click', onClick, true)
    window.removeEventListener('keydown', onKey, true)
  }
}
