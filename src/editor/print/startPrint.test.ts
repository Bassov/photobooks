import { PDFDocument } from '@cantoo/pdf-lib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../../core/testing/fixtures'
import {
  runPdfCheck,
  runPdfImpose,
  runPdfPaint,
  type PdfCheckMessage,
  type PdfImposeMessage,
  type PdfPaintMessage,
  type PdfWorkerRequest,
} from '../../core/pdf/pdf.worker'
import {
  openExport,
  type ExportDirectoryHandle,
  type ExportFileHandle,
} from '../../project'
import { resetBookStore } from '../bookStore'
import { getOpenLibraryHandle } from '../projectSession'
import {
  PRINT_IDLE,
  printStore,
  reducePrint,
  type PrintEvent,
  type PrintState,
} from './printStore'
import type { PrintLayout } from './printText'
import { bookPrintProfile } from '../../core'
import {
  BOOKLET_PROFILE_ID,
  bookletPaintJob,
  checkOpenBook,
  checkPrint,
  openPrintedPdf,
  OPEN_PDF_URL_MS,
  printCounts,
  resolvePrintPhotos,
  retryPrint,
  runPdfWorker,
  runPrint,
  startPrint,
  type PdfWorkerRunner,
  type PrintJob,
} from './startPrint'

vi.mock('../export/startExportSite', () => ({
  readSource: vi.fn((assetId: string) =>
    assetId === 'a'
      ? Promise.resolve(new Blob([JPEG]))
      : Promise.reject(new Error('Photo source unavailable')),
  ),
}))

vi.mock('../projectSession', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../projectSession')>()),
  getOpenLibraryHandle: vi.fn(() => Promise.resolve(null)),
  getProjectSessionSnapshot: () => ({ libraryLabel: 'Photobooks' }),
}))

/** The worker's request dispatch. */
function inWorker(
  request: PdfWorkerRequest,
  post: (data: PdfCheckMessage | PdfImposeMessage | PdfPaintMessage) => void,
) {
  return 'check' in request
    ? runPdfCheck(request.check, post)
    : 'impose' in request
      ? runPdfImpose(request.impose, post)
      : runPdfPaint(request.paint, post)
}

/** The PDF worker in-process: messages go back asynchronously, like `postMessage`. */
class InProcessWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  terminated = false
  request: PdfWorkerRequest | null = null
  transfer: Transferable[] = []
  postMessage(request: PdfWorkerRequest, transfer: Transferable[] = []) {
    this.request = request
    this.transfer = transfer
    const post = (data: unknown) => {
      this.onmessage?.({ data })
    }
    void inWorker(request, post)
  }
  terminate() {
    this.terminated = true
  }
}

const workers: InProcessWorker[] = []
vi.mock('../../core/pdf/createPdfWorker', () => ({
  createPdfWorker: () => {
    const worker = new InProcessWorker()
    workers.push(worker)
    return worker
  },
}))

/** SOI, SOF0 (1 × 1, 3 channels), EOI. */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 1, 0, 1, 3, 1, 0x22, 0, 2, 0x11, 1, 3,
  0x11, 1, 0xff, 0xd9,
])

const MM = 72 / 25.4

function photoBook() {
  return makeBook({
    title: 'Lake trip',
    settings: { trim: { widthMm: 148, heightMm: 210 }, bleedMm: 3 },
    assets: { a: {}, gone: {} },
    // Page 1, then the single last page 2.
    spreads: [
      makeSpread({ frames: [makeFrame({ id: 'f-a', assetId: 'a' })] }),
      makeSpread({
        id: 'spread-2',
        frames: [makeFrame({ id: 'f-gone', assetId: 'gone' })],
      }),
    ],
  })
}

const inProcess: PdfWorkerRunner = (request, onMessage) => {
  const post = (message: Parameters<typeof onMessage>[0]) => {
    onMessage(message)
  }
  void inWorker(request, post)
}

