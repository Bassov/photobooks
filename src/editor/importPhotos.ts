import { measureHandlerSync } from '../perf/measureHandler'
import {
  runImportBatch,
  type ImportBatchState,
  createImportFileError,
  type ImportFileError,
} from '../photo/assetPool'
import {
  getAssetSource,
  releaseAssetSource,
  retainAssetSource,
} from '../photo/assetSources'
import {
  isKnownHeicFile,
  markHeicFile,
  upgradeRejectedWithHeicSniff,
} from '../photo/heic'
import { isJpegLikeFile } from '../photo/mime'
import { partitionImportFiles } from '../photo/pickPhotos'
import type { ExifOrientation } from '../photo/types'
import {
  enqueueGalleryAssets,
  getAssetCacheKey,
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
  IMPORT_BODY_READ_CAP,
  mapWithConcurrency,
  relativePathFor,
  reuseIdentityKey,
} from './importBodyReads'
import { tryPatchManifestFromAsset } from './folderManifestWrite'
import { isLibraryBacked } from './projectSession'
import { seedWorkingPreview } from '../photo/tierCache'
import { memorySourceForRoot, seedAndHashEntry } from './seedLibraryImport'
import { trackHashJob } from './pendingHashes'
import { setThumbUrl } from './thumbCache'

/** `performance.measure` label for the sync import kickoff (handler p95 gate). */
const IMPORT_PHOTOS_HANDLER_LABEL = 'import-photos'

export type ImportProgress = ImportBatchState

export interface ImportPhotoOptions {
  onProgress?: (state: ImportProgress) => void
  /**
   * Fired when a non-HEIC decode fails (including deferred lazy JPEG after the
   * batch return). Callers that surface import-errors MUST listen here — the
   * batch result alone can miss late failures.
   */
  onDecodeError?: (error: ImportFileError) => void
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
  /**
   * When false, caller owns `importRunning` for a multi-batch folder import.
   * Default true (single-call imports set and clear the flag).
   */
  manageImportRunning?: boolean
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
  workingBuffer?: ArrayBuffer
  workingMimeType?: string
  sourceBuffer?: ArrayBuffer
}): void {
  const prior = getBookStoreSnapshot().sessionMeta.get(result.assetId)
  // Skip when session meta already matches decode output — including the
  // enqueue placeholder (1×1) when the file is truly 1×1. The old `> 1`
  // gate forced a meta Map + filmstrip prefix rebuild for every bulk PNG
  // fixture even though aspect stayed 1 (LoAF during scroll-during-import).
  const metaUnchanged =
    prior?.name === result.name &&
    prior.correctedWidth === result.correctedWidth &&
    prior.correctedHeight === result.correctedHeight &&
    prior.orientation === result.orientation
  // Known dims: skip bookStore meta flush + IDB manifest RMW so
  // scroll-during-import only pays for thumb publishes.
  if (!metaUnchanged) {
    setAssetSessionMeta(result.assetId, {
      name: result.name,
      correctedWidth: result.correctedWidth,
      correctedHeight: result.correctedHeight,
      orientation: result.orientation as ExifOrientation,
      aspect: result.correctedWidth / Math.max(1, result.correctedHeight),
    })
    tryPatchManifestFromAsset(
      getBookStoreSnapshot().book.assets[result.assetId],
      {
        width: result.correctedWidth,
        height: result.correctedHeight,
        orientation: result.orientation,
      },
    )
  }
  const cacheKey = getAssetCacheKey(result.assetId)
  setThumbUrl(
    result.assetId,
    result.previewBuffer,
    result.previewMimeType,
    cacheKey,
  )
  if (
    result.workingBuffer !== undefined &&
    result.workingMimeType !== undefined
  ) {
    void trackHashJob(
      seedWorkingPreview(
        result.assetId,
        result.workingBuffer,
        result.workingMimeType,
        cacheKey,
      ),
    )
  }
  // Library seed once decode lands — reuse worker body when present (no second read).
  const asset = getBookStoreSnapshot().book.assets[result.assetId]
  const file = getAssetSource(result.assetId)
  const sourceRootId = asset?.sourceRootId
  const relativePath = asset?.relativePath
  if (
    file !== undefined &&
    sourceRootId !== undefined &&
    relativePath !== undefined
  ) {
    const seedOptions: Parameters<typeof seedAndHashEntry>[0] = {
      assetId: result.assetId,
      file,
      relativePath,
      sourceRootId,
      memorySource: memorySourceForRoot(sourceRootId),
    }
    if (result.sourceBuffer !== undefined) {
      seedOptions.bytes = result.sourceBuffer
    }
    void seedAndHashEntry(seedOptions)
  }
}

