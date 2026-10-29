import { memo, useSyncExternalStore } from 'react'
import { SpreadView } from '../render/SpreadView'
import { getSpreadPaintSnapshot, subscribeSpread } from './bookStore'
import { getThumbUrl, subscribeThumb } from './thumbCache'
import {
  assetIdsOnSpread,
  subscribeAssetIds,
  thumbSnapshotFor,
  thumbUrlFromSnapshot,
} from './spreadPreviewKeys'
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
  widthPx,
}: {
  spreadId: string
  widthPx: number
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
  const relinkRevision = useSyncExternalStore(
    subscribeRelink,
    getProblemRevisionSnapshot,
    getProblemRevisionSnapshot,
  )
  if (snapshot === undefined) {
    return null
  }
  return (
    <SpreadView
      thumb
      spreadId={spreadId}
      resolved={snapshot.resolved}
      pxPerMm={widthPx / snapshot.resolved.spreadWidthMm}
      isMissingAsset={missingAssetChecker(relinkRevision)}
      previewUrlFor={(assetId) =>
        thumbUrlFromSnapshot(thumbs, assetId) ?? snapshot.previewUrlFor(assetId)
      }
    />
  )
})
