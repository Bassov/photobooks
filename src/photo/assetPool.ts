import type { PhotoWorkerRequest, PhotoWorkerResponse } from './processPhoto'
import { THUMB_MAX_EDGE } from './processPhoto'

interface HashWorkerRequest {
  id: string
  buffer: ArrayBuffer
}

type HashWorkerResponse =
  | { id: string; ok: true; hash: string }
  | { id: string; ok: false; error: string }

export type DecodeJobPriority = 'visible' | 'zoom' | 'prefetch' | 'background'

type AssetJobPriority = DecodeJobPriority | 'hash'

const PRIORITY_RANK: Record<AssetJobPriority, number> = {
  visible: 4,
  zoom: 3,
  prefetch: 2,
  background: 1,
  hash: 0,
}

export interface AssetProcessResult {
  assetId: string
  name: string
  mimeType: string
  byteLength: number
  width: number
  height: number
  correctedWidth: number
  correctedHeight: number
  orientation: number
  previewBuffer: ArrayBuffer
  previewMimeType: string
}

export interface ImportFileError {
  name: string
  message: string
}

export interface ImportBatchState {
  total: number
  completed: number
  errors: readonly ImportFileError[]
  running: boolean
}

export interface ProcessAssetOptions {
  assetId: string
  file: File
  priority?: DecodeJobPriority
  signal?: AbortSignal
  maxEdge?: number
  cover?: boolean
}

interface DecodeQueueItem {
  kind: 'decode'
  requestId: string
  assetId: string
  file: File
  priority: DecodeJobPriority
  maxEdge: number
  cover: boolean
  signal?: AbortSignal
  resolve: (result: AssetProcessResult) => void
  reject: (error: Error) => void
}

interface HashQueueItem {
  kind: 'hash'
  requestId: string
  buffer: ArrayBuffer
  priority: 'hash'
  resolve: (hash: string) => void
  reject: (error: Error) => void
}

type QueueItem = DecodeQueueItem | HashQueueItem

interface WorkerSlot {
  worker: Worker
  busy: boolean
}

function poolSize(): number {
  const cores =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 2
  return Math.max(1, cores - 1)
}

let decodeSlots: WorkerSlot[] = []
let hashSlots: WorkerSlot[] = []
let queue: QueueItem[] = []
let requestCounter = 0
let visibleAssetIds = new Set<string>()
const abortByAsset = new Map<string, AbortController>()

function ensureSlots(): void {
  if (decodeSlots.length === 0) {
    const size = poolSize()
    for (let i = 0; i < size; i += 1) {
      decodeSlots.push({
        worker: new Worker(new URL('./photo.worker.ts', import.meta.url), {
          type: 'module',
        }),
        busy: false,
      })
    }
  }
  if (hashSlots.length === 0) {
    hashSlots.push({
      worker: new Worker(new URL('../assets/hash.worker.ts', import.meta.url), {
        type: 'module',
      }),
      busy: false,
    })
  }
}

function jobRank(job: QueueItem): number {
  if (job.kind === 'hash') {
    return PRIORITY_RANK.hash
  }
  const boost = visibleAssetIds.has(job.assetId) ? 10 : 0
  return PRIORITY_RANK[job.priority] + boost
}

function sortQueue(): void {
  queue.sort((a, b) => jobRank(b) - jobRank(a))
}

function takeNextDecodeJob(): DecodeQueueItem | undefined {
  sortQueue()
  const index = queue.findIndex((job) => job.kind === 'decode')
  if (index < 0) {
    return undefined
  }
  const job = queue[index]
  if (job?.kind !== 'decode') {
    return undefined
  }
  queue.splice(index, 1)
  if (job.signal?.aborted) {
    job.reject(new DOMException('Aborted', 'AbortError'))
    return takeNextDecodeJob()
  }
  return job
}