/**
 * A library folder whose `exports/` keeps a file on `close`; `log` lists
 * each write (its size), close and abort.
 */
function memoryLibrary() {
  const files = new Map<string, Uint8Array>()
  const log: string[] = []
  const fileHandle = (name: string): ExportFileHandle => ({
    kind: 'file',
    name,
    getFile: () =>
      Promise.resolve(new Blob([new Uint8Array(files.get(name) ?? [])])),
    createWritable: () => {
      const chunks: Uint8Array<ArrayBuffer>[] = []
      return Promise.resolve({
        write: (data: Uint8Array) => {
          chunks.push(data.slice())
          log.push(`write ${String(data.length)}`)
          return Promise.resolve()
        },
        close: async () => {
          files.set(name, new Uint8Array(await new Blob(chunks).arrayBuffer()))
          log.push('close')
        },
        abort: () => {
          log.push('abort')
          return Promise.resolve()
        },
      })
    },
  })
  const library: ExportDirectoryHandle = {
    getDirectoryHandle: () => Promise.resolve(library),
    getFileHandle: (name) => Promise.resolve(fileHandle(name)),
  }
  return { library, files, log }
}

function recorder() {
  let state: PrintState = PRINT_IDLE
  const events: PrintEvent[] = []
  return {
    events,
    state: () => state,
    dispatch: (event: PrintEvent) => {
      const next = reducePrint(state, event)
      if (next === state) return false
      state = next
      events.push(event)
      return true
    },
  }
}

async function print(
  marks: boolean,
  overrides: Partial<Parameters<typeof runPrint>[0]> = {},
  layout: PrintLayout = 'single',
) {
  const { library, files, log } = memoryLibrary()
  const store = recorder()
  const job: PrintJob = { book: photoBook(), printProfiles: [], marks, layout }
  await runPrint({
    job,
    resolvePhotos: resolvePrintPhotos,
    runWorker: inProcess,
    library: () => Promise.resolve(library),
    libraryLabel: 'Photobooks',
    open: openExport,
    dispatch: (event) => {
      log.push(event.type)
      return store.dispatch(event)
    },
    ...overrides,
  })
  return { store, files, log }
}

async function firstPage(bytes: Uint8Array | undefined) {
  if (bytes === undefined) throw new Error('nothing written')
  const doc = await PDFDocument.load(bytes)
  return { doc, page: doc.getPage(0) }
}

function settlePrintStore() {
  printStore.dispatch({ type: 'failed', code: 'other', library: '' })
  printStore.dispatch({ type: 'seen' })
  printStore.dispatch({ type: 'expire' })
}

