import { useSyncExternalStore } from 'react'
import { getSpreadEmptyFrameCount, subscribeSpread } from './bookStore'

/** Kit row caption (sandbox `chrome.tsx:315`): "N empty" at the right of the label. */
export function SpreadRowEmpty({ spreadId }: { spreadId: string }) {
  const count = useSyncExternalStore(
    (listener) => subscribeSpread(spreadId, listener),
    () => getSpreadEmptyFrameCount(spreadId),
    () => getSpreadEmptyFrameCount(spreadId),
  )
  if (count === 0) {
    return null
  }
  return (
    <span className="spread-row-empty ml-auto" data-testid="spread-row-empty">
      {count} empty
    </span>
  )
}
