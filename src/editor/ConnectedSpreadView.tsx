import { memo, useSyncExternalStore } from 'react'
import { SpreadView } from '../render/SpreadView'
import { getSpreadPaintSnapshot, subscribeSpread } from './bookStore'

export const ConnectedSpreadView = memo(function ConnectedSpreadView({
  spreadId,
}: {
  spreadId: string
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
    />
  )
})
