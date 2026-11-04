import { useSyncExternalStore, type PointerEvent } from 'react'
import type { ParentSpread } from '../core'
import { setFrameSource } from './frameSelection'
import { Rulers } from './Rulers'
import { getRulersVisible, subscribeRulersVisible } from './rulersView'
import { useClientSize, type ClientSize } from './useClientSize'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import {
  getLeftPanelTab,
  getPickedParentId,
  shownParentId,
  subscribeLeftPanelTab,
} from './leftPanelTabStore'
import '../render/CoverView.css'

/** Kit viewport.tsx:110-121 band: 56 px top, 48 px bottom, 40 px sides (`.cover-stage`). */
const STAGE_PAD_X_PX = 80
const STAGE_PAD_Y_PX = 104

function readParents(): ParentSpread[] | undefined {
  return getBookStoreSnapshot().book.parents
}

function readTrimWidth(): number {
  return getBookStoreSnapshot().book.settings.trim.widthMm
}

function readTrimHeight(): number {
  return getBookStoreSnapshot().book.settings.trim.heightMm
}

/** Scale that fits a two-page spread in the stage's content box (≤ 0 when it has none). */
function fitParentPxPerMm(
  stage: ClientSize,
  trim: { widthMm: number; heightMm: number },
): number {
  return Math.min(
    (stage.width - STAGE_PAD_X_PX) / (2 * trim.widthMm),
    (stage.height - STAGE_PAD_Y_PX) / trim.heightMm,
  )
}

/**
 * Masters mode canvas over the pasteboard (which stays mounted): the shown
 * parent as an editable spread, or the empty note while the book has none.
 */
export function MastersCanvas() {
  const tab = useSyncExternalStore(
    subscribeLeftPanelTab,
    getLeftPanelTab,
    getLeftPanelTab,
  )
  const picked = useSyncExternalStore(
    subscribeLeftPanelTab,
    getPickedParentId,
    getPickedParentId,
  )
  const parents = useSyncExternalStore(
    subscribeBookStore,
    readParents,
    readParents,
  )
  if (tab !== 'masters') {
    return null
  }
  const parentId = shownParentId(parents, picked)
  const name = parents?.find((parent) => parent.id === parentId)?.name ?? ''
  return parentId === null ? (
    <div className="editor-masters-canvas" data-testid="masters-canvas-empty">
      <div className="editor-masters-empty-title">No masters yet</div>
      <div className="editor-masters-empty-description">
        Masters are page templates shared across spreads.
      </div>
    </div>
  ) : (
    <MasterStage parentId={parentId} name={name} />
  )
}

/** A primary press on the stage outside a frame (or other control) drops the frame selection. */
function onStagePointerDown(event: PointerEvent<HTMLDivElement>): void {
  if (
    event.button === 0 &&
    event.target instanceof Element &&
    event.target.closest('button, a, input, textarea, [role="button"]') === null
  ) {
    setFrameSource(null)
  }
}

function MasterStage({ parentId, name }: { parentId: string; name: string }) {
  const widthMm = useSyncExternalStore(
    subscribeBookStore,
    readTrimWidth,
    readTrimWidth,
  )
  const heightMm = useSyncExternalStore(
    subscribeBookStore,
    readTrimHeight,
    readTrimHeight,
  )
  const rulersOn = useSyncExternalStore(
    subscribeRulersVisible,
    getRulersVisible,
    getRulersVisible,
  )
  // The fit reads the area's size; the rulers read the area as their scroll area.
  const [area, attachArea, areaRef] = useClientSize()
  const pxPerMm =
    area === null ? 0 : fitParentPxPerMm(area, { widthMm, heightMm })
  return (
    <div
      className="cover-stage"
      data-testid="masters-canvas"
      data-parent-id={parentId}
      data-rulers={rulersOn ? 'true' : 'false'}
      onPointerDown={onStagePointerDown}
    >
      {/* Kit `r = RULER`: with rulers on, the spread fits inside the strips. */}
      <div ref={attachArea} className="masters-area">
        {pxPerMm > 0 ? (
          <div className="masters-spread">
            <ConnectedSpreadView
              spreadId={parentId}
              pxPerMm={pxPerMm}
              gridVariant="master"
            />
            {/* Kit viewport master label: under the spread, screen px (M37 rule). */}
            <span className="masters-caption" data-testid="master-label">
              {name}
            </span>
          </div>
        ) : null}
      </div>
      {rulersOn ? (
        <Rulers scrollRef={areaRef} pageMm={widthMm} pxPerMm={pxPerMm} />
      ) : null}
    </div>
  )
}
