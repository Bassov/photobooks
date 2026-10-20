import { resetAssetSources } from '../../photo/assetSources'
import { detectMissingAssets } from './detect'
import { rescanRelinkFiles, resolvePendingRelink } from './rescan'
import {
  problemAssetIds,
  replaceRelinkStatuses,
  resetRelinkStore,
  setRelinkDialogOpen,
  setRelinkProgress,
  type RelinkStatus,
} from './statusStore'

/** Normalize Map or entry iterables for the e2e replace seam. */
export function replaceRelinkStatusesFrom(
  next: ReadonlyMap<string, RelinkStatus> | Iterable<[string, RelinkStatus]>,
): void {
  replaceRelinkStatuses(new Map(next))
}

/** E2E / DEV seam. */
export function exposeRelinkTestApi(win: Window): void {
  win.__photobooksRelink = {
    detectMissingAssets,
    rescanRelinkFiles,
    resolvePendingRelink,
    resetRelinkStore,
    setRelinkDialogOpen,
    setRelinkProgress,
    replaceRelinkStatuses: replaceRelinkStatusesFrom,
    problemAssetIds,
    clearLiveAssetSources: resetAssetSources,
  }
}
