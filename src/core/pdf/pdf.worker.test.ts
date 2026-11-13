import { PDFDocument } from '@cantoo/pdf-lib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { genericPrintProfile } from '../print/genericProfile'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import {
  runPdfPaint,
  type PdfPaintMessage,
  type PdfPaintRequest,
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
    expect(sheets).toBe(1)
    expect(skipped).toEqual([{ assetId: 'gone', reason: 'missing' }])
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(1)
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
      onmessage: (event: { data: PdfPaintRequest }) => void
    }

    scope.onmessage({ data: { book: photoBook(), photos: {} } })

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
