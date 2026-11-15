import type { SiteExportErrorCode } from '../../site/export/writeSiteTree'
import type { ExportSitePhase, ExportSiteSummary } from './exportSiteText'
import {
  browserJobClock,
  createJobStore,
  JOB_DONE_MS,
  JOB_PROGRESS_MS,
  type JobClock,
  type JobStore,
} from './jobStore'

/** Designer spec static-export §1: pill / dialog run state. */
export type ExportSiteState =
  | { kind: 'idle' }
  | { kind: 'running'; phase: ExportSitePhase; percent: number }
  | { kind: 'done'; summary: ExportSiteSummary; folder: string }
  | { kind: 'failed'; code: SiteExportErrorCode; folder: string }

export type ExportSiteEvent =
  | { type: 'start' }
  | { type: 'progress'; phase: ExportSitePhase; percent: number }
  | { type: 'done'; summary: ExportSiteSummary; folder: string }
  | { type: 'failed'; code: SiteExportErrorCode; folder: string }
  /** "Exported" has been shown long enough. */
  | { type: 'expire' }
  /** The user opened the failure. */
  | { type: 'seen' }

export const EXPORT_SITE_IDLE: ExportSiteState = { kind: 'idle' }

/** Progress reaches subscribers at most this often. */
export const EXPORT_PROGRESS_MS = JOB_PROGRESS_MS
/** "Exported" stays on the pill this long. */
export const EXPORT_DONE_MS = JOB_DONE_MS

/** Pure transitions; one run at a time, percent never goes back. */
export function reduceExportSite(
  state: ExportSiteState,
  event: ExportSiteEvent,
): ExportSiteState {
  switch (event.type) {
    case 'start':
      return state.kind === 'running'
        ? state
        : { kind: 'running', phase: 'prepare', percent: 0 }
    case 'progress':
      return state.kind === 'running'
        ? {
            kind: 'running',
            phase: event.phase,
            percent: Math.max(state.percent, event.percent),
          }
        : state
    case 'done':
      return state.kind === 'running'
        ? { kind: 'done', summary: event.summary, folder: event.folder }
        : state
    case 'failed':
      return state.kind === 'running'
        ? { kind: 'failed', code: event.code, folder: event.folder }
        : state
    case 'expire':
      return state.kind === 'done' ? EXPORT_SITE_IDLE : state
    case 'seen':
      return state.kind === 'failed' ? EXPORT_SITE_IDLE : state
  }
}

export type ExportSiteClock = JobClock

export type ExportSiteStore = JobStore<ExportSiteState, ExportSiteEvent>

/** Job store over `reduceExportSite` (`createJobStore`). */
export function createExportSiteStore(clock: ExportSiteClock): ExportSiteStore {
  return createJobStore(reduceExportSite, EXPORT_SITE_IDLE, clock)
}

export const exportSiteStore = createExportSiteStore(browserJobClock)
