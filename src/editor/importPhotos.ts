import { measureHandlerSync } from '../perf/measureHandler'
import {
  runImportBatch,
  type ImportBatchState,
  type ImportFileError,
} from '../photo/assetPool'
import { partitionImportFiles } from '../photo/pickPhotos'
import type { ExifOrientation } from '../photo/types'
import {
  enqueueGalleryAssets,
  getAssetContentHash,
  mintAssetId,
  setAssetSessionMeta,
  setImportRunning,
} from './bookStore'
import { retainAssetSource } from '../photo/assetSources'
import { setThumbUrl } from './thumbCache'

/** `performance.measure` label for the sync import kickoff (handler p95 gate). */
const IMPORT_PHOTOS_HANDLER_LABEL = 'import-photos'

export type ImportProgress = ImportBatchState

export async function importPhotoFiles(
  files: readonly File[],
  options: {
    onProgress?: (state: ImportProgress) => void
  } = {},
): Promise<{ imported: number; errors: ImportFileError[] }> {
  // Measure only the sync kickoff; heavy partition/enqueue runs on a fresh task.
  return measureHandlerSync(IMPORT_PHOTOS_HANDLER_LABEL, () =>
    Promise.resolve().then(() => importPhotoFilesInner(files, options)),
  )
}

async function importPhotoFilesInner(
  files: readonly File[],
  options: {
    onProgress?: (state: ImportProgress) => void
  },
): Promise<{ imported: number; errors: ImportFileError[] }> {
  const { accepted, rejected } = partitionImportFiles(files)
  const earlyErrors: ImportFileError[] = rejected.map(({ file, reason }) => ({
    name: file.name,
    message: reason,
  }))

  const prepared = accepted.map((file) => {
    const assetId = mintAssetId(file.name)
    retainAssetSource(assetId, file)
    return { assetId, file }
  })

  setImportRunning(true, accepted.length + rejected.length)
  try {
    if (prepared.length > 0) {
      enqueueGalleryAssets(
        prepared.map(({ assetId, file }) => ({
          assetId,
          meta: {
            name: file.name,
            correctedWidth: 1,
            correctedHeight: 1,
            orientation: 1,
            aspect: 1,
          },
        })),
      )
    }

    const report = (state: ImportBatchState): void => {
      options.onProgress?.({
        ...state,
        total: accepted.length + rejected.length,
        completed: state.completed + rejected.length,
        errors: [...earlyErrors, ...state.errors],
      })
    }

    if (prepared.length === 0) {
      options.onProgress?.({
        total: rejected.length,
        completed: rejected.length,
        errors: earlyErrors,
        running: false,
      })
      return { imported: 0, errors: earlyErrors }
    }

    const { results, errors } = await runImportBatch(prepared, {
      onProgress: report,
      priority: 'prefetch',
      onResult: (result) => {
        setAssetSessionMeta(result.assetId, {
          name: result.name,
          correctedWidth: result.correctedWidth,
          correctedHeight: result.correctedHeight,
          orientation: result.orientation as ExifOrientation,
          aspect: result.correctedWidth / Math.max(1, result.correctedHeight),
        })
        setThumbUrl(
          result.assetId,
          result.previewBuffer,
          result.previewMimeType,
          getAssetContentHash(result.assetId),
        )
      },
    })

    const allErrors = [...earlyErrors, ...errors]
    return { imported: results.length, errors: allErrors }
  } finally {
    setImportRunning(false)
  }
}
