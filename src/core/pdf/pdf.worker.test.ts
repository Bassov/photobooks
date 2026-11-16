import { PDFDocument } from '@cantoo/pdf-lib'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { genericPrintProfile } from '../print/genericProfile'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { ADOBE_RGB_ICC, colorJpeg } from '../testing/colorFixtures'
import {
  COLOR_READ_BYTES,
  runPdfCheck,
  runPdfCover,
  runPdfImpose,
  runPdfPaint,
  type PdfCheckMessage,
  type PdfCoverMessage,
  type PdfCoverWorkerRequest,
  type PdfImposeMessage,
  type PdfPaintMessage,
  type PdfWorkerRequest,
} from './pdf.worker'
import { bookFontFiles } from './pdfText.test-helpers'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number } }

/** SOI, SOF0 (1 × 1, 3 channels), EOI. */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 1, 0, 1, 3, 1, 0x22, 0, 2, 0x11, 1, 3,
  0x11, 1, 0xff, 0xd9,
])

function photoBook(printProfile?: { id: string; overrides: object }) {
  return makeBook({
    assets: { a: {}, gone: {} },
    spreads: [
      makeSpread({
        frames: [
          makeFrame({ id: 'f-a', assetId: 'a' }),
          makeFrame({ id: 'f-gone', assetId: 'gone' }),
        ],
      }),
    ],
    ...(printProfile === undefined ? {} : { printProfile }),
  })
}

async function run(request: Parameters<typeof runPdfPaint>[0]) {
  const posts: { message: PdfPaintMessage; transfer: Transferable[] }[] = []
  await runPdfPaint(request, (message, transfer) => {
    posts.push({ message, transfer })
  })
  return posts
}

function doneOf(message: unknown) {
  const paint = message as PdfPaintMessage | undefined
  if (paint === undefined || !('done' in paint)) {
    throw new Error('no done message')
  }
  return paint.done
}

/** The posted chunks joined: the PDF file. */
function fileOf(messages: unknown[]): Uint8Array {
  const chunks = messages.flatMap((message) =>
    typeof message === 'object' && message !== null && 'chunk' in message
      ? [new Uint8Array(message.chunk as ArrayBuffer)]
      : [],
  )
  const file = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) {
    file.set(chunk, at)
    at += chunk.length
  }
  return file
}

const withoutChunks = <T extends { message: object }>(posts: T[]) =>
  posts.filter(({ message }) => !('chunk' in message))

