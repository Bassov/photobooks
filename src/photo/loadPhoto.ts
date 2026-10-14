import { measureHandlerSync } from '../perf/measureHandler'
import { aspectRatio } from './aspectRatio'
import { processAsset, resetAssetPool, warmAssetPool } from './assetPool'
import { formatBytes } from './formatBytes'
import { isAcceptedPhotoMime } from './mime'
import { UnsupportedPhotoFormatError, type PhotoCardModel } from './types'

/** `performance.measure` label for the sync open/load kickoff (handler p95 gate). */
const OPEN_PHOTO_HANDLER_LABEL = 'open-photo'

/** Eagerly construct the asset worker pool (one-time setup outside hot-handler measures). */
export function warmPhotoWorker(): void {
  warmAssetPool()
}

/** Terminates and clears the asset worker pool (tests / teardown). */
export function resetPhotoWorker(): void {
  resetAssetPool()
}

export async function loadPhoto(file: File): Promise<PhotoCardModel> {
  const mimeType = file.type || 'application/octet-stream'
  if (!isAcceptedPhotoMime(mimeType)) {
    throw new UnsupportedPhotoFormatError(mimeType)
  }
  warmAssetPool()
  const responsePromise = measureHandlerSync(OPEN_PHOTO_HANDLER_LABEL, () =>
    processAsset({
      assetId: `legacy-${file.name}`,
      file,
      priority: 'visible',
    }),
  )

  const response = await responsePromise

  const previewBlob = new Blob([response.previewBuffer], {
    type: response.previewMimeType,
  })
  const previewUrl = URL.createObjectURL(previewBlob)

  return {
    name: response.name,
    mimeType: response.mimeType,
    byteLength: response.byteLength,
    width: response.width,
    height: response.height,
    correctedWidth: response.correctedWidth,
    correctedHeight: response.correctedHeight,
    orientation: response.orientation as PhotoCardModel['orientation'],
    aspectLabel: aspectRatio(response.correctedWidth, response.correctedHeight),
    sizeLabel: formatBytes(response.byteLength),
    previewUrl,
  }
}

export function revokePhotoPreview(model: PhotoCardModel): void {
  URL.revokeObjectURL(model.previewUrl)
}