beforeEach(() => {
  settlePrintStore()
  workers.length = 0
  resetBookStore({
    book: photoBook(),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  settlePrintStore()
})

describe('runPrint', () => {
  it('writes the D8 file with bleed and crop marks when the box is on', async () => {
    const { store, files } = await print(true)

    const state = store.state()
    expect(state).toMatchObject({
      kind: 'done',
      file: 'lake-trip-A5.pdf',
      sheets: 20,
      library: 'Photobooks',
      skipped: { count: 1, pages: [2] },
    })
    const bytes = files.get('lake-trip-A5.pdf')
    expect(state.kind === 'done' && state.bytes).toBe(bytes?.byteLength)
    const { doc, page } = await firstPage(bytes)
    expect(doc.getPageCount()).toBe(20)
    const trim = page.getTrimBox()
    const bleed = page.getBleedBox()
    expect(trim.width).toBeCloseTo(148 * MM, 3)
    expect(bleed.width - trim.width).toBeCloseTo(6 * MM, 3)
    // Crop marks need media past the bleed box.
    expect(page.getMediaBox().width).toBeGreaterThan(bleed.width)
  })

  it('writes trim-size pages without marks when the box is off', async () => {
    const { files } = await print(false)

    const { page } = await firstPage(files.get('lake-trip-A5.pdf'))
    expect(page.getMediaBox()).toEqual(page.getTrimBox())
    expect(page.getTrimBox().width).toBeCloseTo(148 * MM, 3)
  })

  it('reports each painted sheet, then saving, then done', async () => {
    const { store } = await print(true)

    const types = store.events.map((event) => event.type)
    expect(types[0]).toBe('start')
    expect(store.events[0]).toEqual({
      type: 'start',
      sheets: 20,
      layout: 'single',
    })
    expect(types.filter((type) => type === 'progress')).toHaveLength(20)
    expect(types).not.toContain('imposing')
    expect(types.slice(-2)).toEqual(['saving', 'done'])
  })

  it('imposes a 2-up booklet of the book pages, unpadded, two PDF pages a sheet', async () => {
    const { store, files } = await print(false, {}, '2up')

    const types = store.events.map((event) => event.type)
    expect(store.events[0]).toEqual({ type: 'start', sheets: 2, layout: '2up' })
    expect(types.filter((type) => type === 'progress')).toHaveLength(2)
    expect(store.events.filter((event) => event.type === 'imposing')).toEqual([
      { type: 'imposing', imposed: 0, sheets: 1 },
      { type: 'imposing', imposed: 1, sheets: 1 },
    ])
    expect(types.slice(-2)).toEqual(['saving', 'done'])
    expect(store.state()).toMatchObject({
      kind: 'done',
      file: 'lake-trip-A5-2up.pdf',
      layout: '2up',
      sheets: 1,
      skipped: { count: 1, pages: [2] },
    })
    const { doc, page } = await firstPage(files.get('lake-trip-A5-2up.pdf'))
    expect(doc.getPageCount()).toBe(2)
    expect(page.getWidth()).toBeCloseTo(2 * 148 * MM, 3)
    expect(page.getHeight()).toBeCloseTo(210 * MM, 3)
  })

  it('imposes a 4-up booklet two cells high', async () => {
    const { store, files } = await print(false, {}, '4up')

    expect(store.state()).toMatchObject({
      kind: 'done',
      file: 'lake-trip-A5-4up.pdf',
      layout: '4up',
      sheets: 1,
    })
    const { doc, page } = await firstPage(files.get('lake-trip-A5-4up.pdf'))
    expect(doc.getPageCount()).toBe(2)
    expect(page.getHeight()).toBeCloseTo(2 * 210 * MM, 3)
  })

  it('fails with other when imposing fails, before saving', async () => {
    const { store, log } = await print(
      false,
      {
        runWorker: (request, onMessage) => {
          if ('impose' in request) {
            onMessage({ failed: { message: 'boom' } })
            return
          }
          inProcess(request, onMessage)
        },
      },
      '2up',
    )

    expect(store.state()).toMatchObject({ kind: 'failed', code: 'other' })
    expect(store.events.map((event) => event.type)).not.toContain('saving')
    expect(log.slice(-2)).toEqual(['abort', 'failed'])
  })

  it('fails with the write error code', async () => {
    const { store } = await print(true, {
      open: () => ({
        write: vi.fn(),
        close: () => Promise.resolve({ ok: false, code: 'full' }),
        abort: vi.fn(),
      }),
    })

    expect(store.state()).toEqual({
      kind: 'failed',
      code: 'full',
      library: 'Photobooks',
    })
  })

  it('writes the chunks as they arrive, in order, and closes after saving', async () => {
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3])]
    const { store, files, log } = await print(true, {
      runWorker: (_request, onMessage) => {
        for (const chunk of chunks) onMessage({ chunk: chunk.slice().buffer })
        onMessage({ progress: { painted: 1, sheets: 20 } })
        onMessage({ done: { bytes: 3, sheets: 20, skipped: [] } })
      },
    })

    expect(files.get('lake-trip-A5.pdf')).toEqual(new Uint8Array([1, 2, 3]))
    expect(log.filter((entry) => entry.startsWith('write'))).toEqual([
      'write 2',
      'write 1',
    ])
    expect(log.indexOf('saving')).toBeLessThan(log.indexOf('close'))
    expect(log.slice(-2)).toEqual(['close', 'done'])
    expect(store.state()).toMatchObject({ kind: 'done', bytes: 3 })
  })

  it('aborts the file when painting fails after some chunks', async () => {
    const { store, files, log } = await print(true, {
      runWorker: (_request, onMessage) => {
        onMessage({ chunk: new Uint8Array([1]).buffer })
        onMessage({ failed: { message: 'boom' } })
      },
    })

    expect(store.state()).toMatchObject({ kind: 'failed', code: 'other' })
    expect(log.slice(-3)).toEqual(['write 1', 'abort', 'failed'])
    expect(files.size).toBe(0)
  })

  it('fails with access without a library folder', async () => {
    const { store } = await print(true, {
      library: () => Promise.resolve(null),
    })

    expect(store.state()).toMatchObject({ kind: 'failed', code: 'access' })
  })

  it('fails with other when the worker or the photos fail', async () => {
    const worker = await print(true, {
      runWorker: (_request, onMessage) => {
        onMessage({ failed: { message: 'boom' } })
      },
    })
    expect(worker.store.state()).toMatchObject({
      kind: 'failed',
      code: 'other',
    })
    expect(worker.store.events.map((event) => event.type)).not.toContain(
      'saving',
    )

    const photos = await print(true, {
      resolvePhotos: () => Promise.reject(new Error('gone')),
    })
    expect(photos.store.state()).toMatchObject({
      kind: 'failed',
      code: 'other',
    })
  })

  it('lists every page of the skipped photos in order', async () => {
    const book = makeBook({
      settings: { trim: { widthMm: 148, heightMm: 210 }, bleedMm: 3 },
      assets: { x: {}, y: {} },
      // x on pages 1 and 4, y on page 2.
      spreads: [
        makeSpread({ frames: [makeFrame({ id: 'f-x1', assetId: 'x' })] }),
        makeSpread({
          id: 'spread-2',
          frames: [makeFrame({ id: 'f-y', assetId: 'y' })],
        }),
        makeSpread({
          id: 'spread-3',
          frames: [makeFrame({ id: 'f-x4', assetId: 'x' })],
        }),
      ],
    })

    const { store } = await print(true, {
      job: { book, printProfiles: [], marks: true, layout: 'single' },
    })

    expect(store.state()).toMatchObject({
      kind: 'done',
      skipped: { count: 2, pages: [1, 2, 4] },
    })
  })

  it('does nothing while a run is going', async () => {
    const runWorker = vi.fn()
    await print(true, { runWorker, dispatch: () => false })

    expect(runWorker).not.toHaveBeenCalled()
  })
})

