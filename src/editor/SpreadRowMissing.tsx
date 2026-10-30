import { useSyncExternalStore } from 'react'
import { Icon } from '../ui/Icon'
import { getSpreadPaintSnapshot, subscribeSpread } from './bookStore'
import { getProblemRevisionSnapshot, subscribeRelink } from './relink'
import { missingAssetChecker } from './relink/hatch'
import { assetIdsOnSpread } from './spreadPreviewKeys'

/** Number of placed photos on the spread whose file is missing (relink problem). */
function missingCount(spreadId: string, revision: string): number {
  const snapshot = getSpreadPaintSnapshot(spreadId)
  if (snapshot === undefined) {
    return 0
  }
  const isMissing = missingAssetChecker(revision)
  return assetIdsOnSpread(snapshot.resolved.items).filter(isMissing).length
}

/** Kit row badge (sandbox `chrome.tsx:316`): warning icon + "missing" at the right of the label. */
export function SpreadRowMissing({ spreadId }: { spreadId: string }) {
  const count = useSyncExternalStore(
    (listener) => {
      const offSpread = subscribeSpread(spreadId, listener)
      const offRelink = subscribeRelink(listener)
      return () => {
        offSpread()
        offRelink()
      }
    },
    () => missingCount(spreadId, getProblemRevisionSnapshot()),
    () => missingCount(spreadId, getProblemRevisionSnapshot()),
  )
  if (count === 0) {
    return null
  }
  return (
    <span
      className="spread-row-missing ml-auto inline-flex items-center gap-0.5 font-medium"
      data-testid="spread-row-missing"
    >
      <Icon name="warning" size={14} />
      missing
    </span>
  )
}
