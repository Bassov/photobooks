import {
  MIN_FRAME_EDGE_MM,
  editableSpread,
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
import { getFrameSelection, setFrameSource } from './frameSelection'
import { buildGridAnchors } from './gridSnap'
import { getGridVisible, getSnapOn } from './gridView'
import { clearLiveGeometry, publishLiveGeometry } from './liveGeometry'
import {
  cancelMarquee,
  clearMarquee,
  commitMarquee,
  marqueeSession,
  paintMarquee,
  type MarqueeSession,
} from './marquee'
import { setSnapHint } from './snapHint'
import { isTypingTarget } from './isTypingTarget'
import {
  buildSnapIndex,
  paintedBox,
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

interface GroupMember {
  button: HTMLElement
  /** Inline transform before the gesture (a rotation, or ''). */
  saved: string
}

interface GroupSession {
  kind: 'group'
  pointerId: number
  ctx: SpreadContext
  startX: number
  startY: number
  started: boolean
  /** Unlocked selected frames: the ones that move. */
  frameIds: string[]
  members: GroupMember[]
  /**
   * Union of the moving frames' rects and of their painted boxes (rotated
   * corners included); null when every selected frame is locked.
   */
  moving: { union: RectMm; painted: RectMm } | null
  /** Painted boxes of the locked selected frames. */
  staying: RectMm[]
  box: HTMLElement | null
  savedBox: string
  /** Layout px per mm: the frames' own box, before the camera scale. */
  layoutPxPerMm: number
  dx: number
  dy: number
}

type Session = DrawSession | MoveSession | GroupSession | MarqueeSession

export function round(mm: number): number {
  return Math.round(mm * 10) / 10
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi)
}

function unionOf(first: RectMm, others: readonly RectMm[]): RectMm {
  const rects = [first, ...others]
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Keep the span [start, start + size] inside [0, total]; one already outside may stay put. */
function clampDelta(
  delta: number,
  start: number,
  size: number,
  total: number,
): number {
  return clamp(delta, Math.min(-start, 0), Math.max(total - start - size, 0))
}

/**
 * A body press on a frame of a 2+ selection on its spread starts a group
 * move (filled or empty: the photo drag is off for a set).
 */
function groupSession(
  event: PointerEvent,
  spreadEl: HTMLElement,
  frameEl: HTMLElement,
): GroupSession | null {
  const selection = getFrameSelection()
  if (
    selection === null ||
    selection.frameIds.length < 2 ||
    selection.spreadId !== spreadEl.getAttribute('data-spread-id') ||
    !selection.frameIds.includes(frameEl.getAttribute('data-frame-id') ?? '')
  ) {
    return null
  }
  const found = editableSpread(getBookStoreSnapshot().book, selection.spreadId)
  const picked = (found?.spread.frames ?? []).filter((frame) =>
    selection.frameIds.includes(frame.id),
  )
  const moving = picked.filter((frame) => frame.locked !== true)
  // Only the frames that move leave the snap anchors; a locked one stays a target.
  const ctx = spreadContext(
    spreadEl,
    moving.map((frame) => frame.id),
  )
  if (ctx === null) {
    return null
  }
  const [first, ...rest] = moving
  const movingIds = new Set<string | undefined>(moving.map((frame) => frame.id))
  const box = spreadEl.querySelector<HTMLElement>('.spread-group-box')
  const layoutWidth = spreadEl.offsetWidth
  return {
    kind: 'group',
    pointerId: event.pointerId,
    ctx,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
    frameIds: moving.map((frame) => frame.id),
    members: Array.from(
      spreadEl.querySelectorAll<HTMLElement>('button.spread-frame'),
    )
      .filter((button) => movingIds.has(button.dataset.frameId))
      .map((button) => ({ button, saved: button.style.transform })),
    moving:
      first === undefined
        ? null
        : {
            union: unionOf(
              first.rect,
              rest.map((frame) => frame.rect),
            ),
            painted: unionOf(paintedBox(first), rest.map(paintedBox)),
          },
    staying: picked.filter((frame) => frame.locked === true).map(paintedBox),
    box,
    savedBox: box?.style.cssText ?? '',
    layoutPxPerMm: layoutWidth > 0 ? layoutWidth / ctx.widthMm : ctx.pxPerMm,
    dx: 0,
    dy: 0,
  }
}

/** One translate per moving frame and the group box, in the same frame. */
function paintGroup(group: GroupSession, painted: RectMm): void {
  const scale = group.layoutPxPerMm
  const shift = `translate(${String(group.dx * scale)}px, ${String(group.dy * scale)}px)`
  for (const member of group.members) {
    member.button.style.transform = `${shift} ${member.saved}`
  }
  const union = unionOf(
    { ...painted, x: painted.x + group.dx, y: painted.y + group.dy },
    group.staying,
  )
  if (group.box !== null) {
    group.box.style.left = `${String(union.x * scale)}px`
    group.box.style.top = `${String(union.y * scale)}px`
    group.box.style.width = `${String(union.width * scale)}px`
    group.box.style.height = `${String(union.height * scale)}px`
  }
}

function restoreGroup(group: GroupSession): void {
  for (const member of group.members) {
    member.button.style.transform = member.saved
  }
  if (group.box !== null) {
    group.box.style.cssText = group.savedBox
  }
}

export function spreadContext(
  element: HTMLElement,
  excludeFrameIds: readonly string[],
): SpreadContext | null {
  const spreadId = element.getAttribute('data-spread-id')
  const book = getBookStoreSnapshot().book
  // A parent on the Masters canvas edits like a spread.
  const found = editableSpread(book, spreadId ?? '')
  if (found === undefined) {
    return null
  }
  const { spread, index: spreadIndex } = found
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
        .filter((frame) => !excludeFrameIds.includes(frame.id))
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
 * - Select tool: dragging an empty frame moves it; dragging any frame of a
 *   2+ selection moves its unlocked frames together (one `moveFrames`).
 * - Select tool on bare paper or the pasteboard gray: past the slop, a
 *   marquee selects the target spread's frames it touches (marquee.ts).
 * Draw and move snap to other frames / guides / equal gaps through the anchor index
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
    if (current.kind === 'marquee') {
      clearMarquee(current)
      return
    }
    clearSnapLines(current.ctx)
    setSnapHint(null)
    clearLiveGeometry()
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
    const tool = getEditorTool()
    if (spreadEl === null) {
      // The pasteboard gray: only a Select-tool marquee starts here.
      const marquee = tool === 'select' ? marqueeSession(event) : null
      if (marquee !== null) {
        session = marquee
        listen()
      }
      return
    }
    const frameEl = event.target.closest<HTMLElement>('.spread-frame')
    // A set shows no handles: any press on a member's button is its body.
    const group =
      tool === 'select' && frameEl instanceof HTMLButtonElement
        ? groupSession(event, spreadEl, frameEl)
        : null
    if (
      tool === 'frame' &&
      (frameEl === null || event.target.closest('[data-handle]') !== null)
    ) {
      const ctx = spreadContext(spreadEl, [])
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
    } else if (group !== null) {
      session = group
    } else if (
      tool === 'select' &&
      frameEl instanceof HTMLButtonElement &&
      event.target.closest('[data-handle]') === null &&
      // Only an empty frame moves by its body. A filled frame, selected or
      // not, keeps the photo drag-and-drop (kit #/demo step 17: the swap
      // drag and its hint win over the move).
      frameEl.getAttribute('data-filled') === 'false'
    ) {
      const frameId = frameEl.getAttribute('data-frame-id') ?? ''
      const ctx = spreadContext(spreadEl, [frameId])
      const frame = ctx?.spread.frames.find((item) => item.id === frameId)
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
    } else if (tool === 'select' && frameEl === null) {
      const marquee = marqueeSession(event)
      if (marquee === null) {
        return
      }
      session = marquee
    } else {
      return
    }
    listen()
  }

  function listen(): void {
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
      } else if (current.kind === 'group') {
        groupMove(current, event)
      } else if (current.kind === 'marquee') {
        marqueeMove(current, event)
      } else {
        moveMove(current, event)
      }
    })
  }

  function marqueeMove(marquee: MarqueeSession, event: PointerEvent): void {
    if (
      !marquee.started &&
      Math.hypot(
        event.clientX - marquee.startX,
        event.clientY - marquee.startY,
      ) < MOVE_SLOP_PX
    ) {
      return
    }
    marquee.started = true
    paintMarquee(marquee, event.clientX, event.clientY)
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
    publishLiveGeometry({
      spreadId: ctx.spreadId,
      frameId: move.frameId,
      rect: move.rect,
      rotationDeg:
        ctx.spread.frames.find((frame) => frame.id === move.frameId)
          ?.rotationDeg ?? 0,
    })
  }

  function groupMove(group: GroupSession, event: PointerEvent): void {
    const { ctx, moving } = group
    if (
      !group.started &&
      Math.hypot(event.clientX - group.startX, event.clientY - group.startY) <
        MOVE_SLOP_PX
    ) {
      return
    }
    if (!group.started && moving === null) {
      setEditorStatus(STATUS_FRAME_LOCKED)
    }
    group.started = true
    if (moving === null) {
      return
    }
    const { union } = moving
    let rawX = (event.clientX - group.startX) / ctx.pxPerMm
    let rawY = (event.clientY - group.startY) / ctx.pxPerMm
    // Shift locks the dominant axis; snapping must not move the other one.
    const lock = !event.shiftKey
      ? null
      : Math.abs(rawX) >= Math.abs(rawY)
        ? 'y'
        : 'x'
    if (lock === 'y') {
      rawY = 0
    } else if (lock === 'x') {
      rawX = 0
    }
    const moved = {
      ...union,
      x: union.x + clampDelta(rawX, union.x, union.width, ctx.widthMm),
      y: union.y + clampDelta(rawY, union.y, union.height, ctx.heightMm),
    }
    const snap = snapRect(ctx.index, moved, {
      pxPerMm: ctx.pxPerMm,
      altKey: snapBypassed(event),
      grid: gridSnapActive(event),
    })
    const lines = snap.lines.filter((line) => line.axis !== lock)
    group.dx = moved.x + (lock === 'x' ? 0 : snap.dx) - union.x
    group.dy = moved.y + (lock === 'y' ? 0 : snap.dy) - union.y
    paintGroup(group, moving.painted)
    paintSnapLines(ctx, lines)
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
    } else if (current.kind === 'group') {
      commitGroup(current)
    } else if (current.kind === 'marquee') {
      // Below the slop it was the pasteboard click; nothing to add.
      if (current.started) {
        armSwallow()
        commitMarquee(current)
      }
    } else {
      commitMove(current)
    }
  }

  function commitGroup(group: GroupSession): void {
    if (!group.started) {
      return
    }
    armSwallow()
    restoreGroup(group)
    // One step for the set (none when all are locked: no ids, no delta); the
    // selection outlives the book change.
    dispatchBookOp({
      type: 'moveFrames',
      spreadId: group.ctx.spreadId,
      frameIds: group.frameIds,
      dx: round(group.dx),
      dy: round(group.dy),
    })
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
    if (current?.kind === 'group' && current.started) {
      restoreGroup(current)
    }
    if (current?.kind === 'marquee' && current.started) {
      cancelMarquee(current)
    }
  }

  // A group press on a filled frame must never become a native image drag,
  // and a marquee must not drag or text-select what it crosses.
  const onDragStart = (event: Event): void => {
    if (session?.kind === 'group' || session?.kind === 'marquee') {
      event.preventDefault()
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
  document.addEventListener('dragstart', onDragStart, true)
  document.addEventListener('selectstart', onDragStart, true)
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('keydown', onSpace, true)
  window.addEventListener('keyup', onSpace, true)
  window.addEventListener('blur', clearSpace)
  return () => {
    finish()
    document.removeEventListener('pointerdown', onDown, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('dragstart', onDragStart, true)
    document.removeEventListener('selectstart', onDragStart, true)
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('keydown', onSpace, true)
    window.removeEventListener('keyup', onSpace, true)
    window.removeEventListener('blur', clearSpace)
  }
}
