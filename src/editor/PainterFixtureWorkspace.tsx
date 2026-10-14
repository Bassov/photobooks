import { useSyncExternalStore } from 'react'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { getSpreadIdsSnapshot, subscribeBookStore } from './bookStore'

export function PainterFixtureWorkspace() {
  const spreadIds = useSyncExternalStore(
    subscribeBookStore,
    getSpreadIdsSnapshot,
    getSpreadIdsSnapshot,
  )
  return (
    <div
      className="spread-fixture-scroll"
      data-testid="spread-fixture-scroll"
      role="region"
      aria-label="Spreads"
      tabIndex={0}
    >
      {spreadIds.map((spreadId) => (
        <ConnectedSpreadView key={spreadId} spreadId={spreadId} />
      ))}
    </div>
  )
}