function discardFailedImport(assetId: string): void {
  const clearSelection = getSelectedAssetId() === assetId
  removeFailedImportAsset(assetId)
  releaseAssetSource(assetId)
  if (clearSelection) {
    setSelectedAssetId(null)
  }
}

function importDecodeBatchOptions(
  report: (state: ImportBatchState) => void,
  heicAssetIds: ReadonlySet<string>,
  onDecodeError: ((error: ImportFileError) => void) | undefined,
): {
  onProgress: (state: ImportBatchState) => void
  priority: 'prefetch'
  onResult: typeof applyImportResult
  onError: (assetId: string, error: ImportFileError) => void
} {
  return {
    onProgress: report,
    priority: 'prefetch',
    onResult: applyImportResult,
    onError: (assetId, error) => {
      // HEIC placeholders stay in the gallery when decode is unsupported.
      if (heicAssetIds.has(assetId)) {
        return
      }
      discardFailedImport(assetId)
      onDecodeError?.(error)
    },
  }
}

async function importPhotoFilesInner(
  files: readonly File[],
  options: ImportPhotoOptions,
): Promise<ImportPhotoResult> {
  const {
    accepted: partitionedAccepted,
    rejected: partitioned,
    skipped,
  } = partitionImportFiles(files, {
    source: options.source ?? 'files',
  })
  const afterSniff = await upgradeRejectedWithHeicSniff(
    partitioned,
    mapWithConcurrency,
    IMPORT_BODY_READ_CAP,
  )
  // Signature-detected HEIC joins the gallery as placeholders (lazy decode).
  const heicFromSniff = afterSniff.filter((entry) => entry.reason === 'heic')
  for (const entry of heicFromSniff) {
    markHeicFile(entry.file)
  }
  const rejected = afterSniff.filter((entry) => entry.reason !== 'heic')
  const accepted = [
    ...partitionedAccepted,
    ...heicFromSniff.map((entry) => entry.file),
  ]
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
  const manageImportRunning = options.manageImportRunning !== false

  if (manageImportRunning) {
    setImportRunning(true, progressTotal)
  }
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

    // List-first skipped extension-less HEIC (path not accepted); after sniff
    // promote, mint gallery rows for those new ids even when listAlreadyEnqueued.
    if (listAlreadyEnqueued) {
      const missingPlaceholders = immediate.filter((entry) => !entry.reused)
      if (missingPlaceholders.length > 0) {
        if (libraryBacked && batchRootId !== undefined) {
          for (const entry of missingPlaceholders) {
            enqueueNewLibraryIdentity(entry, batchRootId)
          }
        } else {
          enqueueGalleryAssets(
            missingPlaceholders.map(({ assetId, file }) => ({
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

    const heicAssetIds = new Set(
      immediate
        .filter((entry) => isKnownHeicFile(entry.file))
        .map((entry) => entry.assetId),
    )

    // Load jpegHeadPass (exifr) only when the batch has JPEGs — PNG/WebP
    // re-import must not pull EXIF parsing into the editor main chunk.
    if (immediate.some((entry) => isJpegLikeFile(entry.file))) {
      void import('./jpegHeadPass').then(({ runJpegHeadPass }) => {
        void runJpegHeadPass(immediate)
      })
    }

    // Library seed runs from applyImportResult with worker sourceBuffer (single
    // body read). Deferred JPEG/HEIC seed when they later decode into now.
    const immediateOutcome = await runImportBatch(
      immediate,
      importDecodeBatchOptions(report, heicAssetIds, options.onDecodeError),
    )

    return {
      imported: immediateOutcome.results.length,
      errors: [...earlyErrors, ...immediateOutcome.errors],
      skipped: skippedCount,
    }
  } finally {
    if (manageImportRunning) {
      setImportRunning(false)
    }
  }
}
