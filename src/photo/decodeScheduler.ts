import {
  compareDecodeJobs,
  decodeLaneFor,
  type DecodeJobPriority,
  type DecodeLane,
} from './decodeQueuePolicy'
import { THUMB_MAX_EDGE } from './photoEdges'

/** Priority rank within a lane (higher first). */
export function priorityRank(priority: DecodeJobPriority): number {
  switch (priority) {
    case 'visible':
      return 4
    case 'zoom':
      return 3
    case 'prefetch':
      return 2
    case 'background':
      return 1
  }
}

/** Build now = visible ∪ book-used. */
export function buildNowAssetIds(
  visibleAssetIds: ReadonlySet<string>,
  bookUsedAssetIds: ReadonlySet<string>,
): Set<string> {
  const next = new Set(visibleAssetIds)
  for (const id of bookUsedAssetIds) {
    next.add(id)
  }
  return next
}

/** Assets that left the now set and are not book-used (abort + pendingRetry). */
export function assetsLeavingNow(
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
  bookUsedAssetIds: ReadonlySet<string>,
): string[] {
  const leaving: string[] = []
  for (const assetId of previous) {
    if (!next.has(assetId) && !bookUsedAssetIds.has(assetId)) {
      leaving.push(assetId)
    }
  }
  return leaving
}

export function decodeJobRank(
  priority: DecodeJobPriority,
  assetId: string,
  nowAssetIds: ReadonlySet<string>,
): number {
  const boost = nowAssetIds.has(assetId) ? 10 : 0
  return priorityRank(priority) + boost
}

export interface RankedDecodeJob {
  lane: DecodeLane
  priority: DecodeJobPriority
  assetId: string
  signal?: AbortSignal
}

export interface PendingRetrySeed {
  assetId: string
  priority: DecodeJobPriority
  maxEdge: number
  cover: boolean
  dualTiers: boolean
  file: File
}

/** Sort in place: now before background, then higher rank first. */
export function sortDecodeJobs(
  queue: RankedDecodeJob[],
  nowAssetIds: ReadonlySet<string>,
): void {
  queue.sort((a, b) =>
    compareDecodeJobs(
      { lane: a.lane, rank: decodeJobRank(a.priority, a.assetId, nowAssetIds) },
      { lane: b.lane, rank: decodeJobRank(b.priority, b.assetId, nowAssetIds) },
    ),
  )
}

/**
 * Pick the next runnable job. Aborted queue items are rejected via `onAborted`
 * and skipped (caller stores pendingRetry from the returned seed).
 */
export function takeNextDecodeJob<T extends RankedDecodeJob>(
  queue: T[],
  allowBackground: boolean,
  nowAssetIds: ReadonlySet<string>,
  onAborted: (job: T) => void,
): T | undefined {
  sortDecodeJobs(queue, nowAssetIds)
  while (queue.length > 0) {
    const head = queue[0]
    if (head !== undefined && !allowBackground && head.lane !== 'now') {
      return undefined
    }
    const job = queue.shift()
    // Stryker disable next-line ConditionalExpression,BlockStatement: shift after length>0 is defined at runtime
    if (job === undefined) {
      return undefined
    }
    if (job.signal?.aborted) {
      onAborted(job)
      continue
    }
    return job
  }
  return undefined
}

/**
 * Leave-now keeps an in-flight thumb320 decode: the worker cannot cancel, so
 * dropping it only throws the result away. Working previews (1280) still abort.
 */
export function keepsInFlightOnLeaveNow(job: { maxEdge: number }): boolean {
  return job.maxEdge === THUMB_MAX_EDGE
}

export function pendingRetryFromJob(job: {
  assetId: string
  file: File
  maxEdge: number
  cover: boolean
  dualTiers: boolean
}): PendingRetrySeed {
  return {
    assetId: job.assetId,
    file: job.file,
    priority: 'visible',
    maxEdge: job.maxEdge,
    cover: job.cover,
    dualTiers: job.dualTiers,
  }
}

/** Relabel queued lanes after a now-set change. */
export function relabelQueueLanes(
  queue: {
    priority: DecodeJobPriority
    assetId: string
    lane: DecodeLane
  }[],
  nowAssetIds: ReadonlySet<string>,
): void {
  for (const job of queue) {
    job.lane = decodeLaneFor(job.priority, job.assetId, nowAssetIds)
  }
}

export function queueHasBackgroundLane(
  queue: readonly { lane: DecodeLane }[],
): boolean {
  return queue.some((item) => item.lane === 'background')
}

/**
 * Schedule a background drain once the now lane is empty.
 * Prefer `scheduler.postTask({priority:'background'})`, then
 * `requestIdleCallback`, then a 0ms timeout (tests / sparse hosts).
 */
export function scheduleWhenNowEmpty(run: () => void): void {
  const schedulerUnknown: unknown = Reflect.get(globalThis, 'scheduler')
  if (
    typeof schedulerUnknown === 'object' &&
    schedulerUnknown !== null &&
    'postTask' in schedulerUnknown &&
    typeof schedulerUnknown.postTask === 'function'
  ) {
    void (
      schedulerUnknown as {
        postTask: (
          cb: () => void,
          opts: { priority: string },
        ) => Promise<unknown>
      }
    ).postTask(run, { priority: 'background' })
    return
  }
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(() => {
      run()
    })
    return
  }
  setTimeout(run, 0)
}

/** Fresh AbortController when missing or already aborted. */
export function ensureActiveAbortController(
  current: AbortController | undefined,
): AbortController {
  if (current === undefined || current.signal.aborted) {
    return new AbortController()
  }
  return current
}

/** Combine outer caller signal with the pool controller for one asset. */
export function combineDecodeAbortSignals(
  pool: AbortSignal,
  outer: AbortSignal | undefined,
): AbortSignal {
  if (outer === undefined) {
    return pool
  }
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([outer, pool])
  }
  return outer.aborted ? outer : pool
}

/** Count busy slots (for backoff limit tests). */
export function countBusySlots(slots: readonly { busy: boolean }[]): number {
  let active = 0
  for (const slot of slots) {
    if (slot.busy) {
      active += 1
    }
  }
  return active
}

/** True when another worker may start under the effective limit. */
export function canStartAnotherSlot(active: number, limit: number): boolean {
  return active < limit
}

/**
 * After a now-only pump finds no now work, schedule background if any remain.
 * (Background-allowed pumps never re-schedule from this gate.)
 */
export function shouldScheduleBackgroundDrain(
  allowBackground: boolean,
  hasBackground: boolean,
): boolean {
  return !allowBackground && hasBackground
}

/**
 * Bulk/prefetch import encodes thumb320 only; working 1280 is built on
 * pasteboard/placement/need via requestTier (or an explicit dualTiers job).
 */
export function dualTiersDefaultForImport(): boolean {
  return false
}

/** Merge adaptive backoff flags; omit keys leave the prior value. */
export function applyDecodePressureSignals(
  current: { longTaskPressure: boolean; memoryPressure: boolean },
  signals: {
    longTaskPressure?: boolean
    memoryPressure?: boolean
  },
): { longTaskPressure: boolean; memoryPressure: boolean } {
  return {
    longTaskPressure: signals.longTaskPressure ?? current.longTaskPressure,
    memoryPressure: signals.memoryPressure ?? current.memoryPressure,
  }
}
