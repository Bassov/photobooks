import { PERF_BUDGETS } from './budgets'

export interface EventTimingEntry {
  name: string
  startTime: number
  duration: number
  processingStart: number
  processingEnd: number
  /** Interaction to next paint estimate (duration when available). */
  interactionLatency: number
}

interface EventTimingLike extends PerformanceEntry {
  processingStart?: number
  processingEnd?: number
  interactionId?: number
}

const entries: EventTimingEntry[] = []
let observer: PerformanceObserver | null = null

function ingest(list: PerformanceObserverEntryList): void {
  for (const entry of list.getEntries()) {
    entries.push(toEntry(entry))
  }
}

function toEntry(entry: PerformanceEntry): EventTimingEntry {
  const timed = entry as EventTimingLike
  const processingStart = timed.processingStart ?? entry.startTime
  const processingEnd = timed.processingEnd ?? entry.startTime + entry.duration
  return {
    name: entry.name,
    startTime: entry.startTime,
    duration: entry.duration,
    processingStart,
    processingEnd,
    interactionLatency: entry.duration,
  }
}

export function isEventTimingObserving(): boolean {
  return observer !== null
}

export function startEventTimingObserver(): boolean {
  if (typeof PerformanceObserver === 'undefined') {
    return false
  }
  if (observer !== null) {
    return true
  }
  try {
    observer = new PerformanceObserver((list) => {
      ingest(list)
    })
    observer.observe({
      type: 'event',
      buffered: true,
      // Include short interactions so Open-photo click INP is recorded.
      durationThreshold: 0,
    } as PerformanceObserverInit)
    return true
  } catch {
    // Fallback without durationThreshold for older engines.
    try {
      observer = new PerformanceObserver((list) => {
        ingest(list)
      })
      observer.observe({ type: 'event', buffered: true })
      return true
    } catch {
      observer = null
      return false
    }
  }
}

/** Flush buffered observer entries into the local store. */
export function flushEventTimingEntries(): void {
  if (observer && 'takeRecords' in observer) {
    for (const entry of observer.takeRecords()) {
      entries.push(toEntry(entry))
    }
  }
}

export function stopEventTimingObserver(): void {
  observer?.disconnect()
  observer = null
}

export function getEventTimingEntries(): readonly EventTimingEntry[] {
  return entries
}

export function clearEventTimingEntries(): void {
  entries.length = 0
}

/** Worst interaction latency among recorded event-timing entries (INP proxy). */
export function getInpMs(): number | null {
  if (entries.length === 0) {
    return null
  }
  return entries.reduce((max, e) => Math.max(max, e.interactionLatency), 0)
}

export function assertInpWithinBudget(
  budgetMs: number = PERF_BUDGETS.inpMs,
): void {
  if (!isEventTimingObserving()) {
    throw new Error('Event Timing observer is not active; cannot assert INP')
  }
  flushEventTimingEntries()
  const inp = getInpMs()
  if (inp === null) {
    throw new Error('No Event Timing entries; cannot assert INP')
  }
  if (inp > budgetMs) {
    throw new Error(`INP ${String(inp)}ms exceeds budget ${String(budgetMs)}ms`)
  }
}
