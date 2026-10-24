/** Legacy priority labels kept for callers; mapped to now/background lanes. */
export type DecodeJobPriority = 'visible' | 'zoom' | 'prefetch' | 'background'

/** Decode lane: now starves background; background runs only in idle. */
export type DecodeLane = 'now' | 'background'

/** True for legacy priorities that always map to the now lane. */
export function isNowPriority(priority: DecodeJobPriority): boolean {
  return priority === 'visible' || priority === 'zoom'
}

/** Map legacy priority + membership in the now-asset set to a lane. */
export function decodeLaneFor(
  priority: DecodeJobPriority,
  assetId: string,
  nowAssetIds: ReadonlySet<string>,
): DecodeLane {
  if (isNowPriority(priority) || nowAssetIds.has(assetId)) {
    return 'now'
  }
  return 'background'
}

export const DECODE_POOL_CAP = 4

/**
 * Resolve raw `navigator.hardwareConcurrency` to a positive core count.
 * Invalid / missing values fall back to 2 (so pool size is still ≥ 1).
 */
export function resolveDecodeCores(
  hardwareConcurrency: number | undefined,
): number {
  // Stryker disable next-line ConditionalExpression: `!== undefined` is redundant with `> 0` for number|undefined
  if (hardwareConcurrency !== undefined && hardwareConcurrency > 0) {
    return hardwareConcurrency
  }
  return 2
}

/** Pure pool sizing: min(4, max(1, hardwareConcurrency - 1)). */
export function decodeWorkerCount(
  hardwareConcurrency: number | undefined,
): number {
  return Math.min(
    DECODE_POOL_CAP,
    Math.max(1, resolveDecodeCores(hardwareConcurrency) - 1),
  )
}

export interface BackoffSignals {
  /** Recent longtask / LoAF pressure. */
  longTaskPressure?: boolean
  /** Approximate memory pressure (caller-defined). */
  memoryPressure?: boolean
}

/**
 * Temporarily lower effective decode concurrency under pressure.
 * Floor is 1; never raises above `base`.
 */
export function backoffConcurrency(
  base: number,
  signals: BackoffSignals,
): number {
  const capped = Math.max(1, Math.min(DECODE_POOL_CAP, Math.floor(base)))
  if (signals.memoryPressure === true) {
    return 1
  }
  if (signals.longTaskPressure === true) {
    return Math.max(1, Math.floor(capped / 2))
  }
  return capped
}

/** Prefer now over background; within a lane, higher rank first. */
export function compareDecodeJobs(
  a: { lane: DecodeLane; rank: number },
  b: { lane: DecodeLane; rank: number },
): number {
  if (a.lane !== b.lane) {
    return a.lane === 'now' ? -1 : 1
  }
  return b.rank - a.rank
}
