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
    const existing = getBookStoreSnapshot().sessionMeta.get(assetId)
    if (
      existing !== undefined &&
      existing.correctedWidth > 1 &&
      existing.correctedHeight > 1
    ) {
      return
    }
    const name = existing?.name ?? assetId
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
