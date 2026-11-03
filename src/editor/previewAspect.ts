import { processAsset } from '../photo/assetPool'
import { readJpegSofSize } from '../photo/jpegSof'
import {
  getBookStoreSnapshot,
  setAssetSessionMeta,
  type AssetSessionMeta,
} from './bookStore'

function applyDims(
  assetId: string,
  width: number,
  height: number,
  name: string,
): void {
  if (width <= 0 || height <= 0) {
    return
  }
  const meta: AssetSessionMeta = {
    name,
    correctedWidth: width,
    correctedHeight: height,
    orientation: 1,
    aspect: width / height,
  }
  setAssetSessionMeta(assetId, meta)
}

function hasRealDims(assetId: string): boolean {
  const existing = getBookStoreSnapshot().sessionMeta.get(assetId)
  return (
    existing !== undefined &&
    existing.correctedWidth > 1 &&
    existing.correctedHeight > 1
  )
}

/** Restore session aspect from a worker decode's corrected (upright) size. */
export function restoreAspectFromDecode(
  assetId: string,
  width: number,
  height: number,
): void {
  if (hasRealDims(assetId)) {
    return
  }
  const name = getBookStoreSnapshot().sessionMeta.get(assetId)?.name ?? assetId
  applyDims(assetId, width, height, name)
}

/** Relative aspect drift that tier rounding (320 / 1280 edge) stays within. */
const ASPECT_TOLERANCE = 0.01

/**
 * Correct a placeholder session aspect from a decoded, upright display tier.
 * Only the aspect changes: dims stay unknown so a real decode still wins and
 * DPI never reads tier pixels.
 */
export function restoreAspectFromImage(
  assetId: string,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0 || hasRealDims(assetId)) {
    return
  }
  const existing = getBookStoreSnapshot().sessionMeta.get(assetId)
  const aspect = width / height
  if (
    existing !== undefined &&
    Math.abs(existing.aspect / aspect - 1) <= ASPECT_TOLERANCE
  ) {
    return
  }
  setAssetSessionMeta(assetId, {
    name: existing?.name ?? assetId,
    correctedWidth: 1,
    correctedHeight: 1,
    orientation: existing?.orientation ?? 1,
    aspect,
  })
}

/**
 * Restore session aspect after DerivedCache hydrate.
 * JPEG: pure SOF parse. Otherwise: existing photo worker (no main-thread decode).
 */
export function restoreAspectFromPreview(
  assetId: string,
  buffer: ArrayBuffer,
  mimeType: string,
): void {
  try {
    if (hasRealDims(assetId)) {
      return
    }
    const name =
      getBookStoreSnapshot().sessionMeta.get(assetId)?.name ?? assetId
    const isJpeg =
      mimeType === 'image/jpeg' ||
      mimeType === 'image/jpg' ||
      mimeType.endsWith('+jpeg')

    if (isJpeg) {
      const size = readJpegSofSize(buffer)
      if (size !== null) {
        applyDims(assetId, size.width, size.height, name)
        return
      }
    }

    if (typeof Worker === 'undefined') {
      return
    }

    const file = new File([buffer], name, { type: mimeType })
    void processAsset({
      assetId: `${assetId}:aspect`,
      file,
      priority: 'background',
      maxEdge: 64,
    })
      .then((result) => {
        applyDims(assetId, result.correctedWidth, result.correctedHeight, name)
      })
      .catch(() => {
        // Aspect stays default until a later successful hydrate/decode.
      })
  } catch {
    // Never block thumb/tier hydrate on aspect restore failures.
  }
}
