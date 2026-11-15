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
  PdfImposeMessage,
  PdfPaintMessage,
  PdfWorkerRequest,
} from '../../core/pdf/pdf.worker'
import { sheetCount } from '../../core/print/imposition'
import type { PrintProfile } from '../../core/print/profileSchema'
import {
  openExport,
  type ExportDirectoryHandle,
  type ExportFileHandle,
  type ExportStream,
} from '../../project'
import { getBookPrintProfiles, getBookStoreSnapshot } from '../bookStore'
import { readSource } from '../export/startExportSite'
import {
  getOpenLibraryHandle,
  getProjectSessionSnapshot,
} from '../projectSession'
import { printStore, type PrintSkipped, type PrintStore } from './printStore'
import type { PrintLayout } from './printText'

/** What Export PDF prints: the book as it was at the click (D7), the bleed choice (D4) and the imposition. */
export interface PrintJob {
  book: Book
  printProfiles: readonly PrintProfile[]
  marks: boolean
  layout: PrintLayout
}

type PdfMessage = PdfPaintMessage | PdfCheckMessage | PdfImposeMessage
type PdfProgress = Extract<PdfMessage, { progress: unknown }>['progress']

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
  open: typeof openExport
  dispatch: PrintStore['dispatch']
}

/**
 * Physical pages and PDF pages of the job's book (D5): the painter's sheets
 * without blank padding; a booklet's paper sheets.
 */
export function printCounts(
  book: Book,
  printProfiles: readonly PrintProfile[],
  layout: PrintLayout,
): { pages: number; sheets: number } {
  const profile = bookPrintProfile(book, printProfiles)
  const pages = pagesOf(book.spreads.length)
  return {
    pages,
    sheets:
      layout === 'single'
        ? pdfSheets(book.spreads.length, book.settings.trim, profile.output)
            .length
        : sheetCount(pages, layout),
  }
}

/** Profile id of a booklet's page PDF. */
export const BOOKLET_PROFILE_ID = 'booklet-pages'

/**
 * A booklet paints one PDF page per book page and pads with blank paper
 * itself: the book's profile with `pages` output and no page minimum.
 */
