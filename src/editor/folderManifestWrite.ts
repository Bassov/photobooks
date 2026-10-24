import type { Asset } from '../core'
import { patchManifestDimensions } from '../project/session/sourceRootEntryIndex'

export interface ManifestDimPatch {
  width: number
  height: number
  orientation: number
}

/**
 * Best-effort folder-manifest dim write after decode.
 * Returns whether a write was scheduled (for tests); never throws to callers.
 */
export function tryPatchManifestFromAsset(
  asset: Asset | undefined,
  dims: ManifestDimPatch,
): boolean {
  if (asset === undefined) {
    return false
  }
  const sourceRootId = asset.sourceRootId
  const relativePath = asset.relativePath
  const byteSize = asset.byteSize
  const mtimeMs = asset.mtimeMs
  if (typeof sourceRootId !== 'string' || sourceRootId === '') {
    return false
  }
  if (typeof relativePath !== 'string' || relativePath === '') {
    return false
  }
  if (typeof byteSize !== 'number' || typeof mtimeMs !== 'number') {
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
  void patchManifestDimensions(sourceRootId, {
    relativePath,
    byteSize,
    mtimeMs,
    width: dims.width,
    height: dims.height,
    orientation: dims.orientation,
  }).catch(() => {
    // Manifest write is disposable; scan rebuild covers misses.
  })
  return true
}
