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
  getBookStoreSnapshot,
  mintAssetId,
  setAssetSessionMeta,
  setImportRunning,
} from './bookStore'
import {
  buildReuseIndex,
  IMPORT_BODY_READ_CAP,
  mapWithConcurrency,
  relativePathFor,
  reuseIdentityKey,
} from './importBodyReads'
import { isLibraryBacked } from './projectSession'
import { memorySourceForRoot, seedAndHashEntry } from './seedLibraryImport'
import { setThumbUrl } from './thumbCache'

export {
  buildReuseIndex,
  findReusableAssetId,
  IMPORT_BODY_READ_CAP,
} from './importBodyReads'

/** `performance.measure` label for the sync import kickoff (handler p95 gate). */
const IMPORT_PHOTOS_HANDLER_LABEL = 'import-photos'

export type ImportProgress = ImportBatchState

export interface ImportPhotoOptions {
  onProgress?: (state: ImportProgress) => void
  /** When set, overrides `isLibraryBacked()` for identity registration. */
  libraryBacked?: boolean
  sourceRootId?: string
}

interface PreparedEntry {
  assetId: string
  file: File
  relativePath: string
  reused: boolean
}

export async function importPhotoFiles(
  files: readonly File[],
  options: ImportPhotoOptions = {},
): Promise<{ imported: number; errors: ImportFileError[] }> {
  return measureHandlerSync(IMPORT_PHOTOS_HANDLER_LABEL, () =>
    Promise.resolve().then(() => importPhotoFilesInner(files, options)),
  )
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
  const batchRootId =
    options.sourceRootId ??
    (libraryBacked ? `root-${crypto.randomUUID()}` : undefined)

  const book = getBookStoreSnapshot().book
  const reuseIndex = libraryBacked
    ? buildReuseIndex(book.gallery, book.assets)
    : null

  const prepared: PreparedEntry[] = accepted.map((file) => {
    const relativePath = relativePathFor(file)
    const existingId = reuseIndex?.get(
      reuseIdentityKey(relativePath, file.size, file.lastModified),
    )
    const assetId = existingId ?? mintAssetId(file.name)
    retainAssetSource(assetId, file)
    return {
      assetId,
      file,
      relativePath,
      reused: existingId !== undefined,
    }
  })

  setImportRunning(true, accepted.length + rejected.length)
  try {
    if (prepared.length > 0) {
      const identityEntries = libraryBacked
        ? prepared
            .filter((entry) => !entry.reused)
            .map((entry) => ({
              assetId: entry.assetId,
              meta: {
                name: entry.file.name,
                correctedWidth: 1,
                correctedHeight: 1,
                orientation: 1 as const,
                aspect: 1,
              },
              asset: {
                sourceRootId:
                  getBookStoreSnapshot().book.assets[entry.assetId]
                    ?.sourceRootId ?? batchRootId,
                relativePath: entry.relativePath,
                byteSize: entry.file.size,
                mtimeMs: entry.file.lastModified,
              },
            }))
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

      if (identityEntries.length > 0) {
        enqueueGalleryAssets(identityEntries)
      }
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

    // Seed/hash alongside decode (capped body reads). Fire-and-forget; Save
    // awaits hashes via awaitPendingHashes. Must not gate gallery/decode.
    if (libraryBacked && batchRootId !== undefined) {
      void mapWithConcurrency(prepared, IMPORT_BODY_READ_CAP, async (entry) => {
        const existingRoot =
          getBookStoreSnapshot().book.assets[entry.assetId]?.sourceRootId
        const sourceRootId = existingRoot ?? batchRootId
        await seedAndHashEntry({
          assetId: entry.assetId,
          file: entry.file,
          relativePath: entry.relativePath,
          sourceRootId,
          memorySource: memorySourceForRoot(sourceRootId),
        })
      })
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

    return { imported: results.length, errors: [...earlyErrors, ...errors] }
  } finally {
    setImportRunning(false)
  }
}
