import {
  processBookLoadRequest,
  type BookLoadRequest,
  type BookLoadResponse,
} from './bookLoad'

export type { BookLoadRequest, BookLoadResponse }

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<BookLoadRequest>) => void) | null
  postMessage: (message: BookLoadResponse) => void
}

workerScope.onmessage = (event: MessageEvent<BookLoadRequest>) => {
  workerScope.postMessage(processBookLoadRequest(event.data))
}