describe('printCounts', () => {
  it('counts physical pages and the profile output sheets (D5)', () => {
    expect(printCounts(photoBook(), [], 'single')).toEqual({
      pages: 2,
      sheets: 2,
    })
  })

  it('counts a booklet in paper sheets: 4 pages each 2-up, 8 each 4-up', () => {
    const book = makeBook({
      spreads: Array.from({ length: 8 }, (_, i) =>
        makeSpread({ id: `s-${String(i)}` }),
      ),
    })
    expect(printCounts(book, [], '2up')).toEqual({ pages: 14, sheets: 4 })
    expect(printCounts(book, [], '4up')).toEqual({ pages: 14, sheets: 2 })
  })
})

describe('bookletPaintJob', () => {
  it('paints the book profile per page without its page minimum', () => {
    const book = photoBook()
    const job = bookletPaintJob(book, [])
    const profile = bookPrintProfile(job.book, job.printProfiles)

    expect(job.book.printProfile?.id).toBe(BOOKLET_PROFILE_ID)
    expect(profile).toEqual({
      ...bookPrintProfile(book),
      id: BOOKLET_PROFILE_ID,
      output: 'pages',
      pageCount: { ...bookPrintProfile(book).pageCount, min: 0 },
    })
  })
})

describe('checkPrint', () => {
  it('marks unreadable photos missing in the worker check', async () => {
    const rows = await checkPrint({
      book: photoBook(),
      printProfiles: [],
      resolvePhotos: resolvePrintPhotos,
      runWorker: inProcess,
    })

    const missing = rows.find((row) => row.id === 'asset-missing')
    expect(missing).toMatchObject({ severity: 'error', pages: [2] })
  })

  it('shows no rows when the check fails', async () => {
    const failed = await checkPrint({
      book: photoBook(),
      printProfiles: [],
      resolvePhotos: resolvePrintPhotos,
      runWorker: (_request, onMessage) => {
        onMessage({ failed: { message: 'boom' } })
      },
    })
    const thrown = await checkPrint({
      book: photoBook(),
      printProfiles: [],
      resolvePhotos: () => Promise.reject(new Error('gone')),
      runWorker: inProcess,
    })

    expect(failed).toEqual([])
    expect(thrown).toEqual([])
  })
})

