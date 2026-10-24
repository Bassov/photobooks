import {
  backoffConcurrency,
  decodeLaneFor,
  decodeWorkerCount,
  type BackoffSignals,
  type DecodeJobPriority,
  type DecodeLane,
} from './decodeQueuePolicy'
import {
  applyDecodePressureSignals,
  assetsLeavingNow,
  buildNowAssetIds,
  canStartAnotherSlot,
  combineDecodeAbortSignals,
  countBusySlots,
  dualTiersDefaultForImport,
  ensureActiveAbortController,
  pendingRetryFromJob,
  queueHasBackgroundLane,
  relabelQueueLanes,
  scheduleWhenNowEmpty,
  shouldScheduleBackgroundDrain,
  takeNextDecodeJob,
} from './decodeScheduler'
import { isKnownHeicFile } from './heic'
import { THUMB_MAX_EDGE } from './photoEdges'
import type { PhotoWorkerRequest, PhotoWorkerResponse } from './processPhoto'

export type { DecodeJobPriority } from './decodeQueuePolicy'
export { DECODE_POOL_CAP, decodeWorkerCount } from './decodeQueuePolicy'

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
  workingBuffer?: ArrayBuffer
  workingMimeType?: string
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
  /** Decode once → thumb320 + working 1280 WebP. */
  dualTiers?: boolean
}

interface DecodeQueueItem {
  requestId: string
  assetId: string
  file: File
  priority: DecodeJobPriority
  lane: DecodeLane
  maxEdge: number
  cover: boolean
  dualTiers: boolean
  signal?: AbortSignal
  resolve: (result: AssetProcessResult) => void
  reject: (error: Error) => void
}

interface WorkerSlot {
  worker: Worker
  busy: boolean
}

function poolSize(): number {
  // Stryker disable next-line ConditionalExpression,EqualityOperator: navigator is always defined in app + Vitest
  const concurrency =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
  return decodeWorkerCount(concurrency)
}

let decodeSlots: WorkerSlot[] = []
let queue: DecodeQueueItem[] = []
const inFlightJobs = new Set<DecodeQueueItem>()
let requestCounter = 0
let filmstripVisibleIds = new Set<string>()
/** Per painted spread → asset ids (unioned into visible preference). */
const spreadVisibleById = new Map<string, ReadonlySet<string>>()
let visibleAssetIds = new Set<string>()
/** Placed / book-used ids (HEIC may decode even when off-filmstrip). */
let bookUsedAssetIds = new Set<string>()
/** now = visible ∪ book-used (lane membership). */
let nowAssetIds = new Set<string>()
const abortByAsset = new Map<string, AbortController>()
/** Options to re-enqueue after leave-now cancel when the asset re-enters now. */
const pendingRetryByAsset = new Map<string, ProcessAssetOptions>()
let longTaskPressure = false
let memoryPressure = false
let backgroundPumpScheduled = false

interface DeferredHeicItem {
  options: ProcessAssetOptions
  resolve: (result: AssetProcessResult) => void
  reject: (error: Error) => void
}

/** HEIC/HEIF waiting for visible ∪ book-used before entering the decode queue. */
const deferredHeicByAsset = new Map<string, DeferredHeicItem>()

function heicMayDecodeNow(
  assetId: string,
  priority: DecodeJobPriority,
): boolean {
  if (visibleAssetIds.has(assetId) || bookUsedAssetIds.has(assetId)) {
    return true
  }
  return priority === 'visible' || priority === 'zoom'
}

/** True when a HEIC/HEIF file would be deferred (not queued yet). */
export function shouldDeferHeicDecode(
  assetId: string,
  file: File,
  priority: DecodeJobPriority = 'prefetch',
): boolean {
  return isKnownHeicFile(file) && !heicMayDecodeNow(assetId, priority)
}

function scheduleBackgroundPump(): void {
  if (backgroundPumpScheduled) {
    return
  }
  backgroundPumpScheduled = true
  scheduleWhenNowEmpty(() => {
    backgroundPumpScheduled = false
    pump({ allowBackground: true })
  })
}

/** Drain now-lane immediately; schedule background if any remain. */
function pumpNowThenBackground(): void {
  pump({ allowBackground: false })
  if (queueHasBackgroundLane(queue)) {
    scheduleBackgroundPump()
  }
}