describe('runPdfPaint', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** A book whose one text frame prints `Lake`. */
  function textBook() {
    return makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              id: 't',
              kind: 'text',
              content: { type: 'static', text: 'Lake' },
            }),
          ],
        }),
      ],
    })
  }

  it('fetches the book font files the text needs from the app fonts folder', async () => {
    const fetched: string[] = []
    vi.stubGlobal('location', { href: 'https://app.test/assets/pdf.worker.js' })
    vi.stubGlobal('fetch', async (url: URL) => {
      fetched.push(url.href)
      const file = url.pathname.split('/').at(-1) ?? ''
      return new Response(new Blob([new Uint8Array(await bookFontFiles(file))]))
    })

    const posts = await run({ book: textBook(), photos: {}, marks: false })

    expect(doneOf(posts.at(-1)?.message).sheets).toBe(20)
    expect(fetched).toEqual([
      'https://app.test/fonts/inter-latin-wght-normal.woff2',
    ])
  })

  it('fails the paint when a font file does not load', async () => {
    vi.stubGlobal('location', { href: 'https://app.test/assets/pdf.worker.js' })
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response(null, { status: 404 })),
    )

    const posts = await run({ book: textBook(), photos: {}, marks: false })

    expect(posts.at(-1)?.message).toEqual({
      failed: {
        message: 'Error: font inter-latin-wght-normal.woff2: HTTP 404',
      },
    })
  })

  it('reads the photo blobs and posts the PDF in chunks, transferred', async () => {
    const posts = await run({
      book: structuredClone(photoBook()),
      photos: { a: new Blob([JPEG]) },
      marks: true,
    })

    // One page, padded with blank pages to Generic's 20-page minimum.
    expect(withoutChunks(posts)).toHaveLength(21)
    const last = posts.at(-1)
    const { bytes, sheets, skipped } = doneOf(last?.message)
    expect(last?.transfer).toEqual([])
    expect(sheets).toBe(20)
    expect(skipped).toEqual([{ assetId: 'gone', reason: 'missing' }])
    for (const { message, transfer } of posts) {
      if ('chunk' in message) expect(transfer).toEqual([message.chunk])
    }
    // The photo's chunk comes before the first page.
    expect('chunk' in (posts[0]?.message ?? {})).toBe(true)
    const pdf = fileOf(posts.map(({ message }) => message))
    expect(pdf.length).toBe(bytes)
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(20)
    // Crop marks widen the media past the 3 mm bleed box.
    const page = doc.getPage(0)
    expect(page.getMediaBox().width).toBeGreaterThan(page.getBleedBox().width)
  })

  it('prints at trim size without marks, whatever the profile asks', async () => {
    const custom = { ...genericPrintProfile(), id: 'shop', cropMarks: true }
    const posts = await run({
      book: photoBook({ id: 'shop', overrides: {} }),
      printProfiles: [custom],
      photos: {},
      marks: false,
    })

    const doc = await PDFDocument.load(
      fileOf(posts.map(({ message }) => message)),
    )
    const page = doc.getPage(0)
    expect(page.getMediaBox()).toEqual(page.getTrimBox())
  })

  it("prints with the book's custom profile from the library", async () => {
    const custom = {
      ...genericPrintProfile(),
      id: 'shop',
      name: 'Shop',
      pageCount: { min: 2, step: 2, max: 10 },
    }
    const posts = await run({
      book: photoBook({ id: 'shop', overrides: {} }),
      printProfiles: [custom],
      photos: {},
      marks: true,
    })

    expect(doneOf(posts.at(-1)?.message).sheets).toBe(2)
  })

  it('posts one progress message per page, in order, then the PDF', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 1, max: 16 }),
        fc.boolean(),
        async (spreads, min, marks) => {
          const custom = {
            ...genericPrintProfile(),
            id: 'shop',
            output:
              spreads % 2 === 0 ? ('pages' as const) : ('spreads' as const),
            pageCount: { min, step: 1, max: 200 },
          }
          const posts = await run({
            book: makeBook({
              spreads: Array.from({ length: spreads }, (_, index) =>
                makeSpread({ id: `s${String(index)}`, frames: [] }),
              ),
              printProfile: { id: 'shop', overrides: {} },
            }),
            printProfiles: [custom],
            photos: {},
            marks,
          })

          const { sheets } = doneOf(posts.at(-1)?.message)
          expect(withoutChunks(posts).slice(0, -1)).toEqual(
            Array.from({ length: sheets }, (_, index) => ({
              message: { progress: { painted: index + 1, sheets } },
              transfer: [],
            })),
          )
        },
      ),
      { seed: gates.pbt.seed, numRuns: 30 },
    )
  })

  it('answers a worker message with a posted PDF', async () => {
    const posts: unknown[][] = []
    vi.stubGlobal('postMessage', (...args: unknown[]) => posts.push(args))
    const scope = globalThis as unknown as {
      onmessage: (event: { data: PdfWorkerRequest }) => void
    }

    scope.onmessage({
      data: { paint: { book: photoBook(), photos: {}, marks: true } },
    })

    await vi.waitFor(() => {
      expect(posts.at(-1)?.[0]).toHaveProperty('done')
    })
    const [chunk, chunkTransfer] = posts[0] ?? []
    expect(chunkTransfer).toEqual([(chunk as { chunk: ArrayBuffer }).chunk])
    expect(posts[1]).toEqual([{ progress: { painted: 1, sheets: 20 } }, []])
    const [message, transfer] = posts.at(-1) ?? []
    expect(transfer).toEqual([])
    expect(fileOf(posts.map(([data]) => data)).length).toBe(
      doneOf(message).bytes,
    )
  })

  it('posts one failure when painting throws', async () => {
    const posts = await run({
      book: { ...photoBook(), spreads: null } as never,
      photos: {},
      marks: true,
    })

    expect(posts).toEqual([
      {
        message: { failed: { message: expect.stringMatching(/TypeError/) } },
        transfer: [],
      },
    ])
  })
})

async function pagePdf(pages: number): Promise<Blob> {
  const doc = await PDFDocument.create()
  for (let n = 0; n < pages; n += 1) doc.addPage([300, 400])
  return new Blob([await doc.save()])
}

async function impose(request: Parameters<typeof runPdfImpose>[0]) {
  const posts: { message: PdfImposeMessage; transfer: Transferable[] }[] = []
  await runPdfImpose(request, (message, transfer) => {
    posts.push({ message, transfer })
  })
  return posts
}

