import { useSyncExternalStore } from 'react'
import { EndpaperCanvas } from './EndpaperCanvas'
import {
  getSelectedEndpaper,
  subscribeEndpaperSelection,
} from './endpaperSelection'

/** Covers the pasteboard (which stays mounted) while an endpaper is selected. */
export function EndpaperOverlay() {
  const side = useSyncExternalStore(
    subscribeEndpaperSelection,
    getSelectedEndpaper,
    getSelectedEndpaper,
  )
  return side === null ? null : <EndpaperCanvas side={side} />
}
