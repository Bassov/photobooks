import {
  hasPendingThumbDecode,
  isNowAssetId,
  processAsset,
} from '../photo/assetPool'
import { getAssetSource, retainAssetSource } from '../photo/assetSources'
import { getRegisteredAssetSource } from './assetSourceRegistry'
import { getBookStoreSnapshot } from './bookStore'
import { restoreAspectFromDecode } from './previewAspect'

export interface DecodedThumb {
  buffer: ArrayBuffer
  mimeType: string
}

/**
 * Session File for a gallery asset. After reload, restore verify may not have
 * retained it yet: resolve through the granted root's registered AssetSource.
 */
async function sourceFileFor(assetId: string): Promise<File | undefined> {
  const retained = getAssetSource(assetId)
  if (retained !== undefined) {
    return retained
  }
  const asset = getBookStoreSnapshot().book.assets[assetId]
  const rootId = asset?.sourceRootId
  const relativePath = asset?.relativePath
  if (rootId === undefined || relativePath === undefined) {
    return undefined
  }
  const source = getRegisteredAssetSource(rootId)
  if (source === undefined) {
    return undefined
  }
  const resolved = await source.resolveFile(rootId, relativePath)
  if (resolved.ok) {
    retainAssetSource(assetId, resolved.value)
    return resolved.value
  }
  return undefined
}

/**
 * DerivedCache miss (e.g. a lazy JPEG never decoded before save): encode
 * thumb320 through the decode pool. Now-set ids queue at now priority;
 * off-now JPEG/HEIC stay deferred until they enter now.
 */
export async function decodeThumbOnCacheMiss(
  assetId: string,
  signal: AbortSignal,
): Promise<DecodedThumb | null> {
  // AssetSource.resolveFile reports failures as results; it does not throw.
  const file = await sourceFileFor(assetId)
  // An import decode already owns this asset (it publishes + seeds on
  // result); a second deferral would orphan its promise.
  if (file === undefined || signal.aborted || hasPendingThumbDecode(assetId)) {
    return null
  }
  try {
    const result = await processAsset({
      assetId,
      file,
      priority: isNowAssetId(assetId) ? 'visible' : 'prefetch',
      signal,
    })
    restoreAspectFromDecode(
      assetId,
      result.correctedWidth,
      result.correctedHeight,
    )
    return { buffer: result.previewBuffer, mimeType: result.previewMimeType }
  } catch {
    // Aborted (left now / reset) or failed decode: a later mount retries.
    return null
  }
}
