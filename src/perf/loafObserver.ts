export interface LoafEntry {
  startTime: number
  duration: number
  blockingDuration: number
}

export const LOAF_BLOCKING_BUDGET_MS = 200

interface LoafLikeEntry extends PerformanceEntry {
  blockingDuration?: number
}

const entries: LoafEntry[] = []
let observer: PerformanceObserver | null = null

function toLoafEntry(entry: LoafLikeEntry): LoafEntry {
  return {
    startTime: entry.startTime,
    duration: entry.duration,
    blockingDuration: entry.blockingDuration ?? entry.duration,
  }
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
      for (const entry of list.getEntries()) {
        entries.push(toLoafEntry(entry))
      }
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
}

export function getLoafEntries(): readonly LoafEntry[] {
  return entries
}

export function clearLoafEntries(): void {
  entries.length = 0
}

export function assertNoExcessiveBlocking(
  budgetMs: number = LOAF_BLOCKING_BUDGET_MS,
): void {
  if (!isLoafObserving()) {
    throw new Error(
      'LoAF observer is not active; cannot assert blocking budget',
    )
  }
  const offenders = entries.filter((e) => e.blockingDuration > budgetMs)
  if (offenders.length > 0) {
    const worst = offenders.reduce((a, b) =>
      a.blockingDuration > b.blockingDuration ? a : b,
    )
    throw new Error(
      `LoAF blockingDuration ${String(worst.blockingDuration)}ms exceeds budget ${String(budgetMs)}ms`,
    )
  }
}
