import { sha256HexSync } from './sha256Sync'

/** Fields that form a durable DerivedCache identity key. */
export interface AssetIdentityKey {
  sourceRootId: string
  relativePath: string
  byteSize: number
  mtimeMs: number
}

/**
 * Canonical identity string. Format is part of the cache-key contract —
 * do not change without accepting a full OPFS regen.
 */
export function identityKeyString(identity: AssetIdentityKey): string {
  return `${identity.sourceRootId}\n${identity.relativePath}\n${String(identity.byteSize)}\n${String(identity.mtimeMs)}`
}

/** Sync 64-hex digest for DerivedCache `assetHash` (not file-byte SHA-256). */
export function cacheKeyFromIdentity(identity: AssetIdentityKey): string {
  return sha256HexSync(identityKeyString(identity))
}

export function tryCacheKeyFromAsset(asset: {
  sourceRootId?: string | undefined
  relativePath?: string | undefined
  byteSize?: number | undefined
  mtimeMs?: number | undefined
}): string | undefined {
  const { sourceRootId, relativePath, byteSize, mtimeMs } = asset
  if (
    sourceRootId === undefined ||
    sourceRootId.length === 0 ||
    relativePath === undefined ||
    relativePath.length === 0 ||
    byteSize === undefined ||
    mtimeMs === undefined ||
    !Number.isFinite(byteSize) ||
    !Number.isFinite(mtimeMs)
  ) {
    return undefined
  }
  return cacheKeyFromIdentity({
    sourceRootId,
    relativePath,
    byteSize,
    mtimeMs,
  })
}
