import type { ExportFileHandle, ExportWriteErrorCode } from '../../project'
import {
  browserJobClock,
  createJobStore,
  type JobClock,
  type JobStore,
} from '../export/jobStore'
import {
  imposePercent,
  printPercent,
  PRINT_SAVING_PERCENT,
  type PrintLayout,
} from './printText'

/** Photos the painter left as blank paper (Designer pdf-export §2.3). */
export interface PrintSkipped {
  count: number
  /** Ascending pages the skipped photos print on. */
  pages: number[]
  /** The front cover photo is one of them (cover-pdf §2.3). */
  cover: boolean
}

/** The cover sheet file written beside the pages (cover-pdf C1). */
interface PrintCoverFile {
  file: string
  bytes: number
  /** The written file (Open cover). */
  handle: ExportFileHandle
}

export interface PrintOutcome {
  file: string
  layout: PrintLayout
  /** PDF pages; a booklet's paper sheets. */
  sheets: number
  bytes: number
  skipped: PrintSkipped
  /** The written file (Open PDF / Open pages). */
  handle: ExportFileHandle
  /** 1 per sheet's cover file; null for a booklet. */
  cover: PrintCoverFile | null
  /** Library folder label of the "Saved in …/exports." line. */
  library: string
}

/** Designer pdf-export D1, §2.2–2.4: pill / dialog run state. */
export type PrintState =
  | { kind: 'idle' }
  | {
      kind: 'running'
      /** Sheets painted so far, 0..`sheets`; 1 per sheet's cover paints at `sheets`. */
      painted: number
      sheets: number
      percent: number
      /** Painting is over; the file is being written. */
      saving: boolean
      layout: PrintLayout
      /** A booklet's sheets imposed so far, once painting is over. */
      imposing: { imposed: number; sheets: number } | null
    }
  | ({ kind: 'done' } & PrintOutcome)
  | { kind: 'failed'; code: ExportWriteErrorCode; library: string }

export type PrintEvent =
  /** `layout` absent → 1 per sheet. */
  | { type: 'start'; sheets: number; layout?: PrintLayout }
  | { type: 'progress'; painted: number }
  | { type: 'imposing'; imposed: number; sheets: number }
  | { type: 'saving' }
  | ({ type: 'done' } & PrintOutcome)
  | { type: 'failed'; code: ExportWriteErrorCode; library: string }
  /** "PDF ready" has been shown long enough. */
  | { type: 'expire' }
  /** The user opened the failure. */
  | { type: 'seen' }

export const PRINT_IDLE: PrintState = { kind: 'idle' }

/** Pure transitions; one run at a time, progress never goes back. */
export function reducePrint(state: PrintState, event: PrintEvent): PrintState {
  switch (event.type) {
    case 'start':
      return state.kind === 'running'
        ? state
        : {
            kind: 'running',
            painted: 0,
            sheets: event.sheets,
            percent: 0,
            saving: false,
            layout: event.layout ?? 'single',
            imposing: null,
          }
    case 'progress':
      return state.kind === 'running' &&
        !state.saving &&
        state.imposing === null &&
        event.painted > state.painted
        ? {
            ...state,
            painted: event.painted,
            percent: printPercent(event.painted, state.sheets, state.layout),
          }
        : state
    case 'imposing':
      return state.kind === 'running' &&
        !state.saving &&
        event.imposed > (state.imposing?.imposed ?? -1)
        ? {
            ...state,
            painted: state.sheets,
            percent: imposePercent(event.imposed, event.sheets),
            imposing: { imposed: event.imposed, sheets: event.sheets },
          }
        : state
    case 'saving':
      return state.kind === 'running' && !state.saving
        ? {
            ...state,
            painted: state.sheets,
            percent: PRINT_SAVING_PERCENT,
            saving: true,
          }
        : state
    case 'done': {
      if (state.kind !== 'running') return state
      const { file, layout, sheets, bytes, skipped, handle, cover, library } =
        event
      return {
        kind: 'done',
        file,
        layout,
        sheets,
        bytes,
        skipped,
        handle,
        cover,
        library,
      }
    }
    case 'failed':
      return state.kind === 'running'
        ? { kind: 'failed', code: event.code, library: event.library }
        : state
    case 'expire':
      return state.kind === 'done' ? PRINT_IDLE : state
    case 'seen':
      return state.kind === 'failed' ? PRINT_IDLE : state
  }
}

export type PrintStore = JobStore<PrintState, PrintEvent>

/** Job store over `reducePrint`: progress throttled, done expires after 4 s. */
export function createPrintStore(clock: JobClock): PrintStore {
  return createJobStore(reducePrint, PRINT_IDLE, clock)
}

export const printStore = createPrintStore(browserJobClock)
