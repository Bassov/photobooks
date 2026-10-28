/** Shared 60 fps proxy budgets. Single source of truth for tests and benches. */
export const PERF_BUDGETS = {
  /**
   * CDP `Emulation.setCPUThrottlingRate` for CI Playwright scenarios.
   * Calibrated so the photo-card 24MP import records zero LoAF on shared runners;
   * 4× produced LoAF duration ~50–80 ms with blockingDuration 0 on local Chromium.
   */
  cpuThrottleRate: 2,
  /** Maximum LoAF entries allowed during a scenario window. */
  loafEntriesMax: 0,
  /** LoAF blockingDuration (ms) at or below which a frame is infra noise. */
  loafNoiseBlockingMs: 20,
  /** Isolated noise frames tolerated per scenario window; repeats fail. */
  loafNoiseEntriesMax: 1,
  /** Hot-handler `performance.measure` p95 ceiling (ms), unthrottled. */
  handlerP95Ms: 2,
  /** Interaction to next paint ceiling (ms), unthrottled. */
  inpMs: 100,
  /** rAF frame duration p95 ceiling (ms) for local `pnpm perf`. */
  frameP95Ms: 16.7,
  /** Max fraction of frames slower than `frameP95Ms` for local `pnpm perf`. */
  droppedFrameRatio: 0.02,
  /**
   * Max main-thread long task (ms) for folder scan/import scheduler harnesses.
   * Does not relax LoAF-zero CI interaction gates.
   */
  scanSchedulerLongTaskMs: 100,
} as const
