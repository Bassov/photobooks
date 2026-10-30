import { useState, useSyncExternalStore } from 'react'
import { SpreadPager } from '../render/SpreadPager'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { getSpreadIdsSnapshot, subscribeBookStore } from './bookStore'
import { getActiveSpreadId } from './photoRootSession'
import { selectedSpreadId } from './spreadsPanelModel'

/** Fullscreen reader: the editor's SpreadView, one spread at a time. */
export function PresentationMode({ onExit }: { onExit: () => void }) {
  const spreadIds = useSyncExternalStore(
    subscribeBookStore,
    getSpreadIdsSnapshot,
    getSpreadIdsSnapshot,
  )
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      spreadIds.indexOf(selectedSpreadId(getActiveSpreadId(), spreadIds) ?? ''),
    ),
  )
  return (
    <SpreadPager
      count={spreadIds.length}
      index={Math.min(index, Math.max(0, spreadIds.length - 1))}
      onIndexChange={setIndex}
      onExit={onExit}
      renderSpread={(i) => {
        const id = spreadIds[i]
        return id === undefined ? null : (
          <ConnectedSpreadView spreadId={id} lowDpiBadge={false} />
        )
      }}
    />
  )
}
