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

export function startLoafObserver(): void {
  if (typeof PerformanceObserver === 'undefined') {
    return
  }
  if (observer !== null) {
    return
  }

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        entries.push(toLoafEntry(entry))
      }
    })

    observer.observe({ type: 'long-animation-frame', buffered: true })
  } catch {
    observer = null
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
