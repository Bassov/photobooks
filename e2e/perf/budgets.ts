/**
 * Mirrors `src/perf/budgets.ts` for the Playwright TS project
 * (e2e must not import app modules).
 */
export const PERF_BUDGETS = {
  cpuThrottleRate: 2,
  loafEntriesMax: 0,
  handlerP95Ms: 2,
  inpMs: 100,
  frameP95Ms: 16.7,
  droppedFrameRatio: 0.02,
  scanSchedulerLongTaskMs: 100,
} as const

/** Must match `IMPORT_PHOTOS_HANDLER_LABEL` in `src/editor/importPhotos.ts`. */
export const OPEN_PHOTO_HANDLER_LABEL = 'import-photos'
