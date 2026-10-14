import { PERF_BUDGETS } from './budgets'
import { percentile } from './percentile'

export interface FramePacingStats {
  sampleCount: number
  p95Ms: number
  droppedRatio: number
  deltasMs: readonly number[]
}

const deltas: number[] = []
let rafId: number | null = null
let lastTs: number | null = null

export function isFramePacingSampling(): boolean {
  return rafId !== null
}

export function startFramePacingSampler(): boolean {
  if (typeof requestAnimationFrame === 'undefined') {
    return false
  }
  if (rafId !== null) {
    return true
  }
  lastTs = null
  const tick = (ts: number): void => {
    if (lastTs !== null) {
      deltas.push(ts - lastTs)
    }
    lastTs = ts
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
  return true
}

export function stopFramePacingSampler(): void {
  if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(rafId)
  }
  rafId = null
  lastTs = null
}

export function clearFramePacingSamples(): void {
  deltas.length = 0
}

export function getFramePacingStats(): FramePacingStats {
  if (deltas.length === 0) {
    return { sampleCount: 0, p95Ms: 0, droppedRatio: 0, deltasMs: [] }
  }
  const p95Ms = percentile(deltas, 95)
  const dropped = deltas.filter((d) => d > PERF_BUDGETS.frameP95Ms).length
  return {
    sampleCount: deltas.length,
    p95Ms,
    droppedRatio: dropped / deltas.length,
    deltasMs: [...deltas],
  }
}

export function assertFramePacingWithinBudget(
  budgetP95Ms: number = PERF_BUDGETS.frameP95Ms,
  budgetDroppedRatio: number = PERF_BUDGETS.droppedFrameRatio,
): void {
  const stats = getFramePacingStats()
  if (stats.sampleCount === 0) {
    throw new Error('No frame-pacing samples; cannot assert budget')
  }
  if (stats.p95Ms > budgetP95Ms) {
    throw new Error(
      `Frame pacing p95 ${String(stats.p95Ms)}ms exceeds budget ${String(budgetP95Ms)}ms`,
    )
  }
  if (stats.droppedRatio > budgetDroppedRatio) {
    throw new Error(
      `Dropped frame ratio ${String(stats.droppedRatio)} exceeds budget ${String(budgetDroppedRatio)}`,
    )
  }
}
