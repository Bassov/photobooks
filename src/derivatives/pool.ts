import { getDerivedCache } from '../assets/derivedCache/instance'
import type { DerivedCacheEntry } from '../assets/derivedCache/types'
import { getQueuedDecodeAssetIds } from '../photo/assetPool'
import { isDecodeScrollQuiet } from '../photo/decodeScrollQuiet'
import { hasPendingMetadataJobs } from '../photo/poolCoordination'
import { createDerivativeWorker } from './createDerivativeWorker'
import type { DerivativeWorkerResponse } from './encode'
import {
  canStartDerivative,
  DERIVATIVE_PRESETS,
  planDerivativeJobs,
  presetCacheId,
  type DerivativePreset,
  type DerivativeRequest,
} from './plan'

/** While the gate is closed and nothing runs, look again after this long. */
export const DERIVATIVE_GATE_RETRY_MS = 250

export interface DerivativeSourceRequest extends DerivativeRequest {
  /** Original file body; read only when a preset misses the cache. */
  readSource: () => Promise<Blob>
}

export interface DerivativeResult {
  assetHash: string
  presetId: string
  cacheId: string
  cacheHit: boolean
  /** Cache check on a hit; resize + encode + hash on a miss. */
  ms: number
  /** Source decode for the job that encoded this output. */
  decodeMs?: number
  outputHash?: string
  byteLength?: number
  width?: number
  height?: number
  error?: string
}

interface PendingJob {
  assetHash: string
  presets: DerivativePreset[]
  readSource: () => Promise<Blob>
  resolve: (results: DerivativeResult[]) => void
}

const queue: PendingJob[] = []
const inflight = new Map<string, (response: DerivativeWorkerResponse) => void>()
let worker: Worker | undefined
let activeJobs = 0
let nextRequestId = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined

function gateOpen(): boolean {
  return canStartDerivative({
    queuedDecodeJobs: getQueuedDecodeAssetIds().length,
    metadataBusy: hasPendingMetadataJobs(),
    scrollQuiet: isDecodeScrollQuiet(),
    activeDerivativeJobs: activeJobs,
  })
}

function failAllInflight(error: string): void {
  const waiters = [...inflight]
  inflight.clear()
  for (const [id, resolve] of waiters) {
    resolve({ id, ok: false, error })
  }
}

function ensureWorker(): Worker {
  if (worker !== undefined) {
    return worker
  }
  const created = createDerivativeWorker()
  created.addEventListener(
    'message',
    (event: MessageEvent<DerivativeWorkerResponse>) => {
      const resolve = inflight.get(event.data.id)
      inflight.delete(event.data.id)
      resolve?.(event.data)
    },
  )
  created.addEventListener('error', () => {
    created.terminate()
    worker = undefined
    failAllInflight('Derivative worker crashed')
  })
  worker = created
  return created
}

function postToWorker(
  source: Blob,
  presetIds: string[],
): Promise<DerivativeWorkerResponse> {
  const target = ensureWorker()
  nextRequestId += 1
  const id = `drv-${String(nextRequestId)}`
  return new Promise((resolve) => {
    inflight.set(id, resolve)
    target.postMessage({ id, source, presetIds })
  })
}

function failedResults(job: PendingJob, error: string): DerivativeResult[] {
  return job.presets.map((preset) => ({
    assetHash: job.assetHash,
    presetId: preset.id,
    cacheId: presetCacheId(preset),
    cacheHit: false,
    ms: 0,
    error,
  }))
}

async function encodeJob(job: PendingJob): Promise<DerivativeResult[]> {
  let source: Blob
  try {
    source = await job.readSource()
  } catch {
    return failedResults(job, 'Derivative source unreadable')
  }
  const response = await postToWorker(
    source,
    job.presets.map((preset) => preset.id),
  )
  if (!response.ok) {
    return failedResults(job, response.error)
  }
  const cache = await getDerivedCache()
  const results: DerivativeResult[] = []
  for (const output of response.outputs) {
    const byteLength = output.bytes.byteLength
    const put = await cache.put(job.assetHash, output.cacheId, {
      bytes: output.bytes,
      mimeType: output.mimeType,
    })
    const result: DerivativeResult = {
      assetHash: job.assetHash,
      presetId: output.presetId,
      cacheId: output.cacheId,
      cacheHit: false,
      ms: output.ms,
      decodeMs: response.decodeMs,
      outputHash: output.outputHash,
      byteLength,
      width: output.width,
      height: output.height,
    }
    if (!put.ok) {
      result.error = `Derivative cache put failed: ${put.code}`
    }
    results.push(result)
  }
  return results
}