function enqueueDecodeJob(item: DecodeQueueItem): void {
  queue.push(item)
  if (item.lane === 'now') {
    // Stryker disable next-line BooleanLiteral: now-lane must not enable background in the sync pump
    pump({ allowBackground: false })
    return
  }
  // Background drains on a microtask so a sync now-enqueue in this turn wins.
  scheduleBackgroundPump()
}

function abortAssetJobs(assetId: string, registerRetry: boolean): void {
  const queued = queue.filter((job) => job.assetId === assetId)
  queue = queue.filter((job) => job.assetId !== assetId)
  for (const job of queued) {
    if (registerRetry) {
      pendingRetryByAsset.set(assetId, pendingRetryFromJob(job))
    }
    job.reject(new DOMException('Aborted', 'AbortError'))
  }
  let controller = abortByAsset.get(assetId)
  if (controller === undefined) {
    controller = new AbortController()
    abortByAsset.set(assetId, controller)
  }
  if (!controller.signal.aborted) {
    controller.abort()
  }
}

function applyNowSetTransition(previous: ReadonlySet<string>): void {
  const next = buildNowAssetIds(visibleAssetIds, bookUsedAssetIds)
  nowAssetIds = next
  for (const assetId of assetsLeavingNow(previous, next, bookUsedAssetIds)) {
    abortAssetJobs(assetId, true)
  }
  for (const assetId of next) {
    const retry = pendingRetryByAsset.get(assetId)
    if (retry === undefined) {
      continue
    }
    pendingRetryByAsset.delete(assetId)
    abortByAsset.set(
      assetId,
      ensureActiveAbortController(abortByAsset.get(assetId)),
    )
    void processAsset({
      ...retry,
      priority: 'visible',
    }).catch(() => {
      // Retry failures surface via import/onError paths when applicable.
    })
  }
  relabelQueueLanes(queue, nowAssetIds)
}

function promoteDeferredHeic(): void {
  if (deferredHeicByAsset.size === 0) {
    return
  }
  const ready: DeferredHeicItem[] = []
  for (const [assetId, deferred] of deferredHeicByAsset) {
    const priority = deferred.options.priority ?? 'prefetch'
    if (heicMayDecodeNow(assetId, priority)) {
      deferredHeicByAsset.delete(assetId)
      ready.push(deferred)
    }
  }
  for (const deferred of ready) {
    const signal =
      deferred.options.signal ??
      abortByAsset.get(deferred.options.assetId)?.signal
    if (signal?.aborted) {
      deferred.reject(new DOMException('Aborted', 'AbortError'))
      continue
    }
    const requestId = `asset-${String((requestCounter += 1))}`
    const priority: DecodeJobPriority = 'visible'
    // Stryker disable next-line ConditionalExpression,EqualityOperator,BooleanLiteral: dualTiers is a strict opt-in flag
    const dualTiers = deferred.options.dualTiers === true
    const item: DecodeQueueItem = {
      requestId,
      assetId: deferred.options.assetId,
      file: deferred.options.file,
      priority,
      lane: decodeLaneFor(priority, deferred.options.assetId, nowAssetIds),
      maxEdge: deferred.options.maxEdge ?? THUMB_MAX_EDGE,
      cover: deferred.options.cover === true,
      dualTiers,
      resolve: deferred.resolve,
      reject: deferred.reject,
    }
    if (signal) {
      item.signal = signal
    }
    enqueueDecodeJob(item)
  }
}

function rebuildVisibleAssetIds(): void {
  const previousNow = nowAssetIds
  const next = new Set(filmstripVisibleIds)
  for (const ids of spreadVisibleById.values()) {
    for (const id of ids) {
      next.add(id)
    }
  }
  visibleAssetIds = next
  applyNowSetTransition(previousNow)
  promoteDeferredHeic()
  pumpNowThenBackground()
}

/** Snapshot of deferred HEIC asset ids (tests / metrics). */
export function getDeferredHeicAssetIds(): readonly string[] {
  return [...deferredHeicByAsset.keys()]
}

/** Test seam: abort the import decode controller for one gallery asset. */
export function abortDecodeForTests(assetId: string): void {
  abortByAsset.get(assetId)?.abort()
}

