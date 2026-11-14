import { expect, type Page } from '@playwright/test'

// pdf-export e2e: the `?fixture=painter` editor (40 spreads, empty first
// frame) adopted into a fresh OPFS library, so Print writes
// `<library>/exports/`. The PDF worker's paint messages pass a page-side
// gate: `holdPdf` stops them, `releasePdf(n)` lets n through.

interface Gate {
  open: number
  queue: (() => void)[]
  release: (n: number) => void
}

/** Before the app loads: gate paint messages (`progress` / `done`) of PDF workers. */
export async function gatePdfWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const gate: Gate = {
      open: Number.POSITIVE_INFINITY,
      queue: [],
      release(n) {
        gate.open += n
        while (gate.open > 0 && gate.queue.length > 0) {
          gate.open -= 1
          gate.queue.shift()?.()
        }
      },
    }
    ;(window as unknown as { __pdfGate: Gate }).__pdfGate = gate
    const Native = window.Worker
    class GatedWorker extends Native {
      private readonly pdf: boolean
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.pdf = String(url).includes('pdf.worker')
      }
      override set onmessage(handler: Worker['onmessage']) {
        if (!this.pdf || handler === null) {
          super.onmessage = handler
          return
        }
        super.onmessage = (event: MessageEvent) => {
          const data = event.data as object
          const deliver = () => {
            handler.call(this, event)
          }
          if (!('progress' in data) && !('done' in data)) {
            deliver()
          } else if (gate.open > 0) {
            gate.open -= 1
            deliver()
          } else {
            gate.queue.push(deliver)
          }
        }
      }
      override get onmessage(): Worker['onmessage'] {
        return super.onmessage
      }
    }
    window.Worker = GatedWorker
  })
}

/** Paint messages wait from now on. */
export const holdPdf = (page: Page) =>
  page.evaluate(() => {
    ;(window as unknown as { __pdfGate: Gate }).__pdfGate.open = 0
  })

/** Let `n` paint messages through (all with `Infinity`). */
export const releasePdf = (page: Page, n = Number.POSITIVE_INFINITY) =>
  page.evaluate((count) => {
    ;(window as unknown as { __pdfGate: Gate }).__pdfGate.release(count)
  }, n)

/** Painter fixture adopted into a fresh OPFS library folder `folder`. */
export async function openPrintFixture(
  page: Page,
  folder: string,
  query = '',
): Promise<void> {
  await gatePdfWorker(page)
  await page.goto(`/?fixture=painter${query}`)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  const attached = await page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(name, { recursive: true }).catch(() => undefined)
    const api = window.__photobooksProject
    if (!api) return 'missing api'
    const result = await api.attachOpfsTestLibrary(name)
    return result.ok ? 'ok' : result.code
  }, folder)
  expect(attached).toBe('ok')
  await expect(page.getByTestId('book-size')).toContainText(/· (un)?saved$/)
}

/** Bytes and head of `<folder>/exports/<file>` (null when absent). */
export const readExport = (page: Page, folder: string, file: string) =>
  page.evaluate(
    async ({ folder, file }) => {
      try {
        const root = await navigator.storage.getDirectory()
        const library = await root.getDirectoryHandle(folder)
        const exports = await library.getDirectoryHandle('exports')
        const blob = await (await exports.getFileHandle(file)).getFile()
        const head = await blob.slice(0, 5).text()
        return { bytes: blob.size, head }
      } catch {
        return null
      }
    },
    { folder, file },
  )

/** The next PDF write is refused like a revoked folder permission. */
export const denyNextWrite = (page: Page) =>
  page.evaluate(() => {
    const proto = FileSystemFileHandle.prototype
    const native = Reflect.get(proto, 'createWritable')
    // Library saves (book.json) keep writing.
    proto.createWritable = function deny(
      this: FileSystemFileHandle,
      ...args: Parameters<typeof native>
    ) {
      if (!this.name.endsWith('.pdf')) return native.apply(this, args)
      Reflect.set(proto, 'createWritable', native)
      return Promise.reject(new DOMException('denied', 'NotAllowedError'))
    }
  })
