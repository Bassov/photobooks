import { resetAssetSources } from '../../photo/assetSources'
import { detectMissingAssets } from './detect'
import { rescanRelinkFiles, resolvePendingRelink } from './rescan'
import {
  problemAssetIds,
  resetRelinkStore,
  setRelinkDialogOpen,
  setRelinkProgress,
} from './statusStore'

/** E2E / DEV seam. */
export function exposeRelinkTestApi(win: Window): void {
  win.__photobooksRelink = {
    detectMissingAssets,
    rescanRelinkFiles,
    resolvePendingRelink,
    resetRelinkStore,
    setRelinkDialogOpen,
    setRelinkProgress,
    problemAssetIds,
    clearLiveAssetSources: resetAssetSources,
  }
}
