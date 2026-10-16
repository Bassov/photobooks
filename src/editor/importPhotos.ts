import { createMemoryAssetSource, hashContent } from '../assets'
import { measureHandlerSync } from '../perf/measureHandler'
import {
  runImportBatch,
  type ImportBatchState,
  type ImportFileError,
} from '../photo/assetPool'
import { retainAssetSource } from '../photo/assetSources'
import { partitionImportFiles } from '../photo/pickPhotos'
import type { ExifOrientation } from '../photo/types'
import {
  enqueueGalleryAssets,
  getAssetContentHash,
  mintAssetId,
  patchAssetRecord,
  setAssetSessionMeta,
  setImportRunning,
} from './bookStore'
import { trackHashJob } from './pendingHashes'
import { isLibraryBacked, registerAssetSource } from './projectSession'
import { putCachedThumbForHash, setThumbUrl } from './thumbCache'
import { putCachedTierForHash } from '../photo/tierCache'

/** `performance.measure` label for the sync import kickoff (handler p95 gate). */
const IMPORT_PHOTOS_HANDLER_LABEL = 'import-photos'

export type ImportProgress = ImportBatchState

export interface ImportPhotoOptions {
  onProgress?: (state: ImportProgress) => void
  /** When set, overrides `isLibraryBacked()` for identity registration. */
  libraryBacked?: boolean
  sourceRootId?: string
}

export async function importPhotoFiles(
  files: readonly File[],
  options: ImportPhotoOptions = {},
): Promise<{ imported: number; errors: ImportFileError[] }> {
  // Measure only the sync kickoff; heavy partition/enqueue runs on a fresh task.
  return measureHandlerSync(IMPORT_PHOTOS_HANDLER_LABEL, () =>
    Promise.resolve().then(() => importPhotoFilesInner(files, options)),
  )
}

function relativePathFor(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string })
    .webkitRelativePath
  if (typeof relative === 'string' && relative.length > 0) {
    return relative
  }
  return file.name
}

async function importPhotoFilesInner(
  files: readonly File[],
  options: ImportPhotoOptions,
): Promise<{ imported: number; errors: ImportFileError[] }> {
  const { accepted, rejected } = partitionImportFiles(files)
  const earlyErrors: ImportFileError[] = rejected.map(({ file, reason }) => ({
    name: file.name,
    message: reason,
  }))

  const libraryBacked = options.libraryBacked ?? isLibraryBacked()
  const sourceRootId =
    options.sourceRootId ??
    (libraryBacked ? `root-${crypto.randomUUID()}` : undefined)
  const memorySource = libraryBacked ? createMemoryAssetSource() : null
  if (libraryBacked && sourceRootId && memorySource) {
    registerAssetSource(sourceRootId, memorySource)
  }

  const prepared = accepted.map((file) => {
    const assetId = mintAssetId(file.name)
    retainAssetSource(assetId, file)
    return { assetId, file, relativePath: relativePathFor(file) }
  })

  setImportRunning(true, accepted.length + rejected.length)
  try {
    if (prepared.length > 0) {
      const identityEntries = libraryBacked
        ? await Promise.all(
            prepared.map(async (entry) => {
              if (memorySource && sourceRootId) {
                const bytes = await entry.file.arrayBuffer()
                memorySource.seedFile(
                  sourceRootId,
                  entry.relativePath,
                  bytes,
                  entry.file.lastModified,
                )
                if (typeof Worker !== 'undefined') {
                  void trackHashJob(
                    hashContent(bytes.slice(0)).then(async (contentHash) => {
                      patchAssetRecord(entry.assetId, { contentHash })
                      await Promise.all([
                        putCachedThumbForHash(entry.assetId, contentHash),
                        putCachedTierForHash(entry.assetId, contentHash),
                      ])
                      return contentHash
                    }),
                  ).catch(() => {
                    // Hash is best-effort; identity path/size/mtime still persist.
                  })
                }
              }
              return {
                assetId: entry.assetId,
                meta: {
                  name: entry.file.name,
                  correctedWidth: 1,
                  correctedHeight: 1,
                  orientation: 1 as const,
                  aspect: 1,
                },
                asset: {
                  sourceRootId,
                  relativePath: entry.relativePath,
                  byteSize: entry.file.size,
                  mtimeMs: entry.file.lastModified,
                },
              }
            }),
          )
        : prepared.map(({ assetId, file }) => ({
            assetId,
            meta: {
              name: file.name,
              correctedWidth: 1,
              correctedHeight: 1,
              orientation: 1 as const,
              aspect: 1,
            },
          }))

      enqueueGalleryAssets(identityEntries)
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