describe('runPdfCover', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function coverBook(assetId: string) {
    const book = photoBook()
    return {
      ...book,
      cover: { ...book.cover, front: { text: '', assetId } },
    }
  }

  it('answers a cover message with a one-page PDF and the skipped front photo', async () => {
    const posts: unknown[][] = []
    vi.stubGlobal('postMessage', (...args: unknown[]) => posts.push(args))
    const scope = globalThis as unknown as {
      onmessage: (event: { data: PdfCoverWorkerRequest }) => void
    }

    scope.onmessage({
      data: { cover: { book: coverBook('gone'), photos: {}, marks: true } },
    })

    await vi.waitFor(() => {
      expect(posts.at(-1)?.[0]).toHaveProperty('done')
    })
    const [chunk, chunkTransfer] = posts[0] ?? []
    expect(chunkTransfer).toEqual([(chunk as { chunk: ArrayBuffer }).chunk])
    const messages = posts.map(([data]) => data)
    expect(messages.filter((data) => !('chunk' in (data as object)))).toEqual([
      {
        done: {
          bytes: expect.any(Number),
          skipped: [{ assetId: 'gone', reason: 'missing' }],
        },
      },
    ])
    const file = fileOf(messages)
    expect(file.length).toBe(
      (messages.at(-1) as { done: { bytes: number } }).done.bytes,
    )
    expect((await PDFDocument.load(file)).getPageCount()).toBe(1)
  })

  it('embeds the front photo from the request and posts one failure when painting throws', async () => {
    const painted: [PdfCoverMessage, Transferable[]][] = []
    await runPdfCover(
      {
        book: coverBook('a'),
        photos: { a: new Blob([JPEG]) },
        marks: false,
      },
      (message, transfer) => painted.push([message, transfer]),
    )
    expect(painted.at(-1)).toEqual([
      { done: { bytes: expect.any(Number), skipped: [] } },
      [],
    ])

    const failed: [PdfCoverMessage, Transferable[]][] = []
    await runPdfCover(
      {
        book: { ...coverBook('a'), cover: null } as never,
        photos: {},
        marks: true,
      },
      (message, transfer) => failed.push([message, transfer]),
    )
    expect(failed).toEqual([
      [{ failed: { message: expect.stringMatching(/TypeError/) } }, []],
    ])
  })
})

function imposedOf(message: unknown) {
  const impose = message as PdfImposeMessage | undefined
  if (impose === undefined || !('done' in impose)) {
    throw new Error('no done message')
  }
  return impose.done
}

describe('runPdfImpose', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts progress per sheet and the imposed PDF in chunks, transferred', async () => {
    const posts = await impose({ pdf: await pagePdf(13), layout: '2up' })

    expect(withoutChunks(posts).slice(0, -1)).toEqual(
      [1, 2, 3, 4].map((imposed) => ({
        message: { progress: { imposed, sheets: 4 } },
        transfer: [],
      })),
    )
    const { bytes, sheets } = imposedOf(posts.at(-1)?.message)
    expect(posts.at(-1)?.transfer).toEqual([])
    for (const { message, transfer } of posts) {
      if ('chunk' in message) expect(transfer).toEqual([message.chunk])
    }
    expect(sheets).toBe(4)
    const pdf = fileOf(posts.map(({ message }) => message))
    expect(pdf.length).toBe(bytes)
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(8)
    expect(doc.getPage(0).getSize()).toEqual({ width: 600, height: 400 })
  })

  it('answers a worker impose message with a posted 4-up PDF', async () => {
    const posts: unknown[][] = []
    vi.stubGlobal('postMessage', (...args: unknown[]) => posts.push(args))
    const scope = globalThis as unknown as {
      onmessage: (event: { data: PdfWorkerRequest }) => void
    }

    scope.onmessage({
      data: { impose: { pdf: await pagePdf(8), layout: '4up' } },
    })

    await vi.waitFor(() => {
      expect(posts.at(-1)?.[0]).toHaveProperty('done')
    })
    // The sheet, then the page tree and the xref with the trailer.
    expect(posts.map(([data]) => Object.keys(data as object)[0])).toEqual([
      'chunk',
      'progress',
      'chunk',
      'chunk',
      'done',
    ])
    expect(posts[1]).toEqual([{ progress: { imposed: 1, sheets: 1 } }, []])
    const [message, transfer] = posts.at(-1) ?? []
    const { sheets } = imposedOf(message)
    expect(sheets).toBe(1)
    expect(transfer).toEqual([])
    const doc = await PDFDocument.load(fileOf(posts.map(([data]) => data)))
    expect(doc.getPage(0).getSize()).toEqual({ width: 600, height: 800 })
  })

  it('posts one failure when the page PDF does not load', async () => {
    const posts = await impose({
      pdf: new Blob([new Uint8Array([1, 2, 3])]),
      layout: '2up',
    })

    expect(posts).toEqual([
      { message: { failed: { message: expect.any(String) } }, transfer: [] },
    ])
  })
})

