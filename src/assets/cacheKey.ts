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

/** Digests kept by identity string; the oldest is dropped past this size. */
export const CACHE_KEY_MEMO_MAX = 16_384

/**
 * Rows and the warm lane read keys on every render / pass; one SHA-256 per
 * identity keeps that work and its garbage off the scroll path.
 */
const digests = new Map<string, string>()

/** Sync 64-hex digest for DerivedCache `assetHash` (not file-byte SHA-256). */
export function cacheKeyFromIdentity(identity: AssetIdentityKey): string {
  const canonical = identityKeyString(identity)
  const known = digests.get(canonical)
  if (known !== undefined) {
    return known
  }
  const digest = sha256HexSync(canonical)
  if (digests.size >= CACHE_KEY_MEMO_MAX) {
    for (const oldest of digests.keys()) {
      digests.delete(oldest)
      break
    }
  }
  digests.set(canonical, digest)
  return digest
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
