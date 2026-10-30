import {
  MIN_FRAME_EDGE_MM,
  getSpreadPageCount,
  getSpreadSizeMm,
  nextFrameId,
  type RectMm,
  type Spread,
} from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { dispatchBookOp, getBookStoreSnapshot } from './bookStore'
import { getCropTarget } from './cropMode'
import { isSpacePanCode } from './editorChromePanels'
import { getEditorTool, setEditorTool } from './editorToolStore'
import { STATUS_FRAME_LOCKED, setEditorStatus } from './editorStatus'
import { setFrameSource } from './frameSelection'
import { buildGridAnchors } from './gridSnap'
import { getGridVisible, getSnapOn } from './gridView'
import { setSnapHint } from './snapHint'
import { isTypingTarget } from './isTypingTarget'
import {
  buildSnapIndex,
  snapPoint,
  snapRect,
  type SnapIndex,
  type SnapLine,
} from './snapIndex'

/** Pointer travel (client px) below which a press on an empty frame is a click. */
const MOVE_SLOP_PX = 3
const SPREAD_SELECTOR = '[data-testid="spread-view"]'

export interface SpreadContext {
  spreadId: string
  /** The spread as it was when the gesture started. */
  spread: Spread
  element: HTMLElement
  left: number
  top: number
  widthMm: number
  heightMm: number
  /** Client px per mm (layout px × camera zoom). */
  pxPerMm: number
  index: SnapIndex
}

interface DrawSession {
  kind: 'draw'
  pointerId: number
  ctx: SpreadContext
  origin: { x: number; y: number }
  rect: RectMm | null
  draft: HTMLElement
}

interface MoveSession {
  kind: 'move'
  pointerId: number
  ctx: SpreadContext
  frameId: string
  button: HTMLElement
  startX: number
  startY: number
  rect0: RectMm
  rect: RectMm
  started: boolean
  /** A locked frame only reports; it never moves. */
  locked: boolean
  saved: { left: string; top: string }
}

type Session = DrawSession | MoveSession

export function round(mm: number): number {
  return Math.round(mm * 10) / 10
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi)
}

export function spreadContext(
  element: HTMLElement,
  excludeFrameId: string | null,
): SpreadContext | null {
  const spreadId = element.getAttribute('data-spread-id')
  const book = getBookStoreSnapshot().book
  const spreadIndex = book.spreads.findIndex((item) => item.id === spreadId)
  const spread = book.spreads[spreadIndex]
  if (spread === undefined) {
    return null
  }
  const box = element.getBoundingClientRect()
  const { widthMm, heightMm } = getSpreadSizeMm(book, spreadIndex)
  if (box.width <= 0 || box.height <= 0) {
    return null
  }
  return {
    spreadId: spread.id,
    spread,
    element,
    left: box.left,
    top: box.top,
    widthMm,
    heightMm,
    pxPerMm: box.width / widthMm,
    index: buildSnapIndex(
      spread.frames
        .filter((frame) => frame.id !== excludeFrameId)
        .map((frame) => frame.rect),
      [...book.guides, ...(spread.guides ?? [])],
      {
        widthMm,
        heightMm,
        pageCount: getSpreadPageCount(spreadIndex, book.spreads.length),
      },
      // Built once per gesture, and only while the grid is shown; toggling
      // the grid mid-gesture leaves the anchors as built.
      getGridVisible() && getSnapOn()
        ? buildGridAnchors(book, spreadIndex)
        : undefined,
    ),
  }
}

/** Grid snap runs while the grid is visible, unless Alt or the snap toggle bypass. */
export function gridSnapActive(event: { altKey: boolean }): boolean {
  return getGridVisible() && !snapBypassed(event)
}

/** Alt held or the TopBar snap toggle off: the gesture runs without snapping. */
export function snapBypassed(event: { altKey: boolean }): boolean {
  return event.altKey || !getSnapOn()
}

function pct(mm: number, total: number): string {
  return `${String((mm / total) * 100)}%`
}

export function placeBox(
  el: HTMLElement,
  ctx: SpreadContext,
  rect: RectMm,
): void {
  el.style.left = pct(rect.x, ctx.widthMm)
  el.style.top = pct(rect.y, ctx.heightMm)
  el.style.width = pct(rect.width, ctx.widthMm)
  el.style.height = pct(rect.height, ctx.heightMm)
}

/** Editor-layer snap lines inside the spread; removed at gesture end. */
export function paintSnapLines(
  ctx: SpreadContext,
  lines: readonly SnapLine[],
): void {
  const host = ctx.element
  const existing = host.querySelectorAll<HTMLElement>('.snap-line')
  existing.forEach((node) => {
    node.remove()
  })
  for (const line of lines) {
    const node = document.createElement('div')
    node.className = 'snap-line'
    node.setAttribute('data-testid', 'snap-line')
    node.setAttribute('data-axis', line.axis)
    node.setAttribute('aria-hidden', 'true')
    if (line.axis === 'x') {
      node.style.left = pct(line.mm, ctx.widthMm)
    } else {
      node.style.top = pct(line.mm, ctx.heightMm)
    }
    // Grid snaps are labelled by the `snap · column N` pill, not on the line.
    if (line.kind !== 'grid') {
      const label = document.createElement('span')
      label.className = 'snap-line-label'
      label.textContent = `snap · ${line.kind}`
      node.append(label)
    }
    host.append(node)
  }
}

