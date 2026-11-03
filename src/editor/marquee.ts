import { editableSpread, getSpreadSizeMm } from '../core'
import { getBookStoreSnapshot } from './bookStore'
import {
  getFrameSelection,
  setFrameSelection,
  type FrameSelection,
} from './frameSelection'
import { pasteboardClickSpreadId } from './pasteboardView'
import { buildFrameHitIndex, hitFrames, type FrameHitIndex } from './snapIndex'

const SPREAD_SELECTOR = '[data-testid="spread-view"]'
const PORT_SELECTOR =
  '[data-testid="pasteboard-scroll"], [data-testid="masters-canvas"]'
/** Presses on these own their gesture; a marquee starts only on bare paper or gray. */
const NOT_PAPER =
  'button, a, input, textarea, [role="button"], [data-handle], .guide-line'

interface ClientBox {
  left: number
  top: number
  right: number
  bottom: number
}

export interface MarqueeSession {
  kind: 'marquee'
  pointerId: number
  spreadId: string
  startX: number
  startY: number
  started: boolean
  /** Spread origin (client px) and client px per mm at the press. */
  left: number
  top: number
  pxPerMm: number
  /** The scrollport: the box never paints outside it. */
  clip: ClientBox
  index: FrameHitIndex
  buttons: ReadonlyMap<string, HTMLElement>
  previous: FrameSelection | null
  /** Previous ids that stay selected under the hits (Shift at the press). */
  kept: readonly string[]
  hits: readonly string[]
  marked: Set<string>
  box: HTMLElement | null
}

/** The scrollport's client box, scrollbars excluded. */
function clientBox(port: HTMLElement): ClientBox {
  const rect = port.getBoundingClientRect()
  const left = rect.left + port.clientLeft
  const top = rect.top + port.clientTop
  return {
    left,
    top,
    right: left + port.clientWidth,
    bottom: top + port.clientHeight,
  }
}

/**
 * The spread a Select-tool press targets: the paper under it (not a frame,
 * handle, guide or control), else on the pasteboard gray the spread its
 * click activates (`pasteboardClickSpreadId`); null on a scrollbar.
 */
function marqueeSpread(event: PointerEvent): HTMLElement | null {
  const target = event.target
  if (!(target instanceof Element) || target.closest(NOT_PAPER) !== null) {
    return null
  }
  const paper = target.closest<HTMLElement>(SPREAD_SELECTOR)
  if (paper !== null) {
    return paper
  }
  const port = target.closest<HTMLElement>('[data-testid="pasteboard-scroll"]')
  if (port === null) {
    return null
  }
  const box = clientBox(port)
  if (event.clientX >= box.right || event.clientY >= box.bottom) {
    return null
  }
  const slots = [...port.querySelectorAll('[data-pasteboard-slot]')]
  const id = pasteboardClickSpreadId(target, event.clientY, slots)
  const slot = slots.find((item) => item.getAttribute('data-spread-id') === id)
  return slot?.querySelector<HTMLElement>(SPREAD_SELECTOR) ?? null
}

/** A marquee press (not started until the slop): null when nothing to target. */
export function marqueeSession(event: PointerEvent): MarqueeSession | null {
  const spreadEl = marqueeSpread(event)
  if (spreadEl === null) {
    return null
  }
  const spreadId = spreadEl.getAttribute('data-spread-id') ?? ''
  const book = getBookStoreSnapshot().book
  const found = editableSpread(book, spreadId)
  const rect = spreadEl.getBoundingClientRect()
  if (found === undefined || rect.width <= 0) {
    return null
  }
  const { widthMm } = getSpreadSizeMm(book, found.index)
  const port = spreadEl.closest<HTMLElement>(PORT_SELECTOR)
  const previous = getFrameSelection()
  return {
    kind: 'marquee',
    pointerId: event.pointerId,
    spreadId,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
    left: rect.left,
    top: rect.top,
    pxPerMm: rect.width / widthMm,
    clip:
      port === null
        ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
        : clientBox(port),
    // Own frames only: parent items are not in `spread.frames`.
    index: buildFrameHitIndex(found.spread.frames),
    buttons: new Map(
      Array.from(
        spreadEl.querySelectorAll<HTMLElement>('button.spread-frame'),
        (button) => [button.dataset.frameId ?? '', button],
      ),
    ),
    previous,
    kept:
      event.shiftKey && previous?.spreadId === spreadId
        ? previous.frameIds
        : [],
    hits: [],
    marked: new Set(),
    box: null,
  }
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi)
}

/** Box in screen px and live hit outlines for the pointer at (x, y). */
export function paintMarquee(
  marquee: MarqueeSession,
  clientX: number,
  clientY: number,
): void {
  const { clip } = marquee
  const xs = [marquee.startX, clientX].map((x) =>
    clamp(x, clip.left, clip.right),
  )
  const ys = [marquee.startY, clientY].map((y) =>
    clamp(y, clip.top, clip.bottom),
  )
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const width = Math.max(...xs) - left
  const height = Math.max(...ys) - top
  if (marquee.box === null) {
    marquee.box = document.createElement('div')
    marquee.box.className = 'marquee-box'
    marquee.box.setAttribute('data-testid', 'marquee')
    marquee.box.setAttribute('aria-hidden', 'true')
    document.body.append(marquee.box)
  }
  marquee.box.style.left = `${String(left)}px`
  marquee.box.style.top = `${String(top)}px`
  marquee.box.style.width = `${String(width)}px`
  marquee.box.style.height = `${String(height)}px`
  marquee.hits = hitFrames(marquee.index, {
    x: (left - marquee.left) / marquee.pxPerMm,
    y: (top - marquee.top) / marquee.pxPerMm,
    width: width / marquee.pxPerMm,
    height: height / marquee.pxPerMm,
  })
  markHits(marquee, new Set([...marquee.kept, ...marquee.hits]))
}

/** Outline exactly `live` (attribute diff; no layout reads). */
function markHits(marquee: MarqueeSession, live: ReadonlySet<string>): void {
  for (const id of marquee.marked) {
    if (!live.has(id)) {
      marquee.buttons.get(id)?.removeAttribute('data-marquee-hit')
      marquee.marked.delete(id)
    }
  }
  for (const id of live) {
    if (!marquee.marked.has(id)) {
      marquee.buttons.get(id)?.setAttribute('data-marquee-hit', 'true')
      marquee.marked.add(id)
    }
  }
}

/** Remove the box and the live outlines. */
export function clearMarquee(marquee: MarqueeSession): void {
  markHits(marquee, new Set())
  marquee.box?.remove()
  marquee.box = null
}

/** Release: the hits, unioned with the kept previous set. */
export function commitMarquee(marquee: MarqueeSession): void {
  setFrameSelection({
    spreadId: marquee.spreadId,
    frameIds: [...new Set([...marquee.kept, ...marquee.hits])],
  })
}

/** Esc / pointercancel: the selection before the press. */
export function cancelMarquee(marquee: MarqueeSession): void {
  setFrameSelection(marquee.previous)
}
