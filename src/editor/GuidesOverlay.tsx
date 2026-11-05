import {
  useCallback,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { editableSpread, viewGuides, type ResolvedGuide } from '../core'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { guideRuler, startGuideDrag } from './guideGesture'
import { getGuidesVisible, subscribeGuidesVisible } from './guidesView'
import type { GuideOrientation } from './guidesMath'
import './Guides.css'

const NONE: readonly ResolvedGuide[] = []

/**
 * A spread's guides with its parent's under them, or a parent's own on the
 * Masters canvas. `viewGuides` caches per spread object, so an edit elsewhere
 * (another master, another spread) returns the same array and skips the render.
 */
function guidesOf(spreadId: string): readonly ResolvedGuide[] {
  const book = getBookStoreSnapshot().book
  const target = editableSpread(book, spreadId)
  return target === undefined
    ? NONE
    : viewGuides(book, target.index, target.spread)
}

function beginDrag(
  event: ReactPointerEvent<HTMLElement>,
  orientation: GuideOrientation,
  guide: { id: string; offsetMm: number },
): void {
  if (event.button !== 0) return
  const lineEl = event.currentTarget
  // The paper is the line's sibling in the spread stage (ConnectedSpreadView).
  const spreadEl =
    lineEl
      .closest('.spread-stage')
      ?.querySelector<HTMLElement>('[data-testid="spread-view"]') ?? null
  if (spreadEl === null) return
  event.preventDefault()
  event.stopPropagation()
  startGuideDrag({
    event: event.nativeEvent,
    spreadEl,
    orientation,
    rulerEl: guideRuler(spreadEl, orientation),
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
  // The book store, not the spread paint: a parent guide edit leaves the
  // spreads using it unpainted, yet their overlays show it.
  const readGuides = useCallback(() => guidesOf(spreadId), [spreadId])
  const guides = useSyncExternalStore(
    subscribeBookStore,
    readGuides,
    readGuides,
  )
  if (!visible) return null
  return (
    <div className="guides-layer" data-testid="guides-layer" aria-hidden="true">
      {guides.map(({ guide, layer }) => {
        const horizontal = guide.orientation === 'horizontal'
        const at = `${String(guide.offsetMm * pxPerMm)}px`
        if (layer === 'parent') {
          // Read-only and pointer-transparent: edited on the Masters canvas;
          // Ctrl/⌘+Shift overrides it here (frameGesture → guideGesture).
          return (
            <div
              key={`parent:${guide.id}`}
              className="guide-line"
              data-testid="guide-line-parent"
              data-layer="parent"
              data-orientation={guide.orientation}
              data-guide-id={guide.id}
              data-offset-mm={guide.offsetMm}
              style={horizontal ? { top: at } : { left: at }}
            />
          )
        }
        // A parent guide's local copy is an own guide on this spread (PO5).
        return (
          <div
            key={guide.id}
            className="guide-line"
            data-testid="guide-line"
            data-layer={layer}
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