export function clearSnapLines(ctx: SpreadContext): void {
  paintSnapLines(ctx, [])
}

/**
 * Frame tool + free move.
 * - Frame tool: dragging on an empty spread draws an image frame (≥ 5 mm both
 *   edges), selects it and returns to Select.
 * - Select tool: dragging an empty frame moves it.
 * Both snap to other frames / guides / equal gaps through the anchor index
 * built at gesture start; Alt suppresses it. The preview is direct DOM writes;
 * one op is committed at gesture end (one undo step).
 */
export function installFrameGesture(): () => void {
  let session: Session | null = null
  let swallowClick = false
  let spaceDown = false

  const finish = (): void => {
    const current = session
    session = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    if (current === null) {
      return
    }
    clearSnapLines(current.ctx)
    setSnapHint(null)
    if (current.kind === 'draw') {
      current.draft.remove()
    }
  }

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

  const onDown = (event: PointerEvent): void => {
    if (
      session !== null ||
      spaceDown ||
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      isTypingTarget(event.target) ||
      getCropTarget() !== null ||
      document.querySelector('[data-panning]') !== null
    ) {
      return
    }
    const spreadEl = event.target.closest<HTMLElement>(SPREAD_SELECTOR)
    if (spreadEl === null) {
      return
    }
    const tool = getEditorTool()
    const frameEl = event.target.closest<HTMLElement>('.spread-frame')
    if (
      tool === 'frame' &&
      (frameEl === null || event.target.closest('[data-handle]') !== null)
    ) {
      const ctx = spreadContext(spreadEl, null)
      if (ctx === null) {
        return
      }
      event.preventDefault()
      const draft = document.createElement('div')
      draft.className = 'frame-draft'
      draft.setAttribute('data-testid', 'frame-draft')
      draft.setAttribute('aria-hidden', 'true')
      ctx.element.append(draft)
      const raw = {
        x: clamp((event.clientX - ctx.left) / ctx.pxPerMm, 0, ctx.widthMm),
        y: clamp((event.clientY - ctx.top) / ctx.pxPerMm, 0, ctx.heightMm),
      }
      const snap = snapPoint(ctx.index, raw, {
        pxPerMm: ctx.pxPerMm,
        altKey: snapBypassed(event),
      })
      session = {
        kind: 'draw',
        pointerId: event.pointerId,
        ctx,
        origin: { x: raw.x + snap.dx, y: raw.y + snap.dy },
        rect: null,
        draft,
      }
    } else if (
      tool === 'select' &&
      frameEl instanceof HTMLButtonElement &&
      event.target.closest('[data-handle]') === null &&
      // A selected filled frame moves by its body; unselected filled ones
      // keep the photo drag-and-drop.
      (frameEl.getAttribute('data-filled') === 'false' ||
        frameEl.getAttribute('aria-pressed') === 'true')
    ) {
      const frameId = frameEl.getAttribute('data-frame-id') ?? ''
      const ctx = spreadContext(spreadEl, frameId)
      const frame = getBookStoreSnapshot()
        .book.spreads.find((item) => item.id === ctx?.spreadId)
        ?.frames.find((item) => item.id === frameId)
      if (ctx === null || frame === undefined) {
        return
      }
      session = {
        kind: 'move',
        pointerId: event.pointerId,
        ctx,
        frameId,
        button: frameEl,
        startX: event.clientX,
        startY: event.clientY,
        rect0: frame.rect,
        rect: frame.rect,
        started: false,
        locked: frame.locked === true,
        saved: { left: frameEl.style.left, top: frameEl.style.top },
      }
    } else {
      return
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
    measureHandlerSync('frame-gesture', () => {
      if (current.kind === 'draw') {
        drawMove(current, event)
      } else {
        moveMove(current, event)
      }
    })
  }

  function drawMove(draw: DrawSession, event: PointerEvent): void {
    const { ctx } = draw
    const raw = {
      x: clamp((event.clientX - ctx.left) / ctx.pxPerMm, 0, ctx.widthMm),
      y: clamp((event.clientY - ctx.top) / ctx.pxPerMm, 0, ctx.heightMm),
    }
    const snap = snapPoint(ctx.index, raw, {
      pxPerMm: ctx.pxPerMm,
      altKey: snapBypassed(event),
    })
    const x = clamp(raw.x + snap.dx, 0, ctx.widthMm)
    const y = clamp(raw.y + snap.dy, 0, ctx.heightMm)
    draw.rect = {
      x: Math.min(x, draw.origin.x),
      y: Math.min(y, draw.origin.y),
      width: Math.abs(x - draw.origin.x),
      height: Math.abs(y - draw.origin.y),
    }
    placeBox(draw.draft, ctx, draw.rect)
    draw.draft.dataset.sizeMm = `${String(round(draw.rect.width))}x${String(round(draw.rect.height))}`
    paintSnapLines(ctx, snap.lines)
  }

  function moveMove(move: MoveSession, event: PointerEvent): void {
    const { ctx } = move
    if (
      !move.started &&
      Math.hypot(event.clientX - move.startX, event.clientY - move.startY) <
        MOVE_SLOP_PX
    ) {
      return
    }
    if (!move.started) {
      move.started = true
      setFrameSource({ spreadId: ctx.spreadId, frameId: move.frameId })
      if (move.locked) {
        setEditorStatus(STATUS_FRAME_LOCKED)
      }
    }
    if (move.locked) {
      return
    }
    const { width, height } = move.rect0
    const moved = {
      x: clamp(
        move.rect0.x + (event.clientX - move.startX) / ctx.pxPerMm,
        0,
        Math.max(ctx.widthMm - width, 0),
      ),
      y: clamp(
        move.rect0.y + (event.clientY - move.startY) / ctx.pxPerMm,
        0,
        Math.max(ctx.heightMm - height, 0),
      ),
      width,
      height,
    }
    const snap = snapRect(ctx.index, moved, {
      pxPerMm: ctx.pxPerMm,
      altKey: snapBypassed(event),
      grid: gridSnapActive(event),
    })
    move.rect = { ...moved, x: moved.x + snap.dx, y: moved.y + snap.dy }
    move.button.style.left = pct(move.rect.x, ctx.widthMm)
    move.button.style.top = pct(move.rect.y, ctx.heightMm)
    paintSnapLines(ctx, snap.lines)
    setSnapHint(snap.hint, ctx.spreadId)
  }

  function onUp(event: PointerEvent): void {
    const current = session
    if (current?.pointerId !== event.pointerId) {
      return
    }
    finish()
    if (current.kind === 'draw') {
      commitDraw(current)
    } else {
      commitMove(current)
    }
  }

  function commitDraw(draw: DrawSession): void {
    const rect = draw.rect
    if (
      rect === null ||
      rect.width < MIN_FRAME_EDGE_MM ||
      rect.height < MIN_FRAME_EDGE_MM
    ) {
      return
    }
    const { spreadId, spread } = draw.ctx
    const frameId = nextFrameId(spread)
    dispatchBookOp({
      type: 'addFrame',
      spreadId,
      id: frameId,
      rect: {
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height),
      },
    })
    armSwallow()
    setFrameSource({ spreadId, frameId })
    setEditorTool('select')
  }

  function commitMove(move: MoveSession): void {
    if (!move.started) {
      return
    }
    armSwallow()
    if (move.locked) {
      return
    }
    const { spreadId } = move.ctx
    const rect = {
      x: round(move.rect.x),
      y: round(move.rect.y),
      width: move.rect.width,
      height: move.rect.height,
    }
    move.button.style.left = move.saved.left
    move.button.style.top = move.saved.top
    dispatchBookOp({
      type: 'setFrameRect',
      spreadId,
      frameId: move.frameId,
      rect,
    })
    // The book change deselects an empty frame; a move keeps it selected.
    setFrameSource({ spreadId, frameId: move.frameId })
  }

  function onCancel(): void {
    const current = session
    finish()
    if (current?.kind === 'move' && current.started) {
      current.button.style.left = current.saved.left
      current.button.style.top = current.saved.top
    }
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && session !== null) {
      event.stopPropagation()
      onCancel()
      // The button is still down: its release must not click through and
      // deselect the frame that was just restored.
      window.addEventListener('pointerup', swallowRelease)
    }
  }

  const onClick = (event: MouseEvent): void => {
    if (swallowClick) {
      swallowClick = false
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  // Space-drag is the pasteboard pan; it must never start a frame gesture.
  const onSpace = (event: KeyboardEvent): void => {
    if (isSpacePanCode(event.code)) {
      spaceDown = event.type === 'keydown'
    }
  }
  const clearSpace = (): void => {
    spaceDown = false
  }

  document.addEventListener('pointerdown', onDown, true)
  document.addEventListener('click', onClick, true)
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('keydown', onSpace, true)
  window.addEventListener('keyup', onSpace, true)
  window.addEventListener('blur', clearSpace)
  return () => {
    finish()
    document.removeEventListener('pointerdown', onDown, true)
    document.removeEventListener('click', onClick, true)
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('keydown', onSpace, true)
    window.removeEventListener('keyup', onSpace, true)
    window.removeEventListener('blur', clearSpace)
  }
}
