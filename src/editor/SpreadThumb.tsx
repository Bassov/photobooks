import { memo, useSyncExternalStore } from 'react'
import { SpreadView } from '../render/SpreadView'
import { getSpreadPaintSnapshot, subscribeSpread } from './bookStore'
import { fitThumbPx } from './spreadsPanelModel'
import { getThumbUrl, subscribeThumb } from './thumbCache'
import {
  assetIdsOnSpread,
  subscribeAssetIds,
  thumbSnapshotFor,
  thumbUrlFromSnapshot,
  tierDisplayKeyFor,
  tierUrlFromKey,
} from './spreadPreviewKeys'
import { getTierDisplaySnapshot, subscribeTierDisplay } from './tierDisplay'
import {
  getProblemRevisionSnapshot,
  missingAssetChecker,
  subscribeRelink,
} from './relink'

/**
 * Smallest-tier spread preview for the spreads panel. Reads only filmstrip
 * thumbs: it never registers tiers (those are keyed by spread id and belong to
 * the pasteboard's ConnectedSpreadView). Re-renders when this spread's
 * snapshot, its thumbs or the relink revision change.
 */
export const SpreadThumb = memo(function SpreadThumb({
  spreadId,
  boxWidthPx,
  boxHeightPx,
  side = null,
}: {
  spreadId: string
  /** Paper is fitted inside this box at its own aspect (rows differ). */
  boxWidthPx: number
  boxHeightPx: number
  /** Page 1 (`right`) or a single last page (`left`): one half of a spread-wide slot. */
  side?: 'left' | 'right' | null
}) {
  const snapshot = useSyncExternalStore(
    (listener) => subscribeSpread(spreadId, listener),
    () => getSpreadPaintSnapshot(spreadId),
    () => getSpreadPaintSnapshot(spreadId),
  )
  const assetIds =
    snapshot === undefined ? [] : assetIdsOnSpread(snapshot.resolved.items)
  const thumbs = useSyncExternalStore(
    (listener) => subscribeAssetIds(assetIds, subscribeThumb, listener),
    () => thumbSnapshotFor(assetIds, getThumbUrl),
    () => thumbSnapshotFor(assetIds, getThumbUrl),
  )
  // A placed photo can lack a filmstrip thumb while the canvas already shows
  // its tier; fall back to what the canvas displays so the panel never lags.
  const tierDisplayKey = useSyncExternalStore(
    subscribeTierDisplay,
    () => tierDisplayKeyFor(assetIds, getTierDisplaySnapshot().urls),
    () => tierDisplayKeyFor(assetIds, getTierDisplaySnapshot().urls),
  )
  const relinkRevision = useSyncExternalStore(
    subscribeRelink,
    getProblemRevisionSnapshot,
    getProblemRevisionSnapshot,
  )
  if (snapshot === undefined) {
    return null
  }
  const { resolved } = snapshot
  // A single page on its side fits a spread-wide slot and fills one half.
  const slotPages = side === null ? 1 : 2
  const { widthPx: slotWidthPx, heightPx } = fitThumbPx(
    boxWidthPx,
    boxHeightPx,
    (resolved.spreadWidthMm * slotPages) / resolved.spreadHeightMm,
  )
  const widthPx = slotWidthPx / slotPages
  const view = (
    <SpreadView
      thumb
      spreadId={spreadId}
      resolved={resolved}
      pxPerMm={widthPx / resolved.spreadWidthMm}
      isMissingAsset={missingAssetChecker(relinkRevision)}
      previewUrlFor={(assetId) =>
        thumbUrlFromSnapshot(thumbs, assetId) ??
        snapshot.previewUrlFor(assetId) ??
        tierUrlFromKey(tierDisplayKey, assetId)
      }
    />
  )
  if (side === null) {
    return view
  }
  return (
    <div
      className="spread-thumb-slot"
      data-page-side={side}
      style={{
        display: 'flex',
        justifyContent: side === 'right' ? 'flex-end' : 'flex-start',
        width: slotWidthPx,
        height: heightPx,
      }}
    >
      {view}
    </div>
  )
})
