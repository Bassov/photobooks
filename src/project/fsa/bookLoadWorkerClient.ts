import {
  processBookLoadRequest,
  type BookLoadRequest,
  type BookLoadResponse,
} from './bookLoad'

export interface BookLoadWorker {
  loadBookText: (text: string) => Promise<BookLoadResponse>
  terminate: () => void
}

let requestCounter = 0

export function createBookLoadWorker(
  workerFactory: () => Worker = defaultWorkerFactory,
): BookLoadWorker {
  const worker = workerFactory()
  const pending = new Map<
    string,
    {
      resolve: (value: BookLoadResponse) => void
      reject: (reason: Error) => void
    }
  >()

  const onMessage = (event: MessageEvent<BookLoadResponse>) => {
    const response = event.data
    const entry = pending.get(response.id)
    if (entry === undefined) {
      return
    }
    pending.delete(response.id)
    entry.resolve(response)
  }
  const onError = (event: ErrorEvent) => {
    const error = new Error(event.message || 'Book load worker failed')
    for (const entry of pending.values()) {
      entry.reject(error)
    }
    pending.clear()
  }

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)

  return {
    loadBookText(text: string) {
      requestCounter += 1
      const id = `book-load-${String(requestCounter)}`
      const request: BookLoadRequest = { id, text }
      return new Promise<BookLoadResponse>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        worker.postMessage(request)
      })
    },
    terminate() {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate()
      pending.clear()
    },
  }
}

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./bookLoad.worker.ts', import.meta.url), {
    type: 'module',
  })
}

/** Default production loader: one long-lived worker. */
let sharedWorker: BookLoadWorker | undefined
let sharedWorkerFactory: (() => Worker) | undefined

export function loadBookTextViaWorker(
  text: string,
  workerFactory: () => Worker = defaultWorkerFactory,
): Promise<BookLoadResponse> {
  if (sharedWorker === undefined || sharedWorkerFactory !== workerFactory) {
    sharedWorker?.terminate()
    sharedWorker = createBookLoadWorker(workerFactory)
    sharedWorkerFactory = workerFactory
  }
  return sharedWorker.loadBookText(text)
}

/** Sync mapping used by tests and injectable adapters without spawning a Worker. */
export function loadBookTextSync(text: string): Promise<BookLoadResponse> {
  requestCounter += 1
  return Promise.resolve(
    processBookLoadRequest({ id: `sync-${String(requestCounter)}`, text }),
  )
}
