import {
  bookPrintProfile,
  pagesOf,
  pdfFileName,
  photoPages,
  type Book,
  type PreflightRow,
} from '../../core'
import { createPdfWorker } from '../../core/pdf/createPdfWorker'
import { blankSheets, pdfSheets } from '../../core/pdf/pdfGeometry'
import type {
  PdfCheckMessage,
  PdfPaintMessage,
  PdfWorkerRequest,
} from '../../core/pdf/pdf.worker'
import type { PrintProfile } from '../../core/print/profileSchema'
import {
  writeExport,
  type ExportDirectoryHandle,
  type ExportFileHandle,
} from '../../project'
import { getBookPrintProfiles, getBookStoreSnapshot } from '../bookStore'
import { readSource } from '../export/startExportSite'
import {
  getOpenLibraryHandle,
  getProjectSessionSnapshot,
} from '../projectSession'
import { printStore, type PrintSkipped, type PrintStore } from './printStore'

/** What Export PDF prints: the book as it was at the click (D7) and the bleed choice (D4). */
export interface PrintJob {
  book: Book
  printProfiles: readonly PrintProfile[]
  marks: boolean
}

type PdfMessage = PdfPaintMessage | PdfCheckMessage

export type PdfWorkerRunner = (
  request: PdfWorkerRequest,
  onMessage: (message: PdfMessage) => void,
) => void

export interface PrintPhotos {
  /** Original files by asset id; `File`s clone to the worker unread. */
  photos: Record<string, Blob>
  /** Placed photos without a readable source. */
  missing: string[]
}

export interface PrintRunDeps {
  job: PrintJob
  resolvePhotos: (book: Book) => Promise<PrintPhotos>
  runWorker: PdfWorkerRunner
  library: () => Promise<ExportDirectoryHandle | null>
  libraryLabel: string
  write: typeof writeExport
  dispatch: PrintStore['dispatch']
}

/** Physical pages and PDF pages of the job's book (D5): the painter's sheets without blank padding. */
export function printCounts(
  book: Book,
  printProfiles: readonly PrintProfile[],
): { pages: number; sheets: number } {
  const profile = bookPrintProfile(book, printProfiles)
  return {
    pages: pagesOf(book.spreads.length),
    sheets: pdfSheets(book.spreads.length, book.settings.trim, profile.output)
      .length,
  }
}

/** Every PDF page the painter writes, blank padding to the profile minimum included. */
function paintedSheets(book: Book, printProfiles: readonly PrintProfile[]) {
  const profile = bookPrintProfile(book, printProfiles)
  const { trim } = book.settings
  const count = book.spreads.length
  return (
    pdfSheets(count, trim, profile.output).length +
    blankSheets(count, profile.pageCount.min, trim, profile.output).length
  )
}

function skippedOf(book: Book, assetIds: readonly string[]): PrintSkipped {
  const missing = new Set(assetIds)
  const all = new Set(
    [...photoPages(book)]
      .filter(([id]) => missing.has(id))
      .flatMap(([, pages]) => pages),
  )
  return { count: assetIds.length, pages: [...all].sort((a, b) => a - b) }
}

/** Resolves once the worker's last message (`done` / `checked` / `failed`) arrives. */
function lastMessage(
  runWorker: PdfWorkerRunner,
  request: PdfWorkerRequest,
  onProgress: (painted: number) => void,
): Promise<PdfMessage> {
  return new Promise((resolve) => {
    runWorker(request, (message) => {
      if ('progress' in message) {
        onProgress(message.progress.painted)
        return
      }
      resolve(message)
    })
  })
}

/**
 * One Print run (Designer pdf-export §2.2–2.4): paint in the PDF worker,
 * then write `<library>/exports/{pdfFileName}`. A second run while one is
 * going does nothing.
 */
export async function runPrint(deps: PrintRunDeps): Promise<void> {
  const { job, dispatch, libraryLabel } = deps
  const { book, printProfiles, marks } = job
  if (
    !dispatch({ type: 'start', sheets: paintedSheets(book, printProfiles) })
  ) {
    return
  }
  const fail = (code: 'access' | 'full' | 'other') => {
    dispatch({ type: 'failed', code, library: libraryLabel })
  }
  try {
    const { photos } = await deps.resolvePhotos(book)
    const painted = await lastMessage(
      deps.runWorker,
      { paint: { book, printProfiles, photos, marks } },
      (count) => {
        dispatch({ type: 'progress', painted: count })
      },
    )
    if (!('done' in painted)) {
      fail('other')
      return
    }
    dispatch({ type: 'saving' })
    const library = await deps.library()
    if (library === null) {
      fail('access')
      return
    }
    const file = pdfFileName(book.title ?? '', book.settings.trim)
    const { pdf, sheets, skipped } = painted.done
    const written = await deps.write(library, file, new Uint8Array(pdf))
    if (!written.ok) {
      fail(written.code)
      return
    }
    dispatch({
      type: 'done',
      file,
      sheets,
      bytes: pdf.byteLength,
      skipped: skippedOf(
        book,
        skipped.map(({ assetId }) => assetId),
      ),
      handle: written.file,
      library: libraryLabel,
    })
  } catch {
    fail('other')
  }
}

