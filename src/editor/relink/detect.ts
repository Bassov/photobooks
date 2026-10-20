import { getAssetSource } from '../../photo/assetSources'
import { getBookStoreSnapshot } from '../bookStore'
import {
  replaceRelinkStatuses,
  setRelinkDialogOpen,
  type RelinkStatus,
} from './statusStore'

/**
 * Mark gallery assets that have durable identity but no live session File as
 * `missing`. Clears prior statuses first. Opens the dialog when any problem
 * remains (unless `openDialog` is false).
 */
export function detectMissingAssets(options?: { openDialog?: boolean }): {
  missing: number
} {
  const openDialog = options?.openDialog !== false
  const store = getBookStoreSnapshot()
  // Mid-import gallery/hash updates race AssetSource registration; do not
  // wipe statuses or paint false hatches until import settles.
  if (store.importRunning) {
    return { missing: 0 }
  }
  const book = store.book
  const next = new Map<string, RelinkStatus>()

  for (const assetId of book.gallery) {
    const asset = book.assets[assetId]
    if (asset === undefined) {
      continue
    }
    const hasIdentity =
      asset.contentHash !== undefined ||
      asset.relativePath !== undefined ||
      asset.sourceRootId !== undefined
    if (!hasIdentity) {
      continue
    }
    if (getAssetSource(assetId) !== undefined) {
      continue
    }
    next.set(assetId, 'missing')
  }

  replaceRelinkStatuses(next)
  const missing = next.size
  if (openDialog && missing > 0) {
    setRelinkDialogOpen(true)
  }
  return { missing }
}
