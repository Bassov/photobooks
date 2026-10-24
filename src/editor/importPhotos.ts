import { measureHandlerSync } from '../perf/measureHandler'
import {
  runImportBatch,
  type ImportBatchState,
  createImportFileError,
  type ImportFileError,
} from '../photo/assetPool'
import { releaseAssetSource, retainAssetSource } from '../photo/assetSources'
import { upgradeRejectedWithHeicSniff } from '../photo/heic'
import { partitionImportFiles } from '../photo/pickPhotos'
import type { ExifOrientation } from '../photo/types'
import {
  enqueueGalleryAssets,
  getAssetContentHash,
  getBookStoreSnapshot,
  getGalleryRelativePathIndex,
  mintAssetId,
  removeFailedImportAsset,
  setAssetSessionMeta,
  setImportRunning,
} from './bookStore'
import { getSelectedAssetId, setSelectedAssetId } from './gallerySelection'
import {
  buildReuseIndex,
  createBodyReadGate,
  IMPORT_BODY_READ_CAP,
  mapWithConcurrency,
  relativePathFor,
  reuseIdentityKey,
} from './importBodyReads'
import { isLibraryBacked } from './projectSession'
import { memorySourceForRoot, seedAndHashEntry } from './seedLibraryImport'
import { setThumbUrl } from './thumbCache'

/** `performance.measure` label for the sync import kickoff (handler p95 gate). */
const IMPORT_PHOTOS_HANDLER_LABEL = 'import-photos'

export type ImportProgress = ImportBatchState

export interface ImportPhotoOptions {
  onProgress?: (state: ImportProgress) => void
  /** When set, overrides `isLibraryBacked()` for identity registration. */
  libraryBacked?: boolean
  sourceRootId?: string
  /** Folder imports skip non-image-like files; default is explicit file pick. */
  source?: 'files' | 'folder'
  /**
   * Retained for call-site compatibility; content-hash await is no longer used
   * on the import hot path.
   */
  awaitPriorHashes?: boolean
  /**
   * When true, skip gallery enqueue (caller already list-enqueued placeholders).
   * Still resolves Files, reuses by path+size+mtime, and runs thumb decode.
   */
  listAlreadyEnqueued?: boolean
}

export interface ImportPhotoResult {
  imported: number
  errors: ImportFileError[]
  skipped: number
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
): Promise<ImportPhotoResult> {
  return measureHandlerSync(IMPORT_PHOTOS_HANDLER_LABEL, () =>
    Promise.resolve().then(() => importPhotoFilesInner(files, options)),
  )
}

function enqueueNewLibraryIdentity(
  entry: PreparedEntry,
  batchRootId: string,
): void {
  enqueueGalleryAssets([
    {
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
          getBookStoreSnapshot().book.assets[entry.assetId]?.sourceRootId ??
          batchRootId,
        relativePath: entry.relativePath,
        byteSize: entry.file.size,
        mtimeMs: entry.file.lastModified,
      },
    },
  ])
}

function applyImportResult(result: {
  assetId: string
  name: string
  correctedWidth: number
  correctedHeight: number
  orientation: number
  previewBuffer: ArrayBuffer
  previewMimeType: string
}): void {
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
}

function discardFailedImport(assetId: string): void {
  const clearSelection = getSelectedAssetId() === assetId
  removeFailedImportAsset(assetId)
  releaseAssetSource(assetId)
  if (clearSelection) {
    setSelectedAssetId(null)
  }
}

function importDecodeBatchOptions(report: (state: ImportBatchState) => void): {
  onProgress: (state: ImportBatchState) => void
  priority: 'prefetch'
  onResult: typeof applyImportResult
  onError: (assetId: string) => void
} {
  return {
    onProgress: report,
    priority: 'prefetch',
    onResult: applyImportResult,
    onError: (assetId) => {
      discardFailedImport(assetId)
    },
  }
}

