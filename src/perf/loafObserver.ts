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
  return entries
}

export function clearLoafEntries(): void {
  // Drop anything already buffered under the previous watermark so it cannot
  // land in the next scenario window after the callback fires late.
  flushObserverRecords()
  entries.length = 0
  watermarkMs = observer === null ? 0 : performance.now()
}

/** Asserts zero LoAF entries during the scenario window (60 fps gate). */
export function assertNoLoafEntries(
  maxEntries: number = PERF_BUDGETS.loafEntriesMax,
): void {
  if (!isLoafObserving()) {
    throw new Error('LoAF observer is not active; cannot assert LoAF budget')
  }
  flushObserverRecords()
  if (entries.length > maxEntries) {
    const worst = entries.reduce((a, b) =>
      a.blockingDuration > b.blockingDuration ? a : b,
    )
    throw new Error(
      `LoAF entries ${String(entries.length)} exceed max ${String(maxEntries)} (worst blockingDuration ${String(worst.blockingDuration)}ms)`,
    )
  }
}
