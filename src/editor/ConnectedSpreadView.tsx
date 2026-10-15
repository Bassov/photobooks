import { memo, useSyncExternalStore } from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { SpreadView } from '../render/SpreadView'
import { getSpreadPaintSnapshot, subscribeSpread } from './bookStore'

export const ConnectedSpreadView = memo(function ConnectedSpreadView({
  spreadId,
  pxPerMm = SPREAD_PX_PER_MM,
}: {
  spreadId: string
  pxPerMm?: number
}) {
  const snapshot = useSyncExternalStore(
    (listener) => subscribeSpread(spreadId, listener),
    () => getSpreadPaintSnapshot(spreadId),
    () => getSpreadPaintSnapshot(spreadId),
  )
  if (snapshot === undefined) {
    return null
  }
  return (
    <SpreadView
      spreadId={spreadId}
      resolved={snapshot.resolved}
      previewUrlFor={snapshot.previewUrlFor}
      pxPerMm={pxPerMm}
    />
  )
})
