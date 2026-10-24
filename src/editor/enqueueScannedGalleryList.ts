import type { ScannedEntry } from '../assets'
import type { FolderManifestEntry } from '../project/session/sourceRootEntryIndex'
import type { ExifOrientation } from '../photo/types'
import { isAcceptedPhotoPath } from '../photo/pickPhotos'
import {
  enqueueGalleryAssets,
  getBookStoreSnapshot,
  getGalleryRelativePathIndex,
  mintAssetId,
  setAssetSessionMeta,
  setImportRunning,
} from './bookStore'

function basename(relativePath: string): string {
  const slash = relativePath.lastIndexOf('/')
  return slash >= 0 ? relativePath.slice(slash + 1) : relativePath
}

export interface EnqueueScannedGalleryResult {
  /** Entries that are new to the gallery (placeholders enqueued). */
  enqueued: readonly ScannedEntry[]
  /** Accepted image paths already present in the gallery. */
  alreadyPresent: readonly ScannedEntry[]
  /** Non-accepted scan entries (skipped for list-first). */
  skipped: readonly ScannedEntry[]
}

function dimsMeta(
  name: string,
  dims: FolderManifestEntry | undefined,
): {
  name: string
  correctedWidth: number
  correctedHeight: number
  orientation: ExifOrientation
  aspect: number
} {
  const width = dims?.width
  const height = dims?.height
  if (width === undefined || height === undefined) {
    return {
      name,
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      aspect: 1,
    }
  }
  const orientation = (dims?.orientation ?? 1) as ExifOrientation
  return {
    name,
    correctedWidth: width,
    correctedHeight: height,
    orientation,
    aspect: width / Math.max(1, height),
  }
}

function shouldRestoreAspect(
  existingAspect: number | undefined,
  dims: FolderManifestEntry | undefined,
): boolean {
  if (dims?.width === undefined || dims.height === undefined) {
    return false
  }
  return existingAspect === undefined || existingAspect === 1
}

/**
 * List-first: enqueue gallery placeholders from cheap scan metadata before any
 * body/`getFile` work. Reuses existing gallery ids that share relativePath.
 * Optional `dimsByPath` (from folder manifest) seeds aspect slots immediately.
 */
export function enqueueScannedGalleryList(
  sourceRootId: string,
  scanned: readonly ScannedEntry[],
  options?: {
    markImportRunning?: boolean
    dimsByPath?: ReadonlyMap<string, FolderManifestEntry> | null
  },
): EnqueueScannedGalleryResult {
  const book = getBookStoreSnapshot().book
  const byPath = getGalleryRelativePathIndex()
  const dimsByPath = options?.dimsByPath ?? null
  const sessionMeta = getBookStoreSnapshot().sessionMeta

  const enqueued: ScannedEntry[] = []
  const alreadyPresent: ScannedEntry[] = []
  const skipped: ScannedEntry[] = []
  const toFlush: {
    assetId: string
    meta: {
      name: string
      correctedWidth: number
      correctedHeight: number
      orientation: ExifOrientation
      aspect: number
    }
    asset: {
      sourceRootId: string
      relativePath: string
      byteSize: number
      mtimeMs: number
    }
  }[] = []

  for (const entry of scanned) {
    if (!isAcceptedPhotoPath(entry.relativePath)) {
      skipped.push(entry)
      continue
    }
    const dims = dimsByPath?.get(entry.relativePath)
    const existingId = byPath.get(entry.relativePath)
    if (existingId !== undefined) {
      alreadyPresent.push(entry)
      // Restore aspect from manifest when sessionMeta was wiped on reload.
      const existingMeta = sessionMeta.get(existingId)
      if (shouldRestoreAspect(existingMeta?.aspect, dims)) {
        setAssetSessionMeta(
          existingId,
          dimsMeta(existingMeta?.name ?? basename(entry.relativePath), dims),
        )
      }
      continue
    }
    const name = basename(entry.relativePath)
    const assetId = mintAssetId(name)
    byPath.set(entry.relativePath, assetId)
    enqueued.push(entry)
    toFlush.push({
      assetId,
      meta: dimsMeta(name, dims),
      asset: {
        sourceRootId,
        relativePath: entry.relativePath,
        byteSize: entry.byteSize,
        mtimeMs: entry.mtimeMs,
      },
    })
  }

  if (options?.markImportRunning !== false && toFlush.length > 0) {
    setImportRunning(
      true,
      book.gallery.length + toFlush.length + alreadyPresent.length,
    )
  }
  if (toFlush.length > 0) {
    enqueueGalleryAssets(toFlush)
  }

  return { enqueued, alreadyPresent, skipped }
}

/** Hydrate gallery from a persisted folder manifest before scanRoot resolves. */
export function enqueueManifestGalleryList(
  sourceRootId: string,
  entries: Readonly<Record<string, FolderManifestEntry>>,
  options?: { markImportRunning?: boolean },
): EnqueueScannedGalleryResult {
  const scanned: ScannedEntry[] = Object.entries(entries).map(
    ([relativePath, meta]) => ({
      relativePath,
      byteSize: meta.byteSize,
      mtimeMs: meta.mtimeMs,
    }),
  )
  const dimsByPath = new Map(Object.entries(entries))
  return enqueueScannedGalleryList(sourceRootId, scanned, {
    markImportRunning: options?.markImportRunning ?? false,
    dimsByPath,
  })
}
