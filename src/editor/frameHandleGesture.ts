import { MIN_FRAME_EDGE_MM, type Frame } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { dispatchBookOp, getBookStoreSnapshot } from './bookStore'
import { getCropTarget } from './cropMode'
import { STATUS_FRAME_LOCKED, setEditorStatus } from './editorStatus'
import { getEditorTool } from './editorToolStore'
import { getFrameSource, setFrameSource } from './frameSelection'
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

const SPREAD_SELECTOR = '[data-testid="spread-view"]'
const NUDGE_MM = 1
const NUDGE_SHIFT_MM = 10
/** Pointer travel (client px) before a handle press becomes a gesture. */
const SLOP_PX = 2

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
  button: HTMLElement
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
}

function isResizeHandle(id: string): id is ResizeHandle {
  return (RESIZE_HANDLES as readonly string[]).includes(id)
}

function findFrame(spreadId: string, frameId: string): Frame | undefined {
  return getBookStoreSnapshot()
    .book.spreads.find((spread) => spread.id === spreadId)
    ?.frames.find((frame) => frame.id === frameId)
}

/** Keep the size tag in step with the live preview. */
function writeSizeTag(button: HTMLElement, rect: Rect): void {
  const tag = button.querySelector('[data-testid="frame-size-tag"]')
  if (tag !== null) {
    tag.textContent = `${String(round(rect.width))} × ${String(round(rect.height))} mm`
  }
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

  const restore = (current: Session): void => {
    const { style } = current.button
    style.left = current.saved.left
    style.top = current.saved.top
    style.width = current.saved.width
    style.height = current.saved.height
    style.transform = current.savedTransform
    writeSizeTag(current.button, current.rect0)
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
    const button = handleEl?.closest<HTMLElement>('button.spread-frame')
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
    const ctx = spreadContext(spreadEl, frameId)
    const frame = ctx === null ? undefined : findFrame(ctx.spreadId, frameId)
    if (ctx === null || frame === undefined) {
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
    placeBox(current.button, ctx, current.rect)
    writeSizeTag(current.button, current.rect)
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
    current.button.style.transform = `rotate(${String(current.rotation)}deg)`
  }

  function onUp(event: PointerEvent): void {
    const current = session
    if (current?.pointerId !== event.pointerId) {
      return
    }
    finish()
    // The press never reaches the frame's click toggle.
    armSwallow()
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
      dispatchBookOp({
        type: 'resizeFrame',
        spreadId,
        frameId: current.frameId,
        rect: {
          x: round(current.rect.x),
          y: round(current.rect.y),
          width: round(current.rect.width),
          height: round(current.rect.height),
        },
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
      return
    }
    const arrow = ARROW_DELTAS[event.key]
    const source = getFrameSource()
    if (
      arrow === undefined ||
      source === null ||
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
    const frame = findFrame(source.spreadId, source.frameId)
    if (frame === undefined) {
      return
    }
    event.preventDefault()
    if (frame.locked === true) {
      setEditorStatus(STATUS_FRAME_LOCKED)
      return
    }
    const step = event.shiftKey ? NUDGE_SHIFT_MM : NUDGE_MM
    dispatchBookOp({
      type: 'moveFrame',
      spreadId: source.spreadId,
      frameId: source.frameId,
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
      getFrameSource() !== null &&
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
