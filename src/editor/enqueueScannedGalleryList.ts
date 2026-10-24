import type { ScannedEntry } from '../assets'
import { isAcceptedPhotoPath } from '../photo/pickPhotos'
import {
  enqueueGalleryAssets,
  getBookStoreSnapshot,
  getGalleryRelativePathIndex,
  mintAssetId,
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

/**
 * List-first: enqueue gallery placeholders from cheap scan metadata before any
 * body/`getFile` work. Reuses existing gallery ids that share relativePath.
 */
export function enqueueScannedGalleryList(
  sourceRootId: string,
  scanned: readonly ScannedEntry[],
  options?: { markImportRunning?: boolean },
): EnqueueScannedGalleryResult {
  const book = getBookStoreSnapshot().book
  const byPath = getGalleryRelativePathIndex()

  const enqueued: ScannedEntry[] = []
  const alreadyPresent: ScannedEntry[] = []
  const skipped: ScannedEntry[] = []
  const toFlush: {
    assetId: string
    meta: {
      name: string
      correctedWidth: number
      correctedHeight: number
      orientation: 1
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
    const existingId = byPath.get(entry.relativePath)
    if (existingId !== undefined) {
      alreadyPresent.push(entry)
      continue
    }
    const name = basename(entry.relativePath)
    const assetId = mintAssetId(name)
    byPath.set(entry.relativePath, assetId)
    enqueued.push(entry)
    toFlush.push({
      assetId,
      meta: {
        name,
        correctedWidth: 1,
        correctedHeight: 1,
        orientation: 1,
        aspect: 1,
      },
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
