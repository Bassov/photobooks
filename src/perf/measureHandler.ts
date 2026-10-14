import { PERF_BUDGETS } from './budgets'
import { percentile } from './percentile'

const MEASURE_PREFIX = 'photobooks-handler:'

function handlerMeasureName(label: string): string {
  return `${MEASURE_PREFIX}${label}`
}

function endMeasure(name: string, startMark: string, endMark: string): void {
  performance.mark(endMark)
  try {
    performance.measure(name, startMark, endMark)
  } catch {
    // Marks may be cleared by scenario clear; ignore measure failures.
  }
  performance.clearMarks(startMark)
  performance.clearMarks(endMark)
}

/**
 * Runs sync `fn` under `performance.measure` (`photobooks-handler:<label>`).
 * Use for hot-path kickoffs that must not include awaited worker/IO time.
 */
export function measureHandlerSync<T>(label: string, fn: () => T): T {
  const name = handlerMeasureName(label)
  const startMark = `${name}-start`
  const endMark = `${name}-end`
  performance.mark(startMark)
  try {
    return fn()
  } finally {
    endMeasure(name, startMark, endMark)
  }
}

/**
 * Runs `fn` under `performance.measure`, awaiting promises.
 * Prefer `measureHandlerSync` for kickoffs that must stay under the handler p95 budget.
 */
export async function measureHandler<T>(
  label: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const name = handlerMeasureName(label)
  const startMark = `${name}-start`
  const endMark = `${name}-end`
  performance.mark(startMark)
  try {
    return await fn()
  } finally {
    endMeasure(name, startMark, endMark)
  }
}

export function getHandlerMeasureDurations(label: string): number[] {
  const name = handlerMeasureName(label)
  return performance.getEntriesByName(name, 'measure').map((e) => e.duration)
}

export function clearHandlerMeasures(label?: string): void {
  if (label) {
    performance.clearMeasures(handlerMeasureName(label))
    return
  }
  for (const entry of performance.getEntriesByType('measure')) {
    if (entry.name.startsWith(MEASURE_PREFIX)) {
      performance.clearMeasures(entry.name)
    }
  }
}

export function assertHandlerP95WithinBudget(
  label: string,
  budgetMs: number = PERF_BUDGETS.handlerP95Ms,
): void {
  const durations = getHandlerMeasureDurations(label)
  if (durations.length === 0) {
    throw new Error(
      `No performance.measure entries for ${handlerMeasureName(label)}`,
    )
  }
  const p95 = percentile(durations, 95)
  if (p95 > budgetMs) {
    throw new Error(
      `Handler ${label} p95 ${String(p95)}ms exceeds budget ${String(budgetMs)}ms`,
    )
  }
}
