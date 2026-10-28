import { useSyncExternalStore } from 'react'
import { getSnapHint, subscribeSnapHint } from './snapHint'

/** Quiet field pill with the active snap target; not a toast, never takes pointer events. */
export function SnapLabel() {
  const hint = useSyncExternalStore(subscribeSnapHint, getSnapHint, getSnapHint)
  if (hint === null) {
    return null
  }
  return (
    <span
      className="snap-label"
      data-testid="snap-label"
      role="status"
      style={{ pointerEvents: 'none' }}
    >
      {hint}
    </span>
  )
}
