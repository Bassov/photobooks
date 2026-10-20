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
  buildContentHashIndex,
  buildReuseIndex,
  createBodyReadGate,
  IMPORT_BODY_READ_CAP,
  mapWithConcurrency,
  relativePathFor,
  reuseIdentityKey,
} from './importBodyReads'
import { resolveByContentHash, type HashResolveJob } from './importHashReuse'
import { awaitPendingHashes } from './pendingHashes'
import { isLibraryBacked } from './projectSession'
import { memorySourceForRoot, seedAndHashEntry } from './seedLibraryImport'
import { setThumbUrl } from './thumbCache'

export {
  buildContentHashIndex,
  buildReuseIndex,
  findReusableAssetId,
  findReusableAssetIdByContentHash,
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
  bytes?: ArrayBuffer
  contentHash?: string
}

export async function importPhotoFiles(
  files: readonly File[],
  options: ImportPhotoOptions = {},
): Promise<{ imported: number; errors: ImportFileError[] }> {
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

  setImportRunning(true, accepted.length + rejected.length)
  try {
    if (libraryBacked) {
      // Content-hash fallback needs settled hashes from prior imports.
      // Run after importRunning so progress is visible while we wait.
      await awaitPendingHashes()
    }

    const book = getBookStoreSnapshot().book
    const pathIndex = libraryBacked
      ? buildReuseIndex(book.gallery, book.assets)
      : null
    const hashIndex = libraryBacked
      ? buildContentHashIndex(book.gallery, book.assets)
      : null
    // Only hash-before-enqueue when prior assets already have hashes to match.
    // Fresh imports (empty hash index) stay identity-first.
    const hashFallbackActive = hashIndex !== null && hashIndex.size > 0

    const immediate: PreparedEntry[] = []
    const needsHash: HashResolveJob[] = []

    for (const file of accepted) {
      const relativePath = relativePathFor(file)
      const pathId = pathIndex?.get(
        reuseIdentityKey(relativePath, file.size, file.lastModified),
      )
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
      if (hashFallbackActive) {
        needsHash.push({
          file,
          relativePath,
          index: needsHash.length,
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

    if (!libraryBacked && immediate.length > 0) {
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

    if (libraryBacked && batchRootId !== undefined) {
      const newImmediate = immediate.filter((entry) => !entry.reused)
      for (const entry of newImmediate) {
        enqueueNewLibraryIdentity(entry, batchRootId)
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

    if (immediate.length === 0 && needsHash.length === 0) {
      options.onProgress?.({
        total: rejected.length,
        completed: rejected.length,
        errors: earlyErrors,
        running: false,
      })
      return { imported: 0, errors: earlyErrors }
    }

    const bodyGate = createBodyReadGate(IMPORT_BODY_READ_CAP)

    const immediateBatch =
      immediate.length === 0
        ? Promise.resolve({
            results: [] as { assetId: string }[],
            errors: [] as ImportFileError[],
          })
        : runImportBatch(immediate, {
            onProgress: report,
            priority: 'prefetch',
            onResult: applyImportResult,
          })

    if (libraryBacked && batchRootId !== undefined && immediate.length > 0) {
      // Fire-and-forget seeds; share the body-read cap with hash fallback.
      void mapWithConcurrency(
        immediate,
        IMPORT_BODY_READ_CAP,
        async (entry) => {
          await bodyGate.withBodyRead(async () => {
            const existingRoot =
              getBookStoreSnapshot().book.assets[entry.assetId]?.sourceRootId
            const sourceRootId = existingRoot ?? batchRootId
            const reusedHash = entry.reused
              ? getAssetContentHash(entry.assetId)
              : undefined
            const seedOpts = {
              assetId: entry.assetId,
              file: entry.file,
              relativePath: entry.relativePath,
              sourceRootId,
              memorySource: memorySourceForRoot(sourceRootId),
            }
            await seedAndHashEntry(
              reusedHash !== undefined
                ? { ...seedOpts, contentHash: reusedHash }
                : seedOpts,
            )
          })
        },
      )
    }

    const hashOutcome =
      libraryBacked && batchRootId !== undefined && hashIndex !== null
        ? await resolveByContentHash({
            jobs: needsHash,
            hashIndex,
            batchRootId,
            withBodyRead: bodyGate.withBodyRead,
            enqueueNew: (entry) => {
              enqueueNewLibraryIdentity(entry, batchRootId)
            },
          })
        : { prepared: [] as PreparedEntry[], errors: [] as ImportFileError[] }
    const deferred = hashOutcome.prepared
    const hashErrors = hashOutcome.errors

    const deferredBatch =
      deferred.length === 0
        ? Promise.resolve({
            results: [] as { assetId: string }[],
            errors: [] as ImportFileError[],
          })
        : runImportBatch(deferred, {
            onProgress: report,
            priority: 'prefetch',
            onResult: applyImportResult,
          })

    const [immediateOutcome, deferredOutcome] = await Promise.all([
      immediateBatch,
      deferredBatch,
    ])

    return {
      imported:
        immediateOutcome.results.length + deferredOutcome.results.length,
      errors: [
        ...earlyErrors,
        ...hashErrors,
        ...immediateOutcome.errors,
        ...deferredOutcome.errors,
      ],
    }
  } finally {
    setImportRunning(false)
  }
}