export function bookletPaintJob(
  book: Book,
  printProfiles: readonly PrintProfile[],
): Pick<PrintJob, 'book' | 'printProfiles'> {
  const profile = bookPrintProfile(book, printProfiles)
  return {
    book: { ...book, printProfile: { id: BOOKLET_PROFILE_ID, overrides: {} } },
    printProfiles: [
      ...printProfiles,
      {
        ...profile,
        id: BOOKLET_PROFILE_ID,
        output: 'pages',
        pageCount: { ...profile.pageCount, min: 0 },
      },
    ],
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

/**
 * Resolves once the worker's last message (`done` / `checked` / `failed`)
 * arrives; `chunk`s go to `onChunk` in order.
 */
function lastMessage(
  runWorker: PdfWorkerRunner,
  request: PdfWorkerRequest,
  onProgress: (progress: PdfProgress) => void,
  onChunk: (chunk: ArrayBuffer) => void,
): Promise<PdfMessage> {
  return new Promise((resolve) => {
    runWorker(request, (message) => {
      if ('chunk' in message) {
        onChunk(message.chunk)
      } else if ('progress' in message) {
        onProgress(message.progress)
      } else {
        resolve(message)
      }
    })
  })
}

/**
 * A booklet's imposed PDF from the page PDF (worker `impose`), streamed to
 * `output`; its sheets, null when it failed.
 */
async function imposed(
  deps: PrintRunDeps,
  pdf: Blob,
  layout: Exclude<PrintLayout, 'single'>,
  output: (chunk: ArrayBuffer) => void,
): Promise<{ bytes: number; sheets: number } | null> {
  const sheets = sheetCount(pagesOf(deps.job.book.spreads.length), layout)
  deps.dispatch({ type: 'imposing', imposed: 0, sheets })
  const message = await lastMessage(
    deps.runWorker,
    { impose: { pdf, layout } },
    (progress) => {
      if ('imposed' in progress) {
        deps.dispatch({ type: 'imposing', ...progress })
      }
    },
    output,
  )
  return 'done' in message && 'sheets' in message.done ? message.done : null
}

/** The output without a library: writes go nowhere, saving fails as `access`. */
const NO_LIBRARY: ExportStream = {
  write: () => undefined,
  close: () => Promise.resolve({ ok: false, code: 'access' }),
  abort: () => Promise.resolve(),
}

/**
 * One Print run (Designer pdf-export §2.2–2.4): paint in the PDF worker,
 * impose a booklet there too, streaming the file to
 * `<library>/exports/{pdfFileName}` as its chunks arrive. A booklet's page
 * PDF gathers as a Blob for the impose worker. A refused write shows once
 * the PDF is built, as `saving` ends. A second run while one is going does
 * nothing.
 */
export async function runPrint(deps: PrintRunDeps): Promise<void> {
  const { job, dispatch, libraryLabel } = deps
  const { marks, layout } = job
  const { book, printProfiles } =
    layout === 'single' ? job : bookletPaintJob(job.book, job.printProfiles)
  if (
    !dispatch({
      type: 'start',
      sheets: paintedSheets(book, printProfiles),
      layout,
    })
  ) {
    return
  }
  const fail = (code: 'access' | 'full' | 'other') => {
    dispatch({ type: 'failed', code, library: libraryLabel })
  }
  const single = pdfFileName(book.title ?? '', book.settings.trim)
  // A booklet adds its layout (`lake-trip-A5-2up.pdf`).
  const file =
    layout === 'single'
      ? single
      : `${single.slice(0, -'.pdf'.length)}-${layout}.pdf`
  let output = NO_LIBRARY
  try {
    const library = await deps.library()
    if (library !== null) output = deps.open(library, file)
    const write = (chunk: ArrayBuffer) => {
      output.write(new Uint8Array(chunk))
    }
    // Each page PDF chunk becomes a Blob part at once: no joined copy.
    const pages: Blob[] = []
    const { photos } = await deps.resolvePhotos(book)
    const painted = await lastMessage(
      deps.runWorker,
      { paint: { book, printProfiles, photos, marks } },
      (progress) => {
        if ('painted' in progress) {
          dispatch({ type: 'progress', painted: progress.painted })
        }
      },
      layout === 'single'
        ? write
        : (chunk) => {
            pages.push(new Blob([chunk]))
          },
    )
    if (!('done' in painted && 'skipped' in painted.done)) {
      await output.abort()
      fail('other')
      return
    }
    const { skipped } = painted.done
    const booklet =
      layout === 'single'
        ? null
        : await imposed(
            deps,
            new Blob(pages, { type: 'application/pdf' }),
            layout,
            write,
          )
    if (layout !== 'single' && booklet === null) {
      await output.abort()
      fail('other')
      return
    }
    const { bytes, sheets } = booklet ?? painted.done
    dispatch({ type: 'saving' })
    const written = await output.close()
    if (!written.ok) {
      fail(written.code)
      return
    }
    dispatch({
      type: 'done',
      file,
      layout,
      sheets,
      bytes,
      skipped: skippedOf(
        book,
        skipped.map(({ assetId }) => assetId),
      ),
      handle: written.file,
      library: libraryLabel,
    })
  } catch {
    await output.abort()
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
    if (!('progress' in event.data || 'chunk' in event.data)) {
      worker.terminate()
    }
  }
  worker.onerror = () => {
    onMessage({ failed: { message: 'PDF worker error' } })
    worker.terminate()
  }
  // Photos and a booklet's page PDF are Blobs: they clone without a read.
  worker.postMessage(request)
}

function libraryLabel(): string {
  return getProjectSessionSnapshot().libraryLabel ?? 'Library'
}

let lastJob: PrintJob | null = null

/** Export PDF: snapshot the book now and run (from the click). */
export function startPrint(marks: boolean, layout: PrintLayout): void {
  lastJob = {
    book: getBookStoreSnapshot().book,
    printProfiles: getBookPrintProfiles(),
    marks,
    layout,
  }
  runJob(lastJob)
}

/** Try again (D10): the same snapshot and options; a new export without one. */
export function retryPrint(marks: boolean, layout: PrintLayout): void {
  if (lastJob === null) {
    startPrint(marks, layout)
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
    open: openExport,
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
