import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  PANEL_MAX,
  PANEL_MIN,
  dragPanelWidth,
  keyPanelWidth,
  type PanelSide,
} from './panelSize'
import { ensurePanelStyles } from './panelStyles'

ensurePanelStyles()

export interface PanelSplitterProps {
  side: PanelSide
  width: number
  onResize: (width: number) => void
  /** Called once when a drag or key press ends with a new width (persist here). */
  onCommit?: (width: number) => void
  onCollapse?: () => void
}

/** Vertical separator on a panel's inner edge: pointer drag + arrow keys + Enter to collapse. */
export function PanelSplitter({
  side,
  width,
  onResize,
  onCommit,
  onCollapse,
}: PanelSplitterProps) {
  const drag = useRef<{ x: number; w: number; last: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, w: width, last: width }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    d.last = dragPanelWidth(side, d.w, e.clientX - d.x)
    onResize(d.last)
  }
  const end = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (d) onCommit?.(d.last)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && onCollapse) {
      e.preventDefault()
      onCollapse()
      return
    }
    const next = keyPanelWidth(side, width, e.key, e.shiftKey)
    if (next === null) return
    e.preventDefault()
    onResize(next)
    onCommit?.(next)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} panel`}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={width}
      tabIndex={0}
      className="pb-splitter"
      data-dragging={dragging ? 'true' : undefined}
      data-testid={`resize-${side}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
    />
  )
}
