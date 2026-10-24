import { measureHandlerSync } from '../perf/measureHandler'
import {
  runImportBatch,
  shouldDeferHeicDecode,
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
  createBodyReadGate,
  IMPORT_BODY_READ_CAP,
  mapWithConcurrency,
  relativePathFor,
  reuseIdentityKey,
} from './importBodyReads'
import { tryPatchManifestFromAsset } from './folderManifestWrite'
import { isLibraryBacked } from './projectSession'
import { yieldForPaint } from './relink/yieldForPaint'
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
  const prior = getBookStoreSnapshot().sessionMeta.get(result.assetId)
  const metaUnchanged =
    prior?.name === result.name &&
    prior.correctedWidth === result.correctedWidth &&
    prior.correctedHeight === result.correctedHeight &&
    prior.orientation === result.orientation &&
    prior.correctedWidth > 1 &&
    prior.correctedHeight > 1
  // Re-import with known dims: skip bookStore meta flush + IDB manifest RMW
  // so scroll-during-import only pays for thumb publishes.
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
  setThumbUrl(
    result.assetId,
    result.previewBuffer,
    result.previewMimeType,
    getAssetCacheKey(result.assetId),
  )
  // Lazy HEIC: body seed was skipped while deferred; seed once decode lands.
  const asset = getBookStoreSnapshot().book.assets[result.assetId]
  const file = getAssetSource(result.assetId)
  const sourceRootId = asset?.sourceRootId
  const relativePath = asset?.relativePath
  if (
    file !== undefined &&
    sourceRootId !== undefined &&
    relativePath !== undefined &&
    isKnownHeicFile(file)
  ) {
    void seedAndHashEntry({
      assetId: result.assetId,
      file,
      relativePath,
      sourceRootId,
      memorySource: memorySourceForRoot(sourceRootId),
    })
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
): {
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
      // HEIC placeholders stay in the gallery when decode is unsupported.
      if (heicAssetIds.has(assetId)) {
        return
      }
      discardFailedImport(assetId)
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

    const bodyGate = createBodyReadGate(IMPORT_BODY_READ_CAP)
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

    const immediateBatch = runImportBatch(
      immediate,
      importDecodeBatchOptions(report, heicAssetIds),
    )

    const immediateOutcome = await immediateBatch

    // Body seed after decode batch so scroll-during-import LoAF windows are not
    // competing with parallel arrayBuffer + seedFile main-thread bursts.
    if (libraryBacked && batchRootId !== undefined && immediate.length > 0) {
      const seedConcurrency = Math.min(4, IMPORT_BODY_READ_CAP)
      void mapWithConcurrency(immediate, seedConcurrency, async (entry) => {
        // Idle HEIC: no full-body seed until visible ∪ book-used decode.
        if (shouldDeferHeicDecode(entry.assetId, entry.file, 'prefetch')) {
          return
        }
        await bodyGate.withBodyRead(async () => {
          const existingRoot =
            getBookStoreSnapshot().book.assets[entry.assetId]?.sourceRootId
          const sourceRootId = existingRoot ?? batchRootId
          // Seed memory source + identity-keyed DerivedCache puts (no contentHash).
          await seedAndHashEntry({
            assetId: entry.assetId,
            file: entry.file,
            relativePath: entry.relativePath,
            sourceRootId,
            memorySource: memorySourceForRoot(sourceRootId),
          })
        })
        await yieldForPaint()
      })
    }

    return {
      imported: immediateOutcome.results.length,
      errors: [...earlyErrors, ...immediateOutcome.errors],
      skipped: skippedCount,
    }
  } finally {
    setImportRunning(false)
  }
}