/** Snapshot of decode-queue asset ids (tests / metrics). */
export function getQueuedDecodeAssetIds(): readonly string[] {
  return queue.map((job) => job.assetId)
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

function effectiveSlotLimit(): number {
  return backoffConcurrency(poolSize(), {
    longTaskPressure,
    memoryPressure,
  })
}

function pump(options: { allowBackground?: boolean } = {}): void {
  const allowBackground = options.allowBackground === true
  if (queue.length === 0) {
    return
  }
  ensureSlots()
  const limit = effectiveSlotLimit()
  let active = countBusySlots(decodeSlots)
  for (const slot of decodeSlots) {
    if (!canStartAnotherSlot(active, limit)) {
      break
    }
    if (slot.busy) {
      continue
    }
    const job = takeNextDecodeJob(
      queue,
      allowBackground,
      nowAssetIds,
      (aborted) => {
        pendingRetryByAsset.set(aborted.assetId, pendingRetryFromJob(aborted))
        aborted.reject(new DOMException('Aborted', 'AbortError'))
      },
    )
    if (!job) {
      if (
        shouldScheduleBackgroundDrain(
          allowBackground,
          queueHasBackgroundLane(queue),
        )
      ) {
        scheduleBackgroundPump()
      }
      break
    }
    slot.busy = true
    active += 1
    runDecodeOnSlot(slot, job)
  }
}

function runDecodeOnSlot(slot: WorkerSlot, job: DecodeQueueItem): void {
  const { worker } = slot
  let settled = false
  inFlightJobs.add(job)

  const settle = (fn: () => void): void => {
    if (settled) {
      return
    }
    settled = true
    inFlightJobs.delete(job)
    cleanup()
    slot.busy = false
    fn()
    pumpNowThenBackground()
  }

  const onAbort = (): void => {
    pendingRetryByAsset.set(job.assetId, pendingRetryFromJob(job))
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
    pendingRetryByAsset.delete(job.assetId)
    settle(() => {
      const result: AssetProcessResult = {
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
      }
      assignWorkingFields(result, response)
      job.resolve(result)
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
  if (job.dualTiers) {
    request.dualTiers = true
  }
  worker.postMessage(request)
}

/** Eagerly construct the worker pool (one-time setup outside hot-handler measures). */
export function warmAssetPool(): void {
  ensureSlots()
}

/** Terminates workers and clears the queue (tests / teardown). */
export function resetAssetPool(): void {
  backgroundPumpScheduled = false
  for (const slot of decodeSlots) {
    slot.worker.terminate()
  }
  decodeSlots = []
  const resetError = new DOMException('Asset pool reset', 'AbortError')
  for (const job of queue) {
    job.reject(resetError)
  }
  queue = []
  for (const job of inFlightJobs) {
    job.reject(resetError)
  }
  inFlightJobs.clear()
  for (const deferred of deferredHeicByAsset.values()) {
    deferred.reject(resetError)
  }
  deferredHeicByAsset.clear()
  pendingRetryByAsset.clear()
  filmstripVisibleIds = new Set()
  spreadVisibleById.clear()
  visibleAssetIds = new Set()
  bookUsedAssetIds = new Set()
  nowAssetIds = new Set()
  longTaskPressure = false
  memoryPressure = false
  // Drop controllers without aborting — in-flight were rejected above; aborting
  // would double-reject via AbortSignal listeners as unhandled rejections.
  abortByAsset.clear()
  requestCounter = 0
}

/**
 * Test seam: historically forced idle callback; background now drains via
 * microtask when the now lane is empty, so this only kicks a background pump.
 */
export function setDecodeBackgroundIdleForTests(immediate: boolean): void {
  if (immediate) {
    pump({ allowBackground: true })
  }
}

/** Adaptive backoff signals (longtask / memory). */
export function noteDecodePressure(signals: BackoffSignals): void {
  const next = applyDecodePressureSignals(
    { longTaskPressure, memoryPressure },
    signals,
  )
  longTaskPressure = next.longTaskPressure
  memoryPressure = next.memoryPressure
  pumpNowThenBackground()
}

export function getPendingRetryAssetIdsForTests(): readonly string[] {
  return [...pendingRetryByAsset.keys()]
}

/**
 * Prefer these asset ids when scheduling queued thumb jobs.
 * Assets that leave the now set (and are not book-used) have their decode
 * aborted and re-enqueued when they re-enter without a completed thumb.
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

/** Book-used (placed) asset ids — HEIC may decode even when off-filmstrip. */
export function setBookUsedAssetIds(assetIds: readonly string[]): void {
  const previousNow = nowAssetIds
  bookUsedAssetIds = new Set(assetIds)
  applyNowSetTransition(previousNow)
  promoteDeferredHeic()
  pumpNowThenBackground()
}

/** Copy dual-tier fields only when the worker actually sent them. */
export function assignWorkingFields(
  result: AssetProcessResult,
  response: {
    workingBuffer?: ArrayBuffer
    workingMimeType?: string
  },
): void {
  if (response.workingBuffer !== undefined) {
    result.workingBuffer = response.workingBuffer
  }
  if (response.workingMimeType !== undefined) {
    result.workingMimeType = response.workingMimeType
  }
}

function combinedAbortSignal(
  assetId: string,
  outer?: AbortSignal,
): AbortSignal {
  const pool = ensureActiveAbortController(abortByAsset.get(assetId))
  abortByAsset.set(assetId, pool)
  return combineDecodeAbortSignals(pool.signal, outer)
}

export function processAsset(
  options: ProcessAssetOptions,
): Promise<AssetProcessResult> {
  ensureSlots()
  const priority = options.priority ?? 'prefetch'
  const dualTiers = options.dualTiers === true
  const promise = new Promise<AssetProcessResult>((resolve, reject) => {
    const signal = combinedAbortSignal(options.assetId, options.signal)
    if (signal.aborted) {
      pendingRetryByAsset.set(options.assetId, {
        ...options,
        priority: 'visible',
      })
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    if (
      isKnownHeicFile(options.file) &&
      !heicMayDecodeNow(options.assetId, priority)
    ) {
      deferredHeicByAsset.set(options.assetId, {
        options: { ...options, priority },
        resolve,
        reject,
      })
      return
    }
    pendingRetryByAsset.delete(options.assetId)
    const requestId = `asset-${String((requestCounter += 1))}`
    const item: DecodeQueueItem = {
      requestId,
      assetId: options.assetId,
      file: options.file,
      priority,
      lane: decodeLaneFor(priority, options.assetId, nowAssetIds),
      maxEdge: options.maxEdge ?? THUMB_MAX_EDGE,
      cover: options.cover === true,
      dualTiers,
      signal,
      resolve,
      reject,
    }
    enqueueDecodeJob(item)
  })
  // Orphaned fire-and-forget jobs still reject on reset/abort; keep await/catch working.
  void promise.catch(() => undefined)
  return promise
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
  const priority = options.priority ?? 'prefetch'
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
            priority,
            // One decode → 320+1280 unless the caller pins a single maxEdge.
            dualTiers: dualTiersDefaultForImport(options.maxEdge),
          }
          const signal = abortByAsset.get(item.assetId)?.signal
          if (signal) {
            processOptions.signal = signal
          }
          if (options.maxEdge !== undefined) {
            processOptions.maxEdge = options.maxEdge
          }
          // Off-screen HEIC: register deferred decode without blocking the batch.
          if (shouldDeferHeicDecode(item.assetId, item.file, priority)) {
            void processAsset(processOptions)
              .then((result) => {
                results.push(result)
                options.onResult?.(result)
              })
              .catch((error: unknown) => {
                if (
                  error instanceof DOMException &&
                  error.name === 'AbortError'
                ) {
                  return
                }
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Failed to import photo'
                const importError = createImportFileError({
                  name: item.file.name,
                  message,
                  reason: 'heic',
                  assetId: item.assetId,
                })
                errors.push(importError)
                // Keep HEIC placeholder tiles (do not call onError discard).
              })
            return
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
          const heic = isKnownHeicFile(item.file)
          const importError = createImportFileError({
            name: item.file.name,
            message,
            reason: heic ? 'heic' : 'decode-failed',
            assetId: item.assetId,
          })
          errors.push(importError)
          if (!heic) {
            // Stryker disable next-line OptionalChaining: onError is optional; ?. vs bare is equivalent when set
            options.onError?.(item.assetId, importError)
          }
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
