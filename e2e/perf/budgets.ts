/**
 * Mirrors `src/perf/budgets.ts` for the Playwright TS project
 * (e2e must not import app modules).
 */
export const PERF_BUDGETS = {
  cpuThrottleRate: 2,
  loafEntriesMax: 0,
  loafNoiseBlockingMs: 20,
  loafNoiseEntriesMax: 1,
  handlerP95Ms: 2,
  inpMs: 100,
  frameP95Ms: 16.7,
  droppedFrameRatio: 0.02,
  scanSchedulerLongTaskMs: 100,
} as const

/**
 * Thumb fling scenarios only (Owner-approved, perf-gate-short-loaf): LoAF
 * entries blocking at most this many ms are not counted. Not a `PERF_BUDGETS`
 * key: the shared budgets stay as they are.
 */
export const FLING_LOAF_IGNORE_BLOCKING_MS = 5

/** Must match `IMPORT_PHOTOS_HANDLER_LABEL` in `src/editor/importPhotos.ts`. */
export const OPEN_PHOTO_HANDLER_LABEL = 'import-photos'