/** A photo file that only lets its head be read. */
class HeadOnlyBlob extends Blob {
  readonly slices: [number | undefined, number | undefined][] = []

  override slice(start?: number, end?: number, type?: string): Blob {
    this.slices.push([start, end])
    return super.slice(start, end, type)
  }

  override arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.reject(new Error('read the whole file'))
  }
}

function colorBook() {
  return makeBook({
    assets: { adobe: {}, plain: {}, absent: {} },
    spreads: [
      makeSpread({
        frames: [
          makeFrame({ id: 'f-adobe', assetId: 'adobe' }),
          makeFrame({ id: 'f-plain', assetId: 'plain' }),
          makeFrame({ id: 'f-absent', assetId: 'absent' }),
        ],
      }),
    ],
  })
}

async function check(request: Parameters<typeof runPdfCheck>[0]) {
  const posts: { message: PdfCheckMessage; transfer: Transferable[] }[] = []
  await runPdfCheck(request, (message, transfer) => {
    posts.push({ message, transfer })
  })
  return posts
}

function rowsOf(message: PdfCheckMessage | undefined) {
  if (message === undefined || !('checked' in message)) {
    throw new Error('no checked message')
  }
  return message.checked.rows
}

describe('runPdfCheck', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts preflight rows with a non-sRGB row, reading ≤ 256 KB per photo', async () => {
    const padding = new Uint8Array(COLOR_READ_BYTES * 2)
    const adobe = new HeadOnlyBlob([
      new Uint8Array(colorJpeg('adobe', ADOBE_RGB_ICC)),
      padding,
    ])
    const plain = new HeadOnlyBlob([new Uint8Array(colorJpeg('plain'))])

    const posts = await check({
      book: colorBook(),
      photos: { adobe, plain },
      assetStatus: { plain: 'modified' },
    })

    expect(posts).toHaveLength(1)
    expect(posts[0]?.transfer).toEqual([])
    const rows = rowsOf(posts[0]?.message)
    expect(rows.map(({ id }) => id)).toEqual([
      'page-count-below-min',
      'asset-modified',
      'color-space',
    ])
    expect(rows[2]).toMatchObject({
      severity: 'warning',
      count: 1,
      text: '1 photo isn’t sRGB (Adobe RGB), colours may shift',
      pageList: ' · page 1',
    })
    expect(adobe.slices).toEqual([[0, COLOR_READ_BYTES]])
    expect(plain.slices).toEqual([[0, COLOR_READ_BYTES]])
  })

  it("checks against the book's custom profile from the library", async () => {
    const custom = {
      ...genericPrintProfile(),
      id: 'shop',
      name: 'Shop',
      pageCount: { min: 2, step: 2, max: 10 },
    }

    const posts = await check({
      book: makeBook({
        spreads: [makeSpread({ frames: [] })],
        printProfile: { id: 'shop', overrides: {} },
      }),
      printProfiles: [custom],
      photos: {},
    })

    expect(rowsOf(posts[0]?.message).map(({ text }) => text)).toEqual([
      'Shop prints at least 2 pages. This book has 1.',
    ])
  })

  it('answers a worker check message with posted rows', async () => {
    const posts: unknown[][] = []
    vi.stubGlobal('postMessage', (...args: unknown[]) => posts.push(args))
    const scope = globalThis as unknown as {
      onmessage: (event: { data: PdfWorkerRequest }) => void
    }

    scope.onmessage({ data: { check: { book: colorBook(), photos: {} } } })

    await vi.waitFor(() => {
      expect(posts).toHaveLength(1)
    })
    const [message, transfer] = posts[0] ?? []
    expect(rowsOf(message as PdfCheckMessage).map(({ id }) => id)).toEqual([
      'page-count-below-min',
    ])
    expect(transfer).toEqual([])
  })

  it('posts one failure when the check throws', async () => {
    const posts = await check({
      book: { ...colorBook(), spreads: null } as never,
      photos: {},
    })

    expect(posts).toEqual([
      {
        message: { failed: { message: expect.stringMatching(/TypeError/) } },
        transfer: [],
      },
    ])
  })
})
