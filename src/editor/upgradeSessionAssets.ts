import { createMemoryAssetSource, type AssetSource } from '../assets'
import { cacheKeyFromIdentity } from '../assets/cacheKey'
import { getAssetSource } from '../photo/assetSources'
import { putCachedTierForHash } from '../photo/tierCache'
import { getBookStoreSnapshot, patchAssetRecord } from './bookStore'
import {
  IMPORT_BODY_READ_CAP,
  mapWithConcurrency,
  relativePathFor,
} from './importBodyReads'
import { trackHashJob } from './pendingHashes'
import { putCachedThumbForHash } from './thumbCache'

function needsIdentity(assetId: string): boolean {
  const asset = getBookStoreSnapshot().book.assets[assetId]
  if (asset === undefined) {
    return false
  }
  return (
    asset.sourceRootId === undefined ||
    asset.relativePath === undefined ||
    asset.byteSize === undefined ||
    asset.mtimeMs === undefined
  )
}

/**
 * Upgrade session-only gallery assets that still have live Files into
 * library-backed identity so DerivedCache can key by path/size/mtime/root.
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

  await mapWithConcurrency(toUpgrade, IMPORT_BODY_READ_CAP, async (assetId) => {
    const file = getAssetSource(assetId)
    if (file === undefined) {
      return
    }
    const relativePath = relativePathFor(file)
    const bytes = await file.arrayBuffer()
    memorySource.seedFile(sourceRootId, relativePath, bytes, file.lastModified)
    const identity = {
      sourceRootId,
      relativePath,
      byteSize: file.size,
      mtimeMs: file.lastModified,
    }
    patchAssetRecord(assetId, identity)

    const cacheKey = cacheKeyFromIdentity(identity)
    const putJob = trackHashJob(
      Promise.all([
        putCachedThumbForHash(assetId, cacheKey),
        putCachedTierForHash(assetId, cacheKey),
      ]).then(() => cacheKey),
    )
    await putJob.catch(() => {
      // Identity-keyed puts are best-effort; path/size/mtime still persist.
    })
  })
}
