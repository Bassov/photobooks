import type { RelinkProgress } from './statusStore'

/**
 * Coalesce progress publishes onto animation frames so rescan hashing cannot
 * flood React subscribers and create LoAF while the filmstrip scrolls.
 */
export function createProgressBatcher(
  publish: (next: RelinkProgress | null) => void,
): {
  schedule: (next: RelinkProgress | null) => void
  flush: () => void
  reset: () => void
} {
  let pending: RelinkProgress | null | undefined
  let rafId: number | null = null

  const cancel = (): void => {
    if (rafId === null) {
      return
    }
    cancelAnimationFrame(rafId)
    rafId = null
  }

  const flush = (): void => {
    cancel()
    if (pending === undefined) {
      return
    }
    const next = pending
    pending = undefined
    publish(next)
  }

  const schedule = (next: RelinkProgress | null): void => {
    pending = next
    // Start + terminal states publish immediately so UI/tests see the edges;
    // mid-scan ticks coalesce onto rAF to avoid LoAF while scrolling.
    if (next === null || !next.running || next.completed === 0) {
      flush()
      return
    }
    if (rafId !== null) {
      return
    }
    rafId = requestAnimationFrame(() => {
      rafId = null
      flush()
    })
  }

  const reset = (): void => {
    cancel()
    pending = undefined
  }

  return { schedule, flush, reset }
}
