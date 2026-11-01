import { useSyncExternalStore } from 'react'
import { CoverCanvas } from './CoverCanvas'
import { isCoverSelected, subscribeCoverSelection } from './coverSelection'

/** Covers the pasteboard (which stays mounted) while the cover is selected. */
export function CoverOverlay() {
  const selected = useSyncExternalStore(
    subscribeCoverSelection,
    isCoverSelected,
    isCoverSelected,
  )
  return selected ? <CoverCanvas tierSlot="cover:canvas" /> : null
}
