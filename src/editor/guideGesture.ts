import { getSpreadSizeMm } from '../core'
import { dispatchBookOp, getBookStoreSnapshot } from './bookStore'
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
  spreadEl.append(line)
  return line
}

/**
 * Guide drag: the line moves with a `transform` once per animation frame and
 * the document changes once, on release. Dropping on the ruler or off the
 * spread removes a placed guide and abandons a new one.
 */
export function startGuideDrag(start: GuideDragStart): void {
  const { spreadEl, orientation, rulerEl, existing } = start
  const spreadId = spreadEl.dataset.spreadId ?? ''
  const book = getBookStoreSnapshot().book
  const index = book.spreads.findIndex((spread) => spread.id === spreadId)
  const box = spreadEl.getBoundingClientRect()
  if (index < 0 || box.width <= 0) return
  const size = getSpreadSizeMm(book, index)
  const horizontal = orientation === 'horizontal'
  const extentMm = horizontal ? size.heightMm : size.widthMm
  const pxPerMm = box.width / size.widthMm
  const layoutPerMm = spreadEl.offsetWidth / size.widthMm
  const originPx = horizontal ? box.top : box.left
  const baseMm = existing?.offsetMm ?? 0

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
          : { type: 'removeGuide', spreadId, guideId: existing.id },
      )
    }
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  apply()
}
