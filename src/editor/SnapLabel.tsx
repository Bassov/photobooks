import { useSyncExternalStore } from 'react'
import { getSnapHint, getSnapHintSpread, subscribeSnapHint } from './snapHint'

/**
 * Quiet field pill with the active snap target; not a toast, never takes
 * pointer events. Shown only on the spread the gesture runs on.
 */
export function SnapLabel({ spreadId }: { spreadId?: string }) {
  const hint = useSyncExternalStore(subscribeSnapHint, getSnapHint, getSnapHint)
  const hintSpread = useSyncExternalStore(
    subscribeSnapHint,
    getSnapHintSpread,
    getSnapHintSpread,
  )
  if (hint === null || (hintSpread !== undefined && hintSpread !== spreadId)) {
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
