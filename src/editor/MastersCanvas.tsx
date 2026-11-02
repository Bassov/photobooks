import { useSyncExternalStore } from 'react'
import type { ParentSpread } from '../core'
import { useClientSize, type ClientSize } from './useClientSize'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import {
  getLeftPanelTab,
  getPickedParentId,
  shownParentId,
  subscribeLeftPanelTab,
} from './leftPanelTabStore'
import './CoverCanvas.css'

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
  return parentId === null ? (
    <div className="editor-masters-canvas" data-testid="masters-canvas-empty">
      <div className="editor-masters-empty-title">No masters yet</div>
      <div className="editor-masters-empty-description">
        Masters are page templates shared across spreads.
      </div>
    </div>
  ) : (
    <MasterStage parentId={parentId} />
  )
}

function MasterStage({ parentId }: { parentId: string }) {
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
  const [stage, attach] = useClientSize()
  const pxPerMm =
    stage === null ? 0 : fitParentPxPerMm(stage, { widthMm, heightMm })
  return (
    <div
      ref={attach}
      className="cover-stage"
      data-testid="masters-canvas"
      data-parent-id={parentId}
    >
      {pxPerMm > 0 ? (
        <ConnectedSpreadView spreadId={parentId} pxPerMm={pxPerMm} />
      ) : null}
    </div>
  )
}
