import { useSyncExternalStore } from 'react'
import { getLeftPanelTab, subscribeLeftPanelTab } from './leftPanelTabStore'

/** Covers the pasteboard (which stays mounted) while Masters mode is on: no book pages there. */
export function MastersCanvasStub() {
  const tab = useSyncExternalStore(
    subscribeLeftPanelTab,
    getLeftPanelTab,
    getLeftPanelTab,
  )
  return tab === 'masters' ? (
    <div className="editor-masters-canvas" data-testid="masters-canvas-stub">
      <div className="editor-masters-empty-title">No masters yet</div>
      <div className="editor-masters-empty-description">
        Masters are page templates shared across spreads.
      </div>
    </div>
  ) : null
}