function takeNextHashJob(): HashQueueItem | undefined {
  sortQueue()
  if (queue.some((job) => job.kind === 'decode')) {
    return undefined
  }
  const index = queue.findIndex((job) => job.kind === 'hash')
  if (index < 0) {
    return undefined
  }
  const job = queue[index]
  if (job?.kind !== 'hash') {
    return undefined
  }
  queue.splice(index, 1)
  return job
}

function pump(): void {
  if (queue.length === 0) {
    return
  }
  ensureSlots()
  for (const slot of decodeSlots) {
    if (slot.busy) {
      continue
    }
    const job = takeNextDecodeJob()
    if (!job) {
      break
    }
    slot.busy = true
    runDecodeOnSlot(slot, job)
  }
  for (const slot of hashSlots) {
    if (slot.busy) {
      continue
    }
    const job = takeNextHashJob()
    if (!job) {
      break
    }
    slot.busy = true
    runHashOnSlot(slot, job)
  }
}

function runDecodeOnSlot(slot: WorkerSlot, job: DecodeQueueItem): void {
  const { worker } = slot
  let settled = false

  const settle = (fn: () => void): void => {
    if (settled) {
      return
    }
    settled = true
    cleanup()
    slot.busy = false
    fn()
    pump()
  }

  const onAbort = (): void => {
    settle(() => {
      job.reject(new DOMException('Aborted', 'AbortError'))
    })
  }
  job.signal?.addEventListener('abort', onAbort, { once: true })

  const onMessage = (event: MessageEvent<PhotoWorkerResponse>) => {
    if (event.data.id !== job.requestId) {
      return
    }
    if (job.signal?.aborted) {
      settle(() => {
        job.reject(new DOMException('Aborted', 'AbortError'))
      })
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
      job.resolve({
        assetId: job.assetId,
        name: response.name,
        mimeType: response.mimeType,
        byteLength: response.byteLength,
        width: response.width,
        height: response.height,
        correctedWidth: response.correctedWidth,
        correctedHeight: response.correctedHeight,
        orientation: response.orientation,
        previewBuffer: response.previewBuffer,
        previewMimeType: response.previewMimeType,
      })
    })
  }

  const onError = (event: ErrorEvent) => {
    settle(() => {
      job.reject(new Error(event.message || 'Photo worker failed'))
    })
  }

  const cleanup = (): void => {
    worker.removeEventListener('message', onMessage)
    worker.removeEventListener('error', onError)
    job.signal?.removeEventListener('abort', onAbort)
  }

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)

  const request: PhotoWorkerRequest = {
    id: job.requestId,
    file: job.file,
    maxEdge: job.maxEdge,
  }
  if (job.cover) {
    request.cover = true
  }
  worker.postMessage(request)
}

function runHashOnSlot(slot: WorkerSlot, job: HashQueueItem): void {
  const { worker } = slot
  let settled = false

  const settle = (fn: () => void): void => {
    if (settled) {
      return
    }
    settled = true
    cleanup()
    slot.busy = false
    fn()
    pump()
  }

  const onMessage = (event: MessageEvent<HashWorkerResponse>) => {
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
      job.resolve(response.hash)
    })
  }

  const onError = (event: ErrorEvent) => {
    settle(() => {
      job.reject(new Error(event.message || 'Hash worker failed'))
    })
  }

  const cleanup = (): void => {
    worker.removeEventListener('message', onMessage)
    worker.removeEventListener('error', onError)
  }

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)

  const request: HashWorkerRequest = {
    id: job.requestId,
    buffer: job.buffer,
  }
  worker.postMessage(request, [job.buffer])
}

/** Eagerly construct the worker pool (one-time setup outside hot-handler measures). */
export function warmAssetPool(): void {
  ensureSlots()
}

