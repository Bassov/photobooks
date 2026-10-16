import {
  createMemoryAssetSource,
  hashContent,
  type AssetSource,
} from '../assets'
import { getAssetSource } from '../photo/assetSources'
import { putCachedTierForHash } from '../photo/tierCache'
import { getBookStoreSnapshot, patchAssetRecord } from './bookStore'
import { trackHashJob } from './pendingHashes'
import { putCachedThumbForHash } from './thumbCache'

function relativePathFor(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string })
    .webkitRelativePath
  if (typeof relative === 'string' && relative.length > 0) {
    return relative
  }
  return file.name
}

function needsIdentity(assetId: string): boolean {
  const asset = getBookStoreSnapshot().book.assets[assetId]
  if (asset === undefined) {
    return false
  }
  return (
    asset.sourceRootId === undefined ||
    asset.relativePath === undefined ||
    asset.contentHash === undefined
  )
}

/**
 * Upgrade session-only gallery assets that still have live Files into
 * library-backed identity + contentHash (for DerivedCache hydrate after reload).
 */
export async function upgradeSessionAssetsForLibrary(
  register: (rootId: string, source: AssetSource) => void,
): Promise<void> {
  const gallery = getBookStoreSnapshot().book.gallery
  const toUpgrade = gallery.filter((id) => {
    const file = getAssetSource(id)
    return file !== undefined && needsIdentity(id)
  })
  if (toUpgrade.length === 0) {
    return
  }

  const sourceRootId = `root-${crypto.randomUUID()}`
  const memorySource = createMemoryAssetSource()
  register(sourceRootId, memorySource)

  await Promise.all(
    toUpgrade.map(async (assetId) => {
      const file = getAssetSource(assetId)
      if (file === undefined) {
        return
      }
      const relativePath = relativePathFor(file)
      const bytes = await file.arrayBuffer()
      memorySource.seedFile(
        sourceRootId,
        relativePath,
        bytes,
        file.lastModified,
      )
      patchAssetRecord(assetId, {
        sourceRootId,
        relativePath,
        byteSize: file.size,
        mtimeMs: file.lastModified,
      })

      const hashJob = trackHashJob(
        hashContent(bytes.slice(0)).then(async (contentHash) => {
          patchAssetRecord(assetId, { contentHash })
          await Promise.all([
            putCachedThumbForHash(assetId, contentHash),
            putCachedTierForHash(assetId, contentHash),
          ])
          return contentHash
        }),
      )
      await hashJob.catch(() => {
        // Hash is best-effort; path/size/mtime still persist.
      })
    }),
  )
}
