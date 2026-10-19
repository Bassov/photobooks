import {
  extractAssetMetadata,
  type ExtractedAssetMetadata,
} from '../assets/extractAssetMetadata'
import {
  processPhotoRequest,
  type PhotoWorkerRequest,
  type PhotoWorkerResponse,
} from './processPhoto'

export type {
  PhotoWorkerFailure,
  PhotoWorkerRequest,
  PhotoWorkerResponse,
  PhotoWorkerSuccess,
} from './processPhoto'

interface MetadataWorkerRequest {
  id: string
  kind: 'metadata'
  buffer: ArrayBuffer
  mimeType?: string
  includeGps?: boolean
}

type MetadataWorkerResponse =
  | { id: string; ok: true; metadata: ExtractedAssetMetadata }
  | { id: string; ok: false; error: string }

type WorkerRequest = PhotoWorkerRequest | MetadataWorkerRequest
type WorkerResponse = PhotoWorkerResponse | MetadataWorkerResponse

function isMetadataRequest(
  request: WorkerRequest,
): request is MetadataWorkerRequest {
  return 'kind' in request
}

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (
    message: WorkerResponse,
    options?: { transfer?: Transferable[] },
  ) => void
}

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (isMetadataRequest(request)) {
    const options: {
      mimeHint?: string
      includeGps?: boolean
    } = { includeGps: request.includeGps === true }
    if (request.mimeType !== undefined) {
      options.mimeHint = request.mimeType
    }
    void extractAssetMetadata(request.buffer, options)
      .then((metadata) => {
        workerScope.postMessage({ id: request.id, ok: true, metadata })
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Metadata extract failed'
        workerScope.postMessage({ id: request.id, ok: false, error: message })
      })
    return
  }
  void processPhotoRequest(request).then((response) => {
    if (response.ok) {
      workerScope.postMessage(response, { transfer: [response.previewBuffer] })
    } else {
      workerScope.postMessage(response)
    }
  })
}
