import { computeSha256Hex } from './hashDigest'

export interface HashWorkerRequest {
  id: string
  buffer: ArrayBuffer
}

export type HashWorkerResponse =
  | { id: string; ok: true; hash: string }
  | { id: string; ok: false; error: string }

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<HashWorkerRequest>) => void) | null
  postMessage: (message: HashWorkerResponse) => void
}

workerScope.onmessage = (event: MessageEvent<HashWorkerRequest>) => {
  const { id, buffer } = event.data
  void computeSha256Hex(buffer)
    .then((hash) => {
      workerScope.postMessage({ id, ok: true, hash })
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Hash worker failed'
      workerScope.postMessage({ id, ok: false, error: message })
    })
}
