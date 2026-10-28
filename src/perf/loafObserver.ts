import { PERF_BUDGETS } from './budgets'

export interface LoafEntry {
  startTime: number
  duration: number
  blockingDuration: number
}

interface LoafLikeEntry extends PerformanceEntry {
  blockingDuration?: number
}

const entries: LoafEntry[] = []
let observer: PerformanceObserver | null = null
/** Entries with startTime < watermark are ignored (cleared scenario window). */
let watermarkMs = 0

function toLoafEntry(entry: LoafLikeEntry): LoafEntry {
  return {
    startTime: entry.startTime,
    duration: entry.duration,
    blockingDuration: entry.blockingDuration ?? entry.duration,
  }
}

function ingestRecords(recordList: PerformanceEntryList): void {
  for (const entry of recordList) {
    const loaf = toLoafEntry(entry)
    if (loaf.startTime < watermarkMs) {
      continue
    }
    entries.push(loaf)
  }
}

/** Drain buffered observer records into `entries` (respecting the watermark). */
function flushObserverRecords(): void {
  if (observer === null || typeof observer.takeRecords !== 'function') {
    return
  }
  ingestRecords(observer.takeRecords())
}

export function isLoafObserving(): boolean {
  return observer !== null
}

/** Starts LoAF observation. Returns whether the observer is active. */
export function startLoafObserver(): boolean {
  if (typeof PerformanceObserver === 'undefined') {
    return false
  }
  if (observer !== null) {
    return true
  }

  try {
    observer = new PerformanceObserver((list) => {
      ingestRecords(list.getEntries())
    })

    observer.observe({ type: 'long-animation-frame', buffered: true })
    return true
  } catch {
    observer = null
    return false
  }
}

export function stopLoafObserver(): void {
  observer?.disconnect()
  observer = null
  watermarkMs = 0
}

export function getLoafEntries(): readonly LoafEntry[] {
  flushObserverRecords()
  return entries
}

export function clearLoafEntries(): void {
  // Drop anything already buffered under the previous watermark so it cannot
  // land in the next scenario window after the callback fires late.
  flushObserverRecords()
  entries.length = 0
  watermarkMs = observer === null ? 0 : performance.now()
}

/**
 * 60 fps LoAF gate. blockingDuration = sum over tasks of ms beyond 50.
 *  1. `blockingDuration === 0` never counts: the frame was long but no task
 *     blocked input (CPU throttle / slow paint produce these).
 *  2. A frame blocking more than `PERF_BUDGETS.loafNoiseBlockingMs` (20 ms,
 *     a task past ~70 ms: visible jank) is a real freeze and counts toward
 *     `maxEntries` (default 0).
 *  3. Frames blocking 1-20 ms are infra noise (GC, scheduler hiccup on a
 *     loaded runner). At most `PERF_BUDGETS.loafNoiseEntriesMax` (1) is
 *     tolerated per window; a repeat means sustained slowness and fails.
 * Not a bypass: a 120 ms busy loop must still fail (see tests).
 */
export function assertNoLoafEntries(
  maxEntries: number = PERF_BUDGETS.loafEntriesMax,
): void {
  if (!isLoafObserving()) {
    throw new Error('LoAF observer is not active; cannot assert LoAF budget')
  }
  flushObserverRecords()
  const blocking = entries.filter((e) => e.blockingDuration > 0)
  const real = blocking.filter(
    (e) => e.blockingDuration > PERF_BUDGETS.loafNoiseBlockingMs,
  )
  const noise = blocking.length - real.length
  const worstMs = String(
    blocking.reduce((m, e) => Math.max(m, e.blockingDuration), 0),
  )
  if (real.length > maxEntries) {
    throw new Error(
      `LoAF entries ${String(real.length)} exceed max ${String(maxEntries)} (worst blockingDuration ${worstMs}ms)`,
    )
  }
  if (noise > PERF_BUDGETS.loafNoiseEntriesMax) {
    throw new Error(
      `LoAF entries ${String(noise)} exceed max ${String(PERF_BUDGETS.loafNoiseEntriesMax)} (repeated small spikes, worst blockingDuration ${worstMs}ms)`,
    )
  }
}
