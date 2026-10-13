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

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<PhotoWorkerRequest>) => void) | null
  postMessage: (
    message: PhotoWorkerResponse,
    options?: { transfer?: Transferable[] },
  ) => void
}

workerScope.onmessage = (event: MessageEvent<PhotoWorkerRequest>) => {
  void processPhotoRequest(event.data).then((response) => {
    if (response.ok) {
      workerScope.postMessage(response, { transfer: [response.previewBuffer] })
    } else {
      workerScope.postMessage(response)
    }
  })
}
