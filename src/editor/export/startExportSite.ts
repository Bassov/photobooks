import { getDerivative, requestDerivatives } from '../../derivatives/pool'
import { getAssetSource } from '../../photo/assetSources'
import { createSiteExportWorker } from '../../site/export/createSiteExportWorker'
import type { SiteExportMessage } from '../../site/export/site-export.worker'
import { getRegisteredAssetSource } from '../assetSourceRegistry'
import { getBookStoreSnapshot } from '../bookStore'
import { getOpenLibrary } from '../projectSession'
import { requestFolderWrite } from './exportSiteFolder'
import { runExportSite, type SiteDerivativeDeps } from './exportSiteRun'
import { exportSiteStore } from './exportSiteStore'
import { loadSiteViewerBundle } from './siteViewerBundle'

/** Session file, else the registered photo folder; any book's asset record. */
const readSource: SiteDerivativeDeps['readSource'] = async (assetId, asset) => {
  const retained = getAssetSource(assetId)
  if (retained !== undefined) {
    return retained
  }
  const { sourceRootId, relativePath } = asset
  if (sourceRootId !== undefined && relativePath !== undefined) {
    const resolved = await getRegisteredAssetSource(sourceRootId)?.resolveFile(
      sourceRootId,
      relativePath,
    )
    if (resolved?.ok === true) {
      return resolved.value
    }
  }
  throw new Error('Photo source unavailable')
}

function runInWorker(
  request: Parameters<Parameters<typeof runExportSite>[0]['runWorker']>[0],
  transfer: Transferable[],
  onMessage: (message: SiteExportMessage) => void,
): void {
  const worker = createSiteExportWorker()
  worker.onmessage = (event: MessageEvent<SiteExportMessage>) => {
    onMessage(event.data)
    if (!('phase' in event.data)) {
      worker.terminate()
    }
  }
  worker.onerror = () => {
    onMessage({ failed: { code: 'unknown' } })
    worker.terminate()
  }
  worker.postMessage(request, transfer)
}

/** Export the open book (and the other published ones) into `folder/dist/`. Call from the Export click. */
export function startExportSite(folder: FileSystemDirectoryHandle): void {
  void runExportSite({
    book: getBookStoreSnapshot().book,
    storage: getOpenLibrary()?.storage ?? null,
    folder,
    now: () => Date.now(),
    requestWrite: requestFolderWrite,
    derivatives: {
      request: requestDerivatives,
      get: getDerivative,
      readSource,
    },
    loadViewer: () =>
      loadSiteViewerBundle((url) => fetch(url), import.meta.env.BASE_URL),
    runWorker: runInWorker,
    dispatch: exportSiteStore.dispatch,
  })
}
