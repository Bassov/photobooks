import { measureHandlerSync } from '../perf/measureHandler'
import { aspectRatio } from './aspectRatio'
import { formatBytes } from './formatBytes'
import { isAcceptedPhotoMime } from './mime'
import type { PhotoWorkerRequest, PhotoWorkerResponse } from './processPhoto'
import { UnsupportedPhotoFormatError, type PhotoCardModel } from './types'

/** `performance.measure` label for the sync open/load kickoff (handler p95 gate). */
const OPEN_PHOTO_HANDLER_LABEL = 'open-photo'

let workerInstance: Worker | null = null
let requestCounter = 0

function getWorker(): Worker {
  workerInstance ??= new Worker(new URL('./photo.worker.ts', import.meta.url), {
    type: 'module',
  })
  return workerInstance
}

/** Eagerly construct the photo worker (one-time setup outside hot-handler measures). */
export function warmPhotoWorker(): void {
  getWorker()
}

/** Terminates and clears the cached photo worker (tests / teardown). */
export function resetPhotoWorker(): void {
  workerInstance?.terminate()
  workerInstance = null
}

function requestPhoto(file: File): Promise<PhotoWorkerResponse> {
  const worker = getWorker()
  const id = `photo-${String((requestCounter += 1))}`

  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<PhotoWorkerResponse>) => {
      if (event.data.id !== id) {
        return
      }
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      resolve(event.data)
    }

    const onError = (event: ErrorEvent) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(new Error(event.message || 'Photo worker failed'))
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)

    const request: PhotoWorkerRequest = { id, file }
    worker.postMessage(request)
  })
}

export async function loadPhoto(file: File): Promise<PhotoCardModel> {
  const mimeType = file.type || 'application/octet-stream'
  if (!isAcceptedPhotoMime(mimeType)) {
    throw new UnsupportedPhotoFormatError(mimeType)
  }
  // Worker construction is one-time setup; keep it outside the hot-handler measure.
  getWorker()
  const responsePromise = measureHandlerSync(OPEN_PHOTO_HANDLER_LABEL, () =>
    requestPhoto(file),
  )

  const response = await responsePromise

  if (!response.ok) {
    throw new Error(response.error)
  }

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
    orientation: response.orientation,
    aspectLabel: aspectRatio(response.correctedWidth, response.correctedHeight),
    sizeLabel: formatBytes(response.byteLength),
    previewUrl,
  }
}

export function revokePhotoPreview(model: PhotoCardModel): void {
  URL.revokeObjectURL(model.previewUrl)
}