async function importPhotoFilesInner(
  files: readonly File[],
  options: ImportPhotoOptions,
): Promise<ImportPhotoResult> {
  const {
    accepted,
    rejected: partitioned,
    skipped,
  } = partitionImportFiles(files, {
    source: options.source ?? 'files',
  })
  const rejected = await upgradeRejectedWithHeicSniff(
    partitioned,
    mapWithConcurrency,
    IMPORT_BODY_READ_CAP,
  )
  const earlyErrors: ImportFileError[] = rejected.map(
    ({ file, message, reason }) =>
      createImportFileError({
        name: file.name,
        message,
        reason,
      }),
  )
  const skippedCount = skipped.length
  const progressTotal = accepted.length + rejected.length

  const libraryBacked = options.libraryBacked ?? isLibraryBacked()
  const batchRootId =
    options.sourceRootId ??
    (libraryBacked ? `root-${crypto.randomUUID()}` : undefined)
  const listAlreadyEnqueued = options.listAlreadyEnqueued === true

  setImportRunning(true, progressTotal)
  try {
    const book = getBookStoreSnapshot().book
    // List-first placeholders must resolve by path even in session (non-library)
    // editors — otherwise import mints a second id and thumbs never bind.
    const pathIndex =
      libraryBacked || listAlreadyEnqueued
        ? buildReuseIndex(book.gallery, book.assets)
        : null
    const byRelativePath = listAlreadyEnqueued
      ? getGalleryRelativePathIndex()
      : null

    const immediate: PreparedEntry[] = []

    for (const file of accepted) {
      const relativePath = relativePathFor(file)
      const pathId =
        pathIndex?.get(
          reuseIdentityKey(relativePath, file.size, file.lastModified),
        ) ?? byRelativePath?.get(relativePath)
      if (pathId !== undefined) {
        retainAssetSource(pathId, file)
        immediate.push({
          assetId: pathId,
          file,
          relativePath,
          reused: true,
        })
        continue
      }
      const assetId = mintAssetId(file.name)
      retainAssetSource(assetId, file)
      immediate.push({
        assetId,
        file,
        relativePath,
        reused: false,
      })
    }

    if (!libraryBacked && immediate.length > 0 && !listAlreadyEnqueued) {
      enqueueGalleryAssets(
        immediate.map(({ assetId, file }) => ({
          assetId,
          meta: {
            name: file.name,
            correctedWidth: 1,
            correctedHeight: 1,
            orientation: 1 as const,
            aspect: 1,
          },
        })),
      )
    }

    if (libraryBacked && batchRootId !== undefined && !listAlreadyEnqueued) {
      const newImmediate = immediate.filter((entry) => !entry.reused)
      for (const entry of newImmediate) {
        enqueueNewLibraryIdentity(entry, batchRootId)
      }
    }

    const report = (state: ImportBatchState): void => {
      options.onProgress?.({
        ...state,
        total: progressTotal,
        completed: state.completed + rejected.length,
        errors: [...earlyErrors, ...state.errors],
      })
    }

    if (immediate.length === 0) {
      options.onProgress?.({
        total: progressTotal,
        completed: progressTotal,
        errors: earlyErrors,
        running: false,
      })
      return { imported: 0, errors: earlyErrors, skipped: skippedCount }
    }

    const bodyGate = createBodyReadGate(IMPORT_BODY_READ_CAP)

    const immediateBatch = runImportBatch(
      immediate,
      importDecodeBatchOptions(report),
    )

    if (libraryBacked && batchRootId !== undefined && immediate.length > 0) {
      void mapWithConcurrency(
        immediate,
        IMPORT_BODY_READ_CAP,
        async (entry) => {
          await bodyGate.withBodyRead(async () => {
            const existingRoot =
              getBookStoreSnapshot().book.assets[entry.assetId]?.sourceRootId
            const sourceRootId = existingRoot ?? batchRootId
            // Async contentHash for DerivedCache thumb hydrate after reload —
            // not used for import identity (path/size/mtime only).
            await seedAndHashEntry({
              assetId: entry.assetId,
              file: entry.file,
              relativePath: entry.relativePath,
              sourceRootId,
              memorySource: memorySourceForRoot(sourceRootId),
            })
          })
        },
      )
    }

    const immediateOutcome = await immediateBatch

    return {
      imported: immediateOutcome.results.length,
      errors: [...earlyErrors, ...immediateOutcome.errors],
      skipped: skippedCount,
    }
  } finally {
    setImportRunning(false)
  }
}