describe('resolvePrintPhotos', () => {
  it('returns the readable sources and lists the rest as missing', async () => {
    const book = photoBook()
    // 'a' is readable but has no asset record.
    const ghost = makeBook({
      ...book,
      assets: { gone: {} },
    })

    const resolved = await resolvePrintPhotos(book)
    const noRecord = await resolvePrintPhotos(ghost)

    expect(Object.keys(resolved.photos)).toEqual(['a'])
    expect(resolved.missing).toEqual(['gone'])
    expect(Object.keys(noRecord.photos)).toEqual([])
    expect(new Set(noRecord.missing)).toEqual(new Set(['a', 'gone']))
  })
})

describe('the open book', () => {
  it('runs Export PDF through one worker per request and ends it', async () => {
    const { library, files } = memoryLibrary()
    vi.mocked(getOpenLibraryHandle).mockResolvedValue(library)

    startPrint(false, 'single')

    expect(printStore.getSnapshot().kind).toBe('running')
    await vi.waitFor(() => {
      expect(printStore.getSnapshot().kind).toBe('done')
    })
    expect([...files.keys()]).toEqual(['lake-trip-A5.pdf'])
    expect(workers).toHaveLength(1)
    expect(workers[0]?.terminated).toBe(true)
    expect(workers[0]?.transfer).toEqual([])
  })

  it('imposes a booklet in a second worker, handing it the page PDF as a Blob', async () => {
    const { library, files } = memoryLibrary()
    vi.mocked(getOpenLibraryHandle).mockResolvedValue(library)

    startPrint(false, '4up')

    await vi.waitFor(() => {
      expect(printStore.getSnapshot().kind).toBe('done')
    })
    expect([...files.keys()]).toEqual(['lake-trip-A5-4up.pdf'])
    expect(workers).toHaveLength(2)
    expect(workers.every((worker) => worker.terminated)).toBe(true)
    const request = workers[1]?.request
    const pages =
      request !== null && request !== undefined && 'impose' in request
        ? request.impose.pdf
        : undefined
    expect(pages).toBeInstanceOf(Blob)
    expect(pages?.type).toBe('application/pdf')
    expect(await pages?.slice(0, 5).text()).toBe('%PDF-')
    expect(
      (
        await PDFDocument.load(await (pages ?? new Blob()).arrayBuffer())
      ).getPageCount(),
    ).toBe(2)
    expect(workers[1]?.transfer).toEqual([])
  })

  it('tries the same snapshot again after a failure', async () => {
    vi.mocked(getOpenLibraryHandle).mockResolvedValue(null)
    startPrint(true, 'single')
    await vi.waitFor(() => {
      expect(printStore.getSnapshot()).toMatchObject({
        kind: 'failed',
        code: 'access',
        library: 'Photobooks',
      })
    })
    resetBookStore({
      book: makeBook({ title: 'Other' }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const { library, files } = memoryLibrary()
    vi.mocked(getOpenLibraryHandle).mockResolvedValue(library)
    printStore.dispatch({ type: 'seen' })

    retryPrint(true, '2up')

    await vi.waitFor(() => {
      expect(printStore.getSnapshot().kind).toBe('done')
    })
    // The failed job's snapshot and options, not the new ones.
    expect([...files.keys()]).toEqual(['lake-trip-A5.pdf'])
  })

  it('checks the open book', async () => {
    const rows = await checkOpenBook()

    expect(rows.map((row) => row.id)).toContain('asset-missing')
  })

  it('reports a crashed worker as a failed check', async () => {
    const post = vi
      .spyOn(InProcessWorker.prototype, 'postMessage')
      .mockImplementation(function (this: InProcessWorker) {
        this.onerror?.()
      })

    const rows = await checkOpenBook()

    expect(rows).toEqual([])
    expect(workers[0]?.terminated).toBe(true)
    post.mockRestore()
  })

  it('turns a worker error into a failed message', () => {
    const onMessage = vi.fn()
    runPdfWorker({ check: { book: photoBook(), photos: {} } }, onMessage)
    workers[0]?.onerror?.()

    expect(onMessage).toHaveBeenCalledWith({
      failed: { message: 'PDF worker error' },
    })
    expect(workers[0]?.terminated).toBe(true)
  })

  it('starts a new export on Try again without an earlier one', async () => {
    vi.resetModules()
    const fresh = await import('./startPrint')
    const { printStore: freshStore } = await import('./printStore')

    fresh.retryPrint(true, '2up')

    expect(freshStore.getSnapshot().kind).toBe('running')
    await vi.waitFor(() => {
      expect(freshStore.getSnapshot().kind).not.toBe('running')
    })
  })

  it('keeps the worker for progress and chunk messages', () => {
    const onMessage = vi.fn()
    runPdfWorker({ check: { book: photoBook(), photos: {} } }, onMessage)
    workers[0]?.onmessage?.({ data: { progress: { painted: 1, sheets: 2 } } })
    workers[0]?.onmessage?.({ data: { chunk: new ArrayBuffer(1) } })

    expect(onMessage).toHaveBeenCalledTimes(2)
    expect(workers[0]?.terminated).toBe(false)
  })
})

describe('openPrintedPdf', () => {
  it('opens the written file in a new tab, cuts the opener and revokes later', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
    const tab = { opener: {} as unknown }
    const timers: { run: () => void; ms: number }[] = []
    const win = {
      open: vi.fn(() => tab as unknown as Window),
      setTimeout: vi.fn((run: () => void, ms: number) => {
        timers.push({ run, ms })
        return 1
      }),
    }
    const { library, files } = memoryLibrary()
    files.set('a.pdf', new Uint8Array([1, 2, 3]))
    const handle = await library.getFileHandle('a.pdf')

    await openPrintedPdf(handle, win)

    expect(create.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
    expect((create.mock.calls[0]?.[0] as Blob).type).toBe('application/pdf')
    expect((create.mock.calls[0]?.[0] as Blob).size).toBe(3)
    expect(win.open).toHaveBeenCalledWith('blob:pdf', '_blank')
    expect(tab.opener).toBeNull()
    expect(timers[0]?.ms).toBe(OPEN_PDF_URL_MS)
    expect(revoke).not.toHaveBeenCalled()
    timers[0]?.run()
    expect(revoke).toHaveBeenCalledWith('blob:pdf')
  })

  it('survives a blocked pop-up', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf')
    const win = { open: vi.fn(() => null), setTimeout: vi.fn() }
    const { library } = memoryLibrary()

    await openPrintedPdf(await library.getFileHandle('a.pdf'), win)

    expect(win.setTimeout).toHaveBeenCalledTimes(1)
  })
})
