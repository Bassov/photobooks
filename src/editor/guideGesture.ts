import { flushSync } from 'react-dom'
import {
  editableSpread,
  getSinglePageSide,
  getSpreadSizeMm,
  type BookOp,
  type Spread,
} from '../core'
import { dispatchBookOp, getBookStoreSnapshot } from './bookStore'
import {
  guideStatus,
  setEditorStatus,
  type GuideStatusPage,
} from './editorStatus'
import { setGuidesVisible } from './guidesView'
import {
  guideDropOutcome,
  guideOffsetMm,
  type GuideOrientation,
} from './guidesMath'

export interface GuideDragStart {
  event: PointerEvent
  spreadEl: HTMLElement
  orientation: GuideOrientation
  /** The ruler this guide belongs to (top for horizontal, left for vertical); dropping back on it removes. */
  rulerEl: HTMLElement | null
  /** Dragging a placed guide: its line element and committed offset. */
  existing?: { id: string; lineEl: HTMLElement; offsetMm: number }
}

/** The ruler `spreadEl`'s guides of `orientation` belong to (top / left), if shown. */
export function guideRuler(
  spreadEl: HTMLElement,
  orientation: GuideOrientation,
): HTMLElement | null {
  // The pasteboard or Masters stage, whichever hosts this spread's rulers.
  const stage = spreadEl.closest('[data-rulers]')
  return (
    stage?.querySelector<HTMLElement>(
      orientation === 'horizontal'
        ? '[data-testid="ruler-x"]'
        : '[data-testid="ruler-y"]',
    ) ?? null
  )
}

/**
 * Removing a placed guide: an own guide goes; a parent guide's copy hides
 * the parent guide on the spread (Designer PO5).
 */
function removeOp(spread: Spread, guideId: string): BookOp {
  const copy = spread.parentOverrides?.guides?.find((g) => g.id === guideId)
  return copy === undefined
    ? { type: 'removeGuide', spreadId: spread.id, guideId }
    : {
        type: 'hideParentItem',
        spreadId: spread.id,
        parentItemId: copy.overridesId,
      }
}

function overRuler(
  rulerEl: HTMLElement | null,
  orientation: GuideOrientation,
  event: PointerEvent,
): boolean {
  if (rulerEl === null) return false
  const box = rulerEl.getBoundingClientRect()
  return orientation === 'horizontal'
    ? event.clientY <= box.bottom
    : event.clientX <= box.right
}

function newLine(
  spreadEl: HTMLElement,
  orientation: GuideOrientation,
): HTMLElement {
  const line = document.createElement('div')
  line.className = 'guide-line'
  line.dataset.orientation = orientation
  line.dataset.testid = 'guide-line-new'
  // Beside the paper, which clips its content (ConnectedSpreadView stage).
  ;(spreadEl.closest('.spread-stage') ?? spreadEl).append(line)
  return line
}

/**
 * Guide drag: the line moves with a `transform` once per animation frame and
 * the document changes once, on release, and the status names the placed
 * position (kit). Dropping on the ruler or off the spread removes a placed
 * guide and abandons a new one.
 */
export function startGuideDrag(start: GuideDragStart): void {
  const { spreadEl, orientation, rulerEl, existing } = start
  const spreadId = spreadEl.dataset.spreadId ?? ''
  const book = getBookStoreSnapshot().book
  // A parent on the Masters canvas resolves too (sized as two pages).
  const target = editableSpread(book, spreadId)
  const box = spreadEl.getBoundingClientRect()
  if (target === undefined || box.width <= 0) return
  const size = getSpreadSizeMm(book, target.index)
  const horizontal = orientation === 'horizontal'
  const extentMm = horizontal ? size.heightMm : size.widthMm
  const pxPerMm = box.width / size.widthMm
  const layoutPerMm = spreadEl.offsetWidth / size.widthMm
  const originPx = horizontal ? box.top : box.left
  const baseMm = existing?.offsetMm ?? 0
  const page: GuideStatusPage =
    size.pageCount === 2
      ? { pages: 2, pageWidthMm: book.settings.trim.widthMm }
      : {
          pages: 1,
          side: getSinglePageSide(target.index, book.spreads.length),
        }

  setGuidesVisible(true)
  const line = existing?.lineEl ?? newLine(spreadEl, orientation)
  const tag = document.createElement('span')
  tag.className = 'guide-line-tag'
  line.append(tag)
  line.dataset.dragging = 'true'

  let latest = start.event
  let raf = 0
  const offsetOf = (event: PointerEvent): number =>
    guideOffsetMm(horizontal ? event.clientY : event.clientX, originPx, pxPerMm)
  const outcomeOf = (event: PointerEvent) =>
    guideDropOutcome({
      offsetMm: offsetOf(event),
      extentMm,
      overRuler: overRuler(rulerEl, orientation, event),
      existing: existing !== undefined,
    })
  const apply = (): void => {
    raf = 0
    const offsetMm = offsetOf(latest)
    const shift = `${String((offsetMm - baseMm) * layoutPerMm)}px`
    line.style.transform = horizontal
      ? `translateY(${shift})`
      : `translateX(${shift})`
    tag.textContent = `${String(offsetMm)} mm`
    line.dataset.removing = String(outcomeOf(latest) !== 'commit')
  }
  const onMove = (event: PointerEvent): void => {
    latest = event
    if (raf === 0) raf = requestAnimationFrame(apply)
  }
  const onUp = (event: PointerEvent): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    cancelAnimationFrame(raf)
    const outcome = outcomeOf(event)
    const offsetMm = offsetOf(event)
    tag.remove()
    if (existing === undefined) {
      line.remove()
    } else {
      line.style.transform = ''
      delete line.dataset.dragging
      delete line.dataset.removing
    }
    if (outcome === 'cancel') return
    if (existing === undefined) {
      dispatchBookOp({ type: 'addGuide', spreadId, orientation, offsetMm })
    } else {
      dispatchBookOp(
        outcome === 'commit'
          ? { type: 'moveGuide', spreadId, guideId: existing.id, offsetMm }
          : removeOp(target.spread, existing.id),
      )
    }
    if (outcome === 'commit') {
      setEditorStatus(guideStatus(orientation, offsetMm, page))
    }
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  apply()
}

/**
 * Designer PO5: a Ctrl/⌘+Shift press on a parent guide overrides it on the
 * spread, and the press continues as the copy's drag (a locked copy stays).
 * False when nothing was overridden, so the press is not consumed.
 */
export function startParentGuideOverride(
  event: PointerEvent,
  spreadEl: HTMLElement,
  parentGuideId: string,
): boolean {
  const spreadId = spreadEl.dataset.spreadId ?? ''
  // The copy's line must be on the page before the drag takes it.
  flushSync(() => {
    dispatchBookOp({ type: 'overrideParentGuide', spreadId, parentGuideId })
  })
  const copy = getBookStoreSnapshot()
    .book.spreads.find((spread) => spread.id === spreadId)
    ?.parentOverrides?.guides?.find((g) => g.overridesId === parentGuideId)
  if (copy === undefined) return false
  const lineEl = [
    ...(spreadEl
      .closest('.spread-stage')
      ?.querySelectorAll<HTMLElement>('[data-testid="guide-line"]') ?? []),
  ].find((line) => line.dataset.guideId === copy.id)
  if (lineEl !== undefined && copy.locked !== true) {
    startGuideDrag({
      event,
      spreadEl,
      orientation: copy.orientation,
      rulerEl: guideRuler(spreadEl, copy.orientation),
      existing: { id: copy.id, lineEl, offsetMm: copy.offsetMm },
    })
  }
  return true
}