export interface PrintCheckDeps {
  book: Book
  printProfiles: readonly PrintProfile[]
  resolvePhotos: (book: Book) => Promise<PrintPhotos>
  runWorker: PdfWorkerRunner
}

/** The Check block rows (D6) from the worker `check`; a failed check shows none. */
export async function checkPrint(
  deps: PrintCheckDeps,
): Promise<PreflightRow[]> {
  const { book, printProfiles } = deps
  try {
    const { photos, missing } = await deps.resolvePhotos(book)
    const checked = await lastMessage(
      deps.runWorker,
      {
        check: {
          book,
          printProfiles,
          photos,
          assetStatus: Object.fromEntries(
            missing.map((id) => [id, 'missing' as const]),
          ),
        },
      },
      () => undefined,
    )
    return 'checked' in checked ? checked.checked.rows : []
  } catch {
    return []
  }
}

/** The placed photos' source files; unreadable ones are `missing`. */
export async function resolvePrintPhotos(book: Book): Promise<PrintPhotos> {
  const photos: Record<string, Blob> = {}
  const missing: string[] = []
  await Promise.all(
    [...photoPages(book).keys()].map(async (assetId) => {
      const asset = book.assets[assetId]
      try {
        if (asset === undefined) throw new Error('no asset')
        photos[assetId] = await readSource(assetId, asset)
      } catch {
        missing.push(assetId)
      }
    }),
  )
  return { photos, missing }
}

/** One PDF worker per request, ended after its last message. */
export const runPdfWorker: PdfWorkerRunner = (request, onMessage) => {
  const worker = createPdfWorker()
  worker.onmessage = (event: MessageEvent<PdfMessage>) => {
    onMessage(event.data)
    if (!('progress' in event.data)) {
      worker.terminate()
    }
  }
  worker.onerror = () => {
    onMessage({ failed: { message: 'PDF worker error' } })
    worker.terminate()
  }
  worker.postMessage(request)
}

function libraryLabel(): string {
  return getProjectSessionSnapshot().libraryLabel ?? 'Library'
}

let lastJob: PrintJob | null = null

/** Export PDF: snapshot the book now and run (from the click). */
export function startPrint(marks: boolean): void {
  lastJob = {
    book: getBookStoreSnapshot().book,
    printProfiles: getBookPrintProfiles(),
    marks,
  }
  runJob(lastJob)
}

/** Try again (D10): the same snapshot and options; a new export without one. */
export function retryPrint(marks: boolean): void {
  if (lastJob === null) {
    startPrint(marks)
    return
  }
  runJob(lastJob)
}

function runJob(job: PrintJob): void {
  void runPrint({
    job,
    resolvePhotos: resolvePrintPhotos,
    runWorker: runPdfWorker,
    library: async () =>
      (await getOpenLibraryHandle()) as ExportDirectoryHandle | null,
    libraryLabel: libraryLabel(),
    write: writeExport,
    dispatch: printStore.dispatch,
  })
}

/** The open book's Check rows. */
export function checkOpenBook(): Promise<PreflightRow[]> {
  return checkPrint({
    book: getBookStoreSnapshot().book,
    printProfiles: getBookPrintProfiles(),
    resolvePhotos: resolvePrintPhotos,
    runWorker: runPdfWorker,
  })
}

/** How long an opened PDF's blob URL lives. */
export const OPEN_PDF_URL_MS = 60_000

/**
 * D9 Open PDF: the written file in a new tab (the browser's PDF viewer).
 * `noopener` would leave a blob tab blank, so the opener is cut instead.
 */
export async function openPrintedPdf(
  handle: ExportFileHandle,
  win: Pick<Window, 'open' | 'setTimeout'> = window,
): Promise<void> {
  const file = await handle.getFile()
  const url = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }))
  const tab = win.open(url, '_blank')
  if (tab !== null) {
    tab.opener = null
  }
  win.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, OPEN_PDF_URL_MS)
}
