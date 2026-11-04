import {
  derivativeTransferList,
  encodeDerivatives,
  type DerivativeWorkerRequest,
  type DerivativeWorkerResponse,
} from './encode'

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<DerivativeWorkerRequest>) => void) | null
  postMessage: (
    message: DerivativeWorkerResponse,
    options?: { transfer?: Transferable[] },
  ) => void
}

workerScope.onmessage = (event: MessageEvent<DerivativeWorkerRequest>) => {
  void encodeDerivatives(event.data).then((response) => {
    workerScope.postMessage(response, {
      transfer: derivativeTransferList(response),
    })
  })
}
