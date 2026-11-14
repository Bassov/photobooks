import { PDFDocument } from '@cantoo/pdf-lib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { genericPrintProfile } from '../print/genericProfile'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import { ADOBE_RGB_ICC, colorJpeg } from '../testing/colorFixtures'
import {
  COLOR_READ_BYTES,
  runPdfCheck,
  runPdfPaint,
  type PdfCheckMessage,
  type PdfPaintMessage,
  type PdfWorkerRequest,
} from './pdf.worker'

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

function doneOf(message: PdfPaintMessage | undefined) {
  if (message === undefined || !('done' in message)) {
    throw new Error('no done message')
  }
  return message.done
}

describe('runPdfPaint', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the photo blobs and posts the PDF bytes, transferred', async () => {
    const posts = await run({
      book: structuredClone(photoBook()),
      photos: { a: new Blob([JPEG]) },
    })

    expect(posts).toHaveLength(1)
    const { pdf, sheets, skipped } = doneOf(posts[0]?.message)
    expect(posts[0]?.transfer).toEqual([pdf])
    // One page, padded with blank pages to Generic's 20-page minimum.
    expect(sheets).toBe(20)
    expect(skipped).toEqual([{ assetId: 'gone', reason: 'missing' }])
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(20)
  })

  it("prints with the book's custom profile from the library", async () => {
    const custom = {
      ...genericPrintProfile(),
      id: 'shop',
      name: 'Shop',
      cropMarks: true,
    }
    const posts = await run({
      book: photoBook({ id: 'shop', overrides: {} }),
      printProfiles: [custom],
      photos: {},
    })

    const doc = await PDFDocument.load(doneOf(posts[0]?.message).pdf)
    // Crop marks widen the media past the 3 mm bleed box.
    const page = doc.getPage(0)
    expect(page.getMediaBox().width).toBeGreaterThan(page.getBleedBox().width)
  })

  it('answers a worker message with a posted PDF', async () => {
    const posts: unknown[][] = []
    vi.stubGlobal('postMessage', (...args: unknown[]) => posts.push(args))
    const scope = globalThis as unknown as {
      onmessage: (event: { data: PdfWorkerRequest }) => void
    }

    scope.onmessage({ data: { paint: { book: photoBook(), photos: {} } } })

    await vi.waitFor(() => {
      expect(posts).toHaveLength(1)
    })
    const [message, transfer] = posts[0] ?? []
    expect(transfer).toEqual([doneOf(message as PdfPaintMessage).pdf])
  })

  it('posts one failure when painting throws', async () => {
    const posts = await run({
      book: { ...photoBook(), spreads: null } as never,
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
