import {
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { editableSpread } from '../core'
import { getBookStoreSnapshot, subscribeSpread } from './bookStore'
import { startGuideDrag } from './guideGesture'
import { getGuidesVisible, subscribeGuidesVisible } from './guidesView'
import type { GuideOrientation } from './guidesMath'
import './Guides.css'

type SpreadGuides = NonNullable<
  ReturnType<typeof getBookStoreSnapshot>['book']['spreads'][number]['guides']
>

const NONE: SpreadGuides = []

/** A spread's guides, or a parent's on the Masters canvas. */
function guidesOf(spreadId: string): SpreadGuides {
  return (
    editableSpread(getBookStoreSnapshot().book, spreadId)?.spread.guides ?? NONE
  )
}

function beginDrag(
  event: ReactPointerEvent<HTMLElement>,
  orientation: GuideOrientation,
  guide: { id: string; offsetMm: number },
): void {
  if (event.button !== 0) return
  const lineEl = event.currentTarget
  const spreadEl = lineEl.closest<HTMLElement>('[data-testid="spread-view"]')
  if (spreadEl === null) return
  event.preventDefault()
  event.stopPropagation()
  // The pasteboard or Masters stage, whichever hosts this spread's rulers.
  const stage = spreadEl.closest('[data-rulers]')
  const ruler = stage?.querySelector<HTMLElement>(
    orientation === 'horizontal'
      ? '[data-testid="ruler-x"]'
      : '[data-testid="ruler-y"]',
  )
  startGuideDrag({
    event: event.nativeEvent,
    spreadEl,
    orientation,
    rulerEl: ruler ?? null,
    existing: { id: guide.id, lineEl, offsetMm: guide.offsetMm },
  })
}

/** Editor-layer guides over one spread; absent from thumbs, Preview and exports. */
export function GuidesOverlay({
  spreadId,
  pxPerMm,
}: {
  spreadId: string
  pxPerMm: number
}) {
  const visible = useSyncExternalStore(
    subscribeGuidesVisible,
    getGuidesVisible,
    getGuidesVisible,
  )
  const readGuides = () => guidesOf(spreadId)
  const guides = useSyncExternalStore(
    (listener) => subscribeSpread(spreadId, listener),
    readGuides,
    readGuides,
  )
  if (!visible) return null
  return (
    <div className="guides-layer" data-testid="guides-layer" aria-hidden="true">
      {guides.map((guide) => {
        const horizontal = guide.orientation === 'horizontal'
        const at = `${String(guide.offsetMm * pxPerMm)}px`
        return (
          <div
            key={guide.id}
            className="guide-line"
            data-testid="guide-line"
            data-orientation={guide.orientation}
            data-guide-id={guide.id}
            data-offset-mm={guide.offsetMm}
            data-locked={guide.locked === true ? 'true' : undefined}
            style={horizontal ? { top: at } : { left: at }}
            onPointerDown={
              guide.locked === true
                ? undefined
                : (event) => {
                    beginDrag(event, guide.orientation, guide)
                  }
            }
          />
        )
      })}
    </div>
  )
}
