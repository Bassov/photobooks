import type { PhotoWorkerRequest, PhotoWorkerResponse } from './processPhoto'
import { THUMB_MAX_EDGE } from './processPhoto'
import { metadataWorkerCount } from './metadataPool'

export type DecodeJobPriority = 'visible' | 'zoom' | 'prefetch' | 'background'

const PRIORITY_RANK: Record<DecodeJobPriority, number> = {
  visible: 4,
  zoom: 3,
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

export type ImportErrorReason = 'unsupported-type' | 'heic' | 'decode-failed'

export interface ImportFileError {
  id: string
  name: string
  message: string
  reason: ImportErrorReason
  assetId?: string
}

export function createImportFileError(input: {
  name: string
  message: string
  reason: ImportErrorReason
  assetId?: string
}): ImportFileError {
  const id = crypto.randomUUID()
  if (input.assetId === undefined) {
    return {
      id,
      name: input.name,
      message: input.message,
      reason: input.reason,
    }
  }
  return {
    id,
    name: input.name,
    message: input.message,
    reason: input.reason,
    assetId: input.assetId,
  }
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

interface WorkerSlot {
  worker: Worker
  busy: boolean
}

/** Cap concurrent decode workers so large imports do not explode memory. */
export const DECODE_POOL_CAP = 4

/** Pure pool sizing for tests / mutation; caps metadataWorkerCount. */
export function decodeWorkerCount(
  hardwareConcurrency: number | undefined,
): number {
  return Math.min(DECODE_POOL_CAP, metadataWorkerCount(hardwareConcurrency))
}

function poolSize(): number {
  // Stryker disable next-line ConditionalExpression,EqualityOperator: navigator is always defined in app + Vitest
  const concurrency =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
  return decodeWorkerCount(concurrency)
}

let decodeSlots: WorkerSlot[] = []
let queue: DecodeQueueItem[] = []
let requestCounter = 0
let filmstripVisibleIds = new Set<string>()
/** Per painted spread → asset ids (unioned into visible preference). */
const spreadVisibleById = new Map<string, ReadonlySet<string>>()
let visibleAssetIds = new Set<string>()
const abortByAsset = new Map<string, AbortController>()

function rebuildVisibleAssetIds(): void {
  const next = new Set(filmstripVisibleIds)
  for (const ids of spreadVisibleById.values()) {
    for (const id of ids) {
      next.add(id)
    }
  }
  visibleAssetIds = next
  pump()
}

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
}

function jobRank(job: DecodeQueueItem): number {
  const boost = visibleAssetIds.has(job.assetId) ? 10 : 0
  return PRIORITY_RANK[job.priority] + boost
}

function sortQueue(): void {
  queue.sort((a, b) => jobRank(b) - jobRank(a))
}

function takeNextDecodeJob(): DecodeQueueItem | undefined {
  sortQueue()
  const job = queue.shift()
  if (job === undefined) {
    return undefined
  }
  if (job.signal?.aborted) {
    job.reject(new DOMException('Aborted', 'AbortError'))
    return takeNextDecodeJob()
  }
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
  for (const job of queue) {
    job.reject(new Error('Asset pool reset'))
  }
  queue = []
  filmstripVisibleIds = new Set()
  spreadVisibleById.clear()
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
 *
 * Test helper: replaces the filmstrip window and clears spread-visible ids.
 */
export function setVisibleAssetIds(assetIds: readonly string[]): void {
  filmstripVisibleIds = new Set(assetIds)
  spreadVisibleById.clear()
  rebuildVisibleAssetIds()
}

/** Mounted filmstrip window ids (unioned with painted-spread assets). */
export function setFilmstripVisibleAssetIds(assetIds: readonly string[]): void {
  filmstripVisibleIds = new Set(assetIds)
  rebuildVisibleAssetIds()
}

/** Snapshot of the preferred visible asset set (filmstrip ∪ painted spreads). */
export function getVisibleAssetIds(): readonly string[] {
  return [...visibleAssetIds]
}

/** Painted-spread asset ids for one spread (unioned across spreads + filmstrip). */
export function setSpreadVisibleAssetIds(
  spreadId: string,
  assetIds: readonly string[],
): void {
  spreadVisibleById.delete(spreadId)
  // Stryker disable next-line ConditionalExpression,EqualityOperator: after delete, empty set vs skip is equivalent for rebuild
  if (assetIds.length > 0) {
    spreadVisibleById.set(spreadId, new Set(assetIds))
  }
  rebuildVisibleAssetIds()
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
    onError?: (assetId: string, error: ImportFileError) => void
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
          const importError = createImportFileError({
            name: item.file.name,
            message,
            reason: 'decode-failed',
            assetId: item.assetId,
          })
          errors.push(importError)
          // Stryker disable next-line OptionalChaining: onError is optional; ?. vs bare is equivalent when set
          options.onError?.(item.assetId, importError)
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
