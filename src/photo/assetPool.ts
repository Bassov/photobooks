import type { PhotoWorkerRequest, PhotoWorkerResponse } from './processPhoto'
import { THUMB_MAX_EDGE } from './processPhoto'

export type AssetJobPriority = 'visible' | 'prefetch' | 'background'

const PRIORITY_RANK: Record<AssetJobPriority, number> = {
  visible: 3,
  prefetch: 2,
  background: 1,
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
  priority?: AssetJobPriority
  signal?: AbortSignal
  maxEdge?: number
}

interface QueueItem {
  requestId: string
  assetId: string
  file: File
  priority: AssetJobPriority
  maxEdge: number
  signal?: AbortSignal
  resolve: (result: AssetProcessResult) => void
  reject: (error: Error) => void
}

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

let slots: WorkerSlot[] = []
let queue: QueueItem[] = []
let requestCounter = 0
let visibleAssetIds = new Set<string>()
const abortByAsset = new Map<string, AbortController>()

function ensureSlots(): void {
  if (slots.length > 0) {
    return
  }
  const size = poolSize()
  for (let i = 0; i < size; i += 1) {
    slots.push({
      worker: new Worker(new URL('./photo.worker.ts', import.meta.url), {
        type: 'module',
      }),
      busy: false,
    })
  }
}

function sortQueue(): void {
  queue.sort((a, b) => {
    const aBoost = visibleAssetIds.has(a.assetId) ? 10 : 0
    const bBoost = visibleAssetIds.has(b.assetId) ? 10 : 0
    const aRank = PRIORITY_RANK[a.priority] + aBoost
    const bRank = PRIORITY_RANK[b.priority] + bBoost
    return bRank - aRank
  })
}

function takeNextJob(): QueueItem | undefined {
  sortQueue()
  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) {
      return undefined
    }
    if (next.signal?.aborted) {
      next.reject(new DOMException('Aborted', 'AbortError'))
      continue
    }
    return next
  }
  return undefined
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
    const job = takeNextJob()
    if (!job) {
      return
    }
    slot.busy = true
    runOnSlot(slot, job)
  }
}

function runOnSlot(slot: WorkerSlot, job: QueueItem): void {
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
  worker.postMessage(request)
}

/** Eagerly construct the worker pool (one-time setup outside hot-handler measures). */
export function warmAssetPool(): void {
  ensureSlots()
}

/** Terminates workers and clears the queue (tests / teardown). */
export function resetAssetPool(): void {
  for (const slot of slots) {
    slot.worker.terminate()
  }
  slots = []
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

/** Prefer these asset ids when scheduling queued thumb jobs; abort scrolled-away work. */
export function setVisibleAssetIds(assetIds: readonly string[]): void {
  visibleAssetIds = new Set(assetIds)
  for (const id of assetIds) {
    if (!abortByAsset.has(id)) {
      abortByAsset.set(id, new AbortController())
    }
  }
  for (const [id, controller] of abortByAsset) {
    if (!visibleAssetIds.has(id)) {
      controller.abort()
      abortByAsset.delete(id)
    }
  }
  queue = queue.filter((job) => {
    if (job.signal?.aborted) {
      job.reject(new DOMException('Aborted', 'AbortError'))
      return false
    }
    return true
  })
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
    const item: QueueItem = {
      requestId,
      assetId: options.assetId,
      file: options.file,
      priority: options.priority ?? 'prefetch',
      maxEdge: options.maxEdge ?? THUMB_MAX_EDGE,
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
    priority?: AssetJobPriority
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