function scheduleRetry(): void {
  retryTimer ??= setTimeout(() => {
    retryTimer = undefined
    pump()
  }, DERIVATIVE_GATE_RETRY_MS)
}

function pump(): void {
  const job = queue[0]
  if (job === undefined) {
    return
  }
  if (!gateOpen()) {
    // A running job pumps again when it settles.
    if (activeJobs === 0) {
      scheduleRetry()
    }
    return
  }
  queue.shift()
  activeJobs += 1
  void encodeJob(job)
    .catch(() => failedResults(job, 'Derivative encode failed'))
    .then((results) => {
      activeJobs -= 1
      job.resolve(results)
      pump()
    })
  pump()
}

/**
 * Derivatives for `requests` (lowest priority, after thumbs and editor
 * tiers). Cached presets resolve at once; misses queue in request order and
 * encode in the derivative worker. One result per (asset, preset).
 */
export async function requestDerivatives(
  requests: readonly DerivativeSourceRequest[],
): Promise<DerivativeResult[]> {
  const jobs = planDerivativeJobs(requests)
  const cache = await getDerivedCache()
  const perJob = jobs.map(async (job) => {
    const hits: DerivativeResult[] = []
    const misses: DerivativePreset[] = []
    for (const preset of job.presets) {
      const started = performance.now()
      const cacheId = presetCacheId(preset)
      if (await cache.has(job.assetHash, cacheId)) {
        hits.push({
          assetHash: job.assetHash,
          presetId: preset.id,
          cacheId,
          cacheHit: true,
          ms: performance.now() - started,
        })
      } else {
        misses.push(preset)
      }
    }
    if (misses.length === 0) {
      return hits
    }
    const encoded = await new Promise<DerivativeResult[]>((resolve) => {
      queue.push({
        assetHash: job.assetHash,
        presets: misses,
        readSource: job.request.readSource,
        resolve,
      })
      pump()
    })
    const rank = (result: DerivativeResult) =>
      job.presets.findIndex((preset) => preset.id === result.presetId)
    return [...hits, ...encoded].sort((a, b) => rank(a) - rank(b))
  })
  return (await Promise.all(perJob)).flat()
}

/** Cached derivative bytes for `(assetHash, presetId)`, if encoded. */
export async function getDerivative(
  assetHash: string,
  presetId: string,
): Promise<DerivedCacheEntry | undefined> {
  const preset = DERIVATIVE_PRESETS.find((p) => p.id === presetId)
  if (preset === undefined) {
    return undefined
  }
  const cache = await getDerivedCache()
  const result = await cache.get(assetHash, presetCacheId(preset))
  return result.ok ? result.value : undefined
}

/** Drop every cached derivative of `assetHash`. */
export async function forgetDerivatives(assetHash: string): Promise<void> {
  const cache = await getDerivedCache()
  for (const preset of DERIVATIVE_PRESETS) {
    await cache.delete(assetHash, presetCacheId(preset))
  }
}

export function resetDerivativePoolForTests(): void {
  worker?.terminate()
  worker = undefined
  queue.length = 0
  inflight.clear()
  activeJobs = 0
  nextRequestId = 0
  if (retryTimer !== undefined) {
    clearTimeout(retryTimer)
    retryTimer = undefined
  }
}

interface DerivativesTestApi {
  requestDerivatives: typeof requestDerivatives
  getDerivative: typeof getDerivative
  forgetDerivatives: typeof forgetDerivatives
  presets: typeof DERIVATIVE_PRESETS
}

declare global {
  interface Window {
    __photobooksDerivatives?: DerivativesTestApi
  }
}

/** Compile-time gated: dead-code eliminated from the deploy build. */
export function exposeDerivativesTestApi(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
): void {
  // Literal `import.meta.env` check so Rollup folds it before tree-shaking.
  if (!(import.meta.env.DEV || import.meta.env.VITE_TEST_FIXTURES === '1')) {
    return
  }
  if (win === undefined) {
    return
  }
  win.__photobooksDerivatives = {
    requestDerivatives,
    getDerivative,
    forgetDerivatives,
    presets: DERIVATIVE_PRESETS,
  }
}