/** Terminates workers and clears the queue (tests / teardown). */
export function resetAssetPool(): void {
  for (const slot of decodeSlots) {
    slot.worker.terminate()
  }
  decodeSlots = []
  for (const slot of hashSlots) {
    slot.worker.terminate()
  }
  hashSlots = []
  for (const job of queue) {
    job.reject(new Error('Asset pool reset'))
  }
  queue = []
  visibleAssetIds = new Set()
  for (const controller of abortByAsset.values()) {
    controller.abort()
  }
  abortByAsset.clear()
  requestCounter = 0
}

/**
 * Prefer these asset ids when scheduling queued thumb jobs.
 * Does not abort off-screen work — import batches must finish for every gallery
 * id (Filmstrip reveal / windowing would otherwise leave permanent gray placeholders).
 */
export function setVisibleAssetIds(assetIds: readonly string[]): void {
  visibleAssetIds = new Set(assetIds)
  pump()
}

export function processAsset(
  options: ProcessAssetOptions,
): Promise<AssetProcessResult> {
  ensureSlots()
  const requestId = `asset-${String((requestCounter += 1))}`
  return new Promise((resolve, reject) => {
    const signal = options.signal ?? abortByAsset.get(options.assetId)?.signal
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const item: DecodeQueueItem = {
      kind: 'decode',
      requestId,
      assetId: options.assetId,
      file: options.file,
      priority: options.priority ?? 'prefetch',
      maxEdge: options.maxEdge ?? THUMB_MAX_EDGE,
      cover: options.cover === true,
      resolve,
      reject,
    }
    if (signal) {
      item.signal = signal
    }
    queue.push(item)
    pump()
  })
}

/** Enqueue SHA-256 hashing at the lowest pool priority. */
export function enqueueHash(buffer: ArrayBuffer): Promise<string> {
  ensureSlots()
  const requestId = `hash-${String((requestCounter += 1))}`
  return new Promise((resolve, reject) => {
    queue.push({
      kind: 'hash',
      requestId,
      buffer,
      priority: 'hash',
      resolve,
      reject,
    })
    pump()
  })
}

export type ImportBatchListener = (state: ImportBatchState) => void

/**
 * Process many files with shared progress. Per-file failures do not abort the batch.
 * Caller filters MIME before enqueue when rejecting unsupported types as errors.
 */
export async function runImportBatch(
  items: readonly { assetId: string; file: File }[],
  options: {
    onProgress?: ImportBatchListener
    onResult?: (result: AssetProcessResult) => void
    priority?: DecodeJobPriority
    maxEdge?: number
  } = {},
): Promise<{
  results: AssetProcessResult[]
  errors: ImportFileError[]
}> {
  const total = items.length
  const errors: ImportFileError[] = []
  const results: AssetProcessResult[] = []
  let completed = 0

  const emit = (running: boolean): void => {
    options.onProgress?.({
      total,
      completed,
      errors: [...errors],
      running,
    })
  }

  emit(true)

  const START_CHUNK = 16
  for (let offset = 0; offset < items.length; offset += START_CHUNK) {
    const slice = items.slice(offset, offset + START_CHUNK)
    await Promise.all(
      slice.map(async (item) => {
        try {
          if (!abortByAsset.has(item.assetId)) {
            abortByAsset.set(item.assetId, new AbortController())
          }
          const processOptions: ProcessAssetOptions = {
            assetId: item.assetId,
            file: item.file,
            priority: options.priority ?? 'prefetch',
          }
          const signal = abortByAsset.get(item.assetId)?.signal
          if (signal) {
            processOptions.signal = signal
          }
          if (options.maxEdge !== undefined) {
            processOptions.maxEdge = options.maxEdge
          }
          const result = await processAsset(processOptions)
          results.push(result)
          options.onResult?.(result)
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
          const message =
            error instanceof Error ? error.message : 'Failed to import photo'
          errors.push({ name: item.file.name, message })
        } finally {
          completed += 1
          emit(true)
        }
      }),
    )
    // Yield between chunks so React/paint can run under CPU throttle.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  }

  emit(false)
  return { results, errors }
}
