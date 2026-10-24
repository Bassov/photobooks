/** Shared 60 fps proxy budgets. Single source of truth for tests and benches. */
export const PERF_BUDGETS = {
  /**
   * CDP `Emulation.setCPUThrottlingRate` for CI Playwright scenarios.
   * Calibrated so the photo-card 24MP import records zero input-blocking LoAF
   * on shared runners; 4× produced LoAF duration ~50–80 ms with
   * blockingDuration 0 on local Chromium. The observer drops blockingDuration
   * 0 entries (see `loafObserver`) so throttle-stretched frames without long
   * tasks do not fail the zero-entry gate.
   */
  cpuThrottleRate: 2,
  /**
   * Maximum input-blocking LoAF entries (`blockingDuration > 0`) allowed
   * during a scenario window.
   */
  loafEntriesMax: 0,
  /** Hot-handler `performance.measure` p95 ceiling (ms), unthrottled. */
  handlerP95Ms: 2,
  /** Interaction to next paint ceiling (ms), unthrottled. */
  inpMs: 100,
  /** rAF frame duration p95 ceiling (ms) for local `pnpm perf`. */
  frameP95Ms: 16.7,
  /** Max fraction of frames slower than `frameP95Ms` for local `pnpm perf`. */
  droppedFrameRatio: 0.02,
} as const
