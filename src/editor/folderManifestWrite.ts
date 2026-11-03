import type { Asset } from '../core'
import {
  patchManifestDecodeFailed,
  patchManifestDimensions,
  type ManifestEntryIdentity,
} from '../project/session/sourceRootEntryIndex'

export interface ManifestDimPatch {
  width: number
  height: number
  orientation: number
}

/** Folder-manifest identity of an FSA-rooted asset, or null when incomplete. */
function manifestIdentity(
  asset: Asset | undefined,
): (ManifestEntryIdentity & { sourceRootId: string }) | null {
  if (asset === undefined) {
    return null
  }
  const sourceRootId = asset.sourceRootId
  const relativePath = asset.relativePath
  const byteSize = asset.byteSize
  const mtimeMs = asset.mtimeMs
  if (typeof sourceRootId !== 'string' || sourceRootId === '') {
    return null
  }
  if (typeof relativePath !== 'string' || relativePath === '') {
    return null
  }
  if (typeof byteSize !== 'number' || typeof mtimeMs !== 'number') {
    return null
  }
  return { sourceRootId, relativePath, byteSize, mtimeMs }
}

/**
 * Best-effort folder-manifest dim write after decode.
 * Returns whether a write was scheduled (for tests); never throws to callers.
 */
export function tryPatchManifestFromAsset(
  asset: Asset | undefined,
  dims: ManifestDimPatch,
): boolean {
  const identity = manifestIdentity(asset)
  if (identity === null) {
    return false
  }
  if (
    !(dims.width > 0) ||
    !(dims.height > 0) ||
    !Number.isInteger(dims.orientation) ||
    dims.orientation < 1 ||
    dims.orientation > 8
  ) {
    return false
  }
  void patchManifestDimensions(identity.sourceRootId, {
    relativePath: identity.relativePath,
    byteSize: identity.byteSize,
    mtimeMs: identity.mtimeMs,
    width: dims.width,
    height: dims.height,
    orientation: dims.orientation,
  }).catch(() => {
    // Manifest write is disposable; scan rebuild covers misses.
  })
  return true
}

/**
 * Best-effort: remember a failed import decode in the folder manifest so a
 * reload keeps the path out of the gallery. Returns whether it was scheduled.
 */
export function tryMarkManifestDecodeFailed(asset: Asset | undefined): boolean {
  const identity = manifestIdentity(asset)
  if (identity === null) {
    return false
  }
  void patchManifestDecodeFailed(identity.sourceRootId, {
    relativePath: identity.relativePath,
    byteSize: identity.byteSize,
    mtimeMs: identity.mtimeMs,
  }).catch(() => {
    // Disposable like dims: the next import retries and re-marks.
  })
  return true
}
