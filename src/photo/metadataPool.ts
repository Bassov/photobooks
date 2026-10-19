import type { ExtractedAssetMetadata } from '../assets/extractAssetMetadata'
import {
  beginMetadataJob,
  endMetadataJob,
  hasPendingMetadataJobs,
} from './poolCoordination'

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

interface MetadataQueueItem {
  requestId: string
  buffer: ArrayBuffer
  mimeType?: string
  includeGps?: boolean
  resolve: (metadata: ExtractedAssetMetadata) => void
  reject: (error: Error) => void
}

interface WorkerSlot {
  worker: Worker
  busy: boolean
}

let slots: WorkerSlot[] = []
let queue: MetadataQueueItem[] = []
let inFlight: MetadataQueueItem[] = []
let requestCounter = 0

/** Pure pool sizing for tests / mutation; defaults when concurrency missing or ≤0. */
export function metadataWorkerCount(
  hardwareConcurrency: number | undefined,
): number {
  const cores =
    hardwareConcurrency !== undefined && hardwareConcurrency > 0
      ? hardwareConcurrency
      : 2
  return Math.max(1, cores - 1)
}

function ensureSlots(): void {
  if (slots.length > 0) {
    return
  }
  const concurrency =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
  const size = metadataWorkerCount(concurrency)
  for (let i = 0; i < size; i += 1) {
    slots.push({
      worker: new Worker(new URL('./photo.worker.ts', import.meta.url), {
        type: 'module',
      }),
      busy: false,
    })
  }
}

function pump(): void {
  if (queue.length === 0) {
    return
  }
  ensureSlots()
  for (const slot of slots) {
    if (slot.busy) {
      continue
    }
    const job = queue.shift()
    if (!job) {
      break
    }
    slot.busy = true
    runOnSlot(slot, job)
  }
}

function runOnSlot(slot: WorkerSlot, job: MetadataQueueItem): void {
  const { worker } = slot
  let settled = false
  inFlight.push(job)

  const settle = (fn: () => void): void => {
    if (settled) {
      return
    }
    settled = true
    inFlight = inFlight.filter((item) => item !== job)
    cleanup()
    slot.busy = false
    endMetadataJob()
    fn()
    pump()
  }

  const onMessage = (event: MessageEvent<MetadataWorkerResponse>) => {
    if (event.data.id !== job.requestId) {
      return
    }
    const response = event.data
    if (!response.ok) {
      settle(() => {
        job.reject(new Error(response.error))
      })
      return
    }
    settle(() => {
      job.resolve(response.metadata)
    })
  }

  const onError = (event: ErrorEvent) => {
    settle(() => {
      job.reject(new Error(event.message || 'Metadata worker failed'))
    })
  }

  const cleanup = (): void => {
    worker.removeEventListener('message', onMessage)
    worker.removeEventListener('error', onError)
  }

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)

  const request: MetadataWorkerRequest = {
    id: job.requestId,
    kind: 'metadata',
    buffer: job.buffer,
    includeGps: job.includeGps === true,
  }
  if (job.mimeType !== undefined) {
    request.mimeType = job.mimeType
  }
  worker.postMessage(request, [job.buffer])
}

/** Enqueue EXIF metadata extraction at background priority (above hash). */
export function enqueueMetadata(options: {
  buffer: ArrayBuffer
  mimeType?: string
  includeGps?: boolean
}): Promise<ExtractedAssetMetadata> {
  ensureSlots()
  const requestId = `meta-${String((requestCounter += 1))}`
  return new Promise((resolve, reject) => {
    beginMetadataJob()
    const item: MetadataQueueItem = {
      requestId,
      buffer: options.buffer,
      includeGps: options.includeGps === true,
      resolve,
      reject,
    }
    if (options.mimeType !== undefined) {
      item.mimeType = options.mimeType
    }
    queue.push(item)
    pump()
  })
}

export function resetMetadataPool(): void {
  for (const slot of slots) {
    slot.worker.terminate()
  }
  slots = []
  const pending = [...inFlight, ...queue]
  inFlight = []
  queue = []
  for (const job of pending) {
    endMetadataJob()
    job.reject(new Error('Metadata pool reset'))
  }
  requestCounter = 0
}

export { hasPendingMetadataJobs }
