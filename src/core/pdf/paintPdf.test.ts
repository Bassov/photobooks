import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  type PDFPage,
  PDFRawStream,
  PDFRef,
} from '@cantoo/pdf-lib'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { pagesOf } from '../pages'
import { genericPrintProfile } from '../print/genericProfile'
import type { PrintProfile } from '../print/profileSchema'
import type { Book } from '../schema'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'
import {
  makePainterFixture,
  PAINTER_ASSET_IDS,
  PAINTER_SPREAD_COUNT,
} from '../testing/painterFixture'
import { paintBookPdf, type PhotoByteSource } from './paintPdf'
import { CROP_MARK_LENGTH_MM, PT_PER_MM } from './pdfGeometry'

/** A JPEG header only (SOI, comment, SOF0, EOI): enough to embed, unique per `tag`. */
function fakeJpeg(width: number, height: number, tag: string): Uint8Array {
  const comment = [...new TextEncoder().encode(tag)]
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xfe,
    0,
    comment.length + 2,
    ...comment,
    0xff,
    0xc0,
    0,
    17,
    8,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
    0xff,
    0xd9,
  ])
}

/** 1 × 1 RGBA PNG. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
)

function sourceOf(bytes: Record<string, Uint8Array>): PhotoByteSource {
  return (assetId) => Promise.resolve(bytes[assetId])
}

const FIXTURE_BYTES = Object.fromEntries(
  PAINTER_ASSET_IDS.map((assetId, index) => [
    assetId,
    fakeJpeg(400 + index, 300, assetId),
  ]),
)

const pagesProfile = genericPrintProfile()
const spreadsProfile: PrintProfile = {
  ...genericPrintProfile(),
  output: 'spreads',
  cropMarks: true,
}

async function paint(
  book: Book,
  profile: PrintProfile = pagesProfile,
  bytes: Record<string, Uint8Array> = FIXTURE_BYTES,
  marks = true,
) {
  const result = await paintBookPdf({
    book,
    profile,
    photos: sourceOf(bytes),
    marks,
  })
  return { result, doc: await PDFDocument.load(result.pdf) }
}

function imageStreams(doc: PDFDocument): PDFRawStream[] {
  return doc.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter(
      (object): object is PDFRawStream =>
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    )
}

function contentOf(doc: PDFDocument, page: PDFPage): string {
  const contents = page.node.normalizedEntries().Contents
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref))
      : []
  return streams
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .map((stream) =>
      new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode()),
    )
    .join('\n')
}

/** Bytes of the images a page draws, in paint order. */
function drawnImages(doc: PDFDocument, page: PDFPage): Uint8Array[] {
  const xObjects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
  const names = [...contentOf(doc, page).matchAll(/\/(\S+) Do/g)].map(
    ([, name = '']) => name,
  )
  return names.map((name) => {
    const ref = xObjects?.get(PDFName.of(name))
    const stream = ref instanceof PDFRef ? doc.context.lookup(ref) : undefined
    if (!(stream instanceof PDFRawStream)) throw new Error(`no image ${name}`)
    return stream.contents
  })
}

function box(b: { x: number; y: number; width: number; height: number }) {
  return [b.x, b.y, b.width, b.height].map(
    (value) => Math.round(value * 1000) / 1000,
  )
}

function boxMm(x: number, y: number, width: number, height: number) {
  return box({
    x: x * PT_PER_MM,
    y: y * PT_PER_MM,
    width: width * PT_PER_MM,
    height: height * PT_PER_MM,
  })
}

describe('paintBookPdf', () => {
  const { book } = makePainterFixture()

  it('prints the fixture book one PDF page per book page with the profile boxes', async () => {
    const { result, doc } = await paint(book)

    // 40 spreads: single first and last pages, 38 two-page spreads.
    expect(result.sheets).toBe(78)
    expect(doc.getPageCount()).toBe(78)
    expect(result.skipped).toEqual([])
    const slug = 3 + CROP_MARK_LENGTH_MM
    for (const page of [doc.getPage(0), doc.getPage(1), doc.getPage(77)]) {
      expect(box(page.getMediaBox())).toEqual(
        boxMm(0, 0, 300 + 2 * slug, 300 + 2 * slug),
      )
      expect(box(page.getBleedBox())).toEqual(boxMm(5, 5, 306, 306))
      expect(box(page.getTrimBox())).toEqual(boxMm(slug, slug, 300, 300))
    }
  })

  it('embeds each photo once, as its original JPEG bytes', async () => {
    const { doc } = await paint(book)

    const streams = imageStreams(doc)
    expect(streams).toHaveLength(PAINTER_ASSET_IDS.length)
    for (const assetId of PAINTER_ASSET_IDS) {
      const original = FIXTURE_BYTES[assetId]
      const matches = streams.filter(
        (stream) =>
          original !== undefined &&
          Buffer.from(stream.contents).equals(Buffer.from(original)),
      )
      expect(matches, assetId).toHaveLength(1)
      expect(matches[0]?.dict.get(PDFName.of('Filter'))).toBe(
        PDFName.of('DCTDecode'),
      )
    }
    // Page 2 (left of spread 2): its two frames, and the right page's two
    // reaching 0.5 mm into its 3 mm gutter bleed (they start at 302.5 mm).
    expect(drawnImages(doc, doc.getPage(1))).toHaveLength(4)
  })

  it('prints one sheet per spread with crop marks', async () => {
    const { result, doc } = await paint(book, spreadsProfile)

    expect(result.sheets).toBe(PAINTER_SPREAD_COUNT)
    expect(doc.getPageCount()).toBe(PAINTER_SPREAD_COUNT)
    const slug = 3 + CROP_MARK_LENGTH_MM
    const inner = doc.getPage(1)
    expect(box(inner.getMediaBox())).toEqual(
      boxMm(0, 0, 600 + 2 * slug, 300 + 2 * slug),
    )
    expect(box(inner.getBleedBox())).toEqual(boxMm(5, 5, 606, 306))
    expect(box(inner.getTrimBox())).toEqual(boxMm(slug, slug, 600, 300))
    expect(box(doc.getPage(0).getTrimBox())).toEqual(
      boxMm(slug, slug, 300, 300),
    )
    const content = contentOf(doc, inner)
    expect(content.match(/ l\n/g)).toHaveLength(8)
    expect(content).toMatch(/0 G\n/)
    // 0.25 pt in the sheet's millimetre space.
    expect(content).toMatch(/\n0\.0881\d* w\n/)
    expect(drawnImages(doc, inner)).toHaveLength(4)
  })

  it('clips each photo to its frame under the frame and image matrices', async () => {
    // No bleed: the left page draws only its own two frames.
    const { doc } = await paint(book, pagesProfile, FIXTURE_BYTES, false)

    const content = contentOf(doc, doc.getPage(1))
    // The bleed clip, then frame + image matrices and a clip per photo.
    expect(content.match(/ re\nW\nn\n/g)).toHaveLength(3)
    expect(content.match(/ cm\n/g)).toHaveLength(5)
    expect(content.match(/^q\n/gm)).toHaveLength(3)
    expect(content.match(/^Q\n?/gm)).toHaveLength(3)
    expect(box(doc.getPage(1).getMediaBox())).toEqual(boxMm(0, 0, 300, 300))
  })

  it('reports missing and unsupported photos once and paints the rest', async () => {
    const { result, doc } = await paint(book, pagesProfile, {
      'painter-a': FIXTURE_BYTES['painter-a'] ?? PNG,
      'painter-b': PNG,
      'painter-c': new Uint8Array([1, 2, 3, 4]),
    })

    expect(result.skipped).toEqual([
      { assetId: 'painter-c', reason: 'unsupported' },
      { assetId: 'painter-d', reason: 'missing' },
    ])
    expect(imageStreams(doc).length).toBeGreaterThanOrEqual(2)
  })

  it('skips a JPEG it cannot read', async () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const { result } = await paint(book, pagesProfile, {
      ...FIXTURE_BYTES,
      'painter-d': broken,
    })

    expect(result.skipped).toEqual([
      { assetId: 'painter-d', reason: 'unsupported' },
    ])
  })
})

describe('paintBookPdf on small books', () => {
  const photoFrame = (id: string, assetId: string, z: number, x = 10) =>
    makeFrame({
      id,
      assetId,
      z,
      rect: { x, y: 10, width: 100, height: 80 },
      crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
    })

  function threeSpreadBook(overrides: Parameters<typeof makeBook>[0] = {}) {
    return makeBook({
      assets: { top: {}, bottom: {}, parent: {} },
      spreads: [
        makeSpread({ id: 's0', frames: [] }),
        makeSpread({
          id: 's1',
          frames: [
            photoFrame('f-top', 'top', 2),
            photoFrame('f-bottom', 'bottom', 1),
          ],
        }),
        makeSpread({ id: 's2', frames: [] }),
      ],
      ...overrides,
    })
  }

  const bytes = {
    top: fakeJpeg(40, 30, 'top'),
    bottom: fakeJpeg(40, 30, 'bottom'),
    parent: fakeJpeg(40, 30, 'parent'),
  }

  it('paints the parent layer first, then frames by z', async () => {
    const book = threeSpreadBook({
      parents: [
        {
          id: 'p',
          name: 'Master A',
          frames: [photoFrame('f-parent', 'parent', 9, 20)],
          guides: [],
        },
      ],
      defaultParentId: 'p',
    })
    const { doc } = await paint(book, pagesProfile, bytes)

    expect(drawnImages(doc, doc.getPage(1))).toEqual([
      bytes.parent,
      bytes.bottom,
      bytes.top,
    ])
  })

  it('fills the bleed with the page colour, and nothing without one', async () => {
    const coloured = await paint(
      threeSpreadBook({ settings: { pageColor: '#ff8000' } }),
      pagesProfile,
      bytes,
    )
    expect(contentOf(coloured.doc, coloured.doc.getPage(0))).toMatch(
      /1 0\.50196\d* 0 rg\n.* re\nf\n/,
    )
    const plain = await paint(threeSpreadBook(), pagesProfile, bytes)
    expect(contentOf(plain.doc, plain.doc.getPage(0))).not.toMatch(/ rg\n/)
  })

  it('applies the EXIF orientation of a raw JPEG', async () => {
    const orientedBook = (orientation?: number) =>
      threeSpreadBook({
        assets: {
          top: orientation === undefined ? {} : { orientation },
          bottom: {},
          parent: {},
        },
      })
    const wide = { ...bytes, top: fakeJpeg(400, 100, 'top') }
    const upright = await paint(orientedBook(), pagesProfile, wide)
    const turned = await paint(orientedBook(6), pagesProfile, wide)
    const png = await paint(orientedBook(6), pagesProfile, {
      ...wide,
      top: PNG,
    })
    const pngUpright = await paint(orientedBook(), pagesProfile, {
      ...wide,
      top: PNG,
    })

    const page = (doc: PDFDocument) => contentOf(doc, doc.getPage(1))
    expect(page(turned.doc)).not.toBe(page(upright.doc))
    // PNGs carry no EXIF turn of their own here.
    expect(page(png.doc)).toBe(page(pngUpright.doc))
  })

  it('clips each sheet to its own bleed box', async () => {
    const { doc } = await paint(threeSpreadBook(), pagesProfile, bytes)

    expect(contentOf(doc, doc.getPage(0))).toMatch(
      /^q\n.* cm\n-3 -3 306 306 re\nW\nn\n/,
    )
    expect(contentOf(doc, doc.getPage(2))).toMatch(
      /^q\n.* cm\n297 -3 306 306 re\nW\nn\n/,
    )
  })

  it('fits the crop window to the embedded image aspect', async () => {
    const page = async (top: Uint8Array) => {
      const { doc } = await paint(threeSpreadBook(), pagesProfile, {
        ...bytes,
        top,
      })
      return contentOf(doc, doc.getPage(1))
    }

    expect(await page(fakeJpeg(400, 100, 'top'))).not.toBe(
      await page(fakeJpeg(100, 400, 'top')),
    )
  })

  it('adds one page resource for an image shown in two frames', async () => {
    const book = threeSpreadBook({
      spreads: [
        makeSpread({ id: 's0', frames: [] }),
        makeSpread({
          id: 's1',
          frames: [
            photoFrame('f-1', 'top', 1),
            photoFrame('f-2', 'top', 2, 150),
          ],
        }),
        makeSpread({ id: 's2', frames: [] }),
      ],
    })
    const { doc } = await paint(book, pagesProfile, bytes)

    const page = doc.getPage(1)
    const names = [...contentOf(doc, page).matchAll(/\/(\S+) Do/g)].map(
      ([, name]) => name,
    )
    expect(names).toHaveLength(2)
    expect(new Set(names).size).toBe(1)
    const xObjects = page.node
      .Resources()
      ?.lookup(PDFName.of('XObject'), PDFDict)
    expect(xObjects?.keys()).toHaveLength(1)
  })

  it('paints a photo whose asset has no library entry', async () => {
    const { result, doc } = await paint(
      threeSpreadBook({ assets: { bottom: {}, parent: {} } }),
      pagesProfile,
      bytes,
    )

    expect(result.skipped).toEqual([])
    expect(drawnImages(doc, doc.getPage(1))).toEqual([bytes.bottom, bytes.top])
  })

  it('sets the PDF title from the book title only', async () => {
    const titled = await paint(
      threeSpreadBook({ title: 'Trip' }),
      pagesProfile,
      bytes,
    )
    expect(titled.doc.getTitle()).toBe('Trip')
    const untitled = await paint(
      threeSpreadBook({ title: '' }),
      pagesProfile,
      bytes,
    )
    expect(untitled.doc.getTitle()).toBeUndefined()
  })

  it('keeps the book bleed inside the profile range', async () => {
    const { doc } = await paint(
      threeSpreadBook({ settings: { bleedMm: 20 } }),
      { ...pagesProfile, bleedMaxMm: 5 },
      bytes,
    )

    const slug = 5 + CROP_MARK_LENGTH_MM
    expect(box(doc.getPage(0).getTrimBox())).toEqual(
      boxMm(slug, slug, 300, 300),
    )
    expect(box(doc.getPage(0).getBleedBox())).toEqual(boxMm(5, 5, 310, 310))
  })
})

describe('paintBookPdf marks', () => {
  // A5, 4 pages padded to 6, a profile that asks for crop marks.
  const book = makeBook({
    assets: { a: {} },
    settings: { trim: { widthMm: 148, heightMm: 210 }, bleedMm: 3 },
    spreads: [0, 1, 2].map((index) =>
      makeSpread({
        id: `s${String(index)}`,
        frames: [
          makeFrame({
            id: `f${String(index)}`,
            assetId: 'a',
            rect: { x: 10, y: 10, width: 100, height: 80 },
          }),
        ],
      }),
    ),
  })
  const profile: PrintProfile = {
    ...pagesProfile,
    cropMarks: true,
    pageCount: { min: 6, step: 1, max: 200 },
  }
  const bytes = { a: fakeJpeg(40, 30, 'a') }

  it('adds the 3 mm bleed and crop marks to every page with marks on', async () => {
    const { result, doc } = await paint(book, profile, bytes, true)

    expect(result.sheets).toBe(6)
    const slug = 3 + CROP_MARK_LENGTH_MM
    for (const page of doc.getPages()) {
      expect(box(page.getBleedBox())).toEqual(boxMm(5, 5, 154, 216))
      expect(box(page.getTrimBox())).toEqual(boxMm(slug, slug, 148, 210))
      expect(box(page.getMediaBox())).toEqual(
        boxMm(0, 0, 148 + 2 * slug, 210 + 2 * slug),
      )
      expect(contentOf(doc, page).match(/ l\n/g)).toHaveLength(8)
    }
  })

  it('prints every page at trim size without marks with marks off', async () => {
    const { result, doc } = await paint(book, profile, bytes, false)

    expect(result.sheets).toBe(6)
    for (const page of doc.getPages()) {
      expect(box(page.getMediaBox())).toEqual(boxMm(0, 0, 148, 210))
      expect(box(page.getBleedBox())).toEqual(boxMm(0, 0, 148, 210))
      expect(box(page.getTrimBox())).toEqual(boxMm(0, 0, 148, 210))
      expect(contentOf(doc, page)).not.toMatch(/ l\n/)
    }
    expect(drawnImages(doc, doc.getPage(3))).toHaveLength(1)
    expect(contentOf(doc, doc.getPage(5))).toBe('')
  })

  it('reports each page once, in order, padding included', async () => {
    const calls: [number, number][] = []
    await paintBookPdf({
      book,
      profile,
      photos: sourceOf(bytes),
      marks: false,
      onSheet: (painted, sheets) => calls.push([painted, sheets]),
    })

    expect(calls).toEqual([1, 2, 3, 4, 5, 6].map((index) => [index, 6]))
  })
})

describe('paintBookPdf below the profile minimum', () => {
  const gates = JSON.parse(
    readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
  ) as { pbt: { seed: number } }

  function bookOf(spreads: number): Book {
    return makeBook({
      assets: { a: {} },
      spreads: Array.from({ length: spreads }, (_, index) =>
        makeSpread({
          id: `s${String(index)}`,
          frames: [
            makeFrame({
              id: `f${String(index)}`,
              assetId: 'a',
              rect: { x: 10, y: 10, width: 100, height: 80 },
            }),
          ],
        }),
      ),
    })
  }

  const bytes = { a: fakeJpeg(40, 30, 'a') }

  function withMin(profile: PrintProfile, min: number): PrintProfile {
    return { ...profile, pageCount: { min, step: 1, max: Math.max(min, 200) } }
  }

  it('pads a 4-page book to 20 blank pages with the boxes of page 1', async () => {
    const { result, doc } = await paint(
      bookOf(3),
      withMin(pagesProfile, 20),
      bytes,
      false,
    )

    expect(result.sheets).toBe(20)
    expect(doc.getPageCount()).toBe(20)
    const first = doc.getPage(0)
    for (const page of doc.getPages().slice(4)) {
      expect(box(page.getMediaBox())).toEqual(box(first.getMediaBox()))
      expect(box(page.getTrimBox())).toEqual(box(first.getTrimBox()))
      expect(box(page.getBleedBox())).toEqual(box(first.getBleedBox()))
      expect(contentOf(doc, page)).toBe('')
    }
    expect(drawnImages(doc, doc.getPage(3))).toHaveLength(1)
  })

  it('keeps a book at the minimum as it is', async () => {
    const { result, doc } = await paint(
      bookOf(11),
      withMin(pagesProfile, 20),
      bytes,
    )

    expect(result.sheets).toBe(20)
    expect(doc.getPageCount()).toBe(20)
    expect(drawnImages(doc, doc.getPage(19))).toHaveLength(1)
  })

  it('draws crop marks and nothing else on blank pages with marks', async () => {
    const { doc } = await paint(bookOf(3), withMin(pagesProfile, 6), bytes)

    const blank = contentOf(doc, doc.getPage(5))
    expect(blank.match(/ l\n/g)).toHaveLength(8)
    expect(blank).not.toMatch(/ re\n|Do\n/)
    expect(box(doc.getPage(5).getMediaBox())).toEqual(
      box(doc.getPage(0).getMediaBox()),
    )
  })

  it('pads spread sheets two pages wide, an odd remainder on one page', async () => {
    // 4 pages on 3 sheets; 5 more pages: 2 + 2 + 1.
    const { result, doc } = await paint(
      bookOf(3),
      withMin(spreadsProfile, 9),
      bytes,
    )

    expect(result.sheets).toBe(6)
    const slug = 3 + CROP_MARK_LENGTH_MM
    expect(doc.getPages().map((page) => box(page.getTrimBox()))).toEqual(
      [300, 600, 300, 600, 600, 300].map((width) =>
        boxMm(slug, slug, width, 300),
      ),
    )
    for (const page of doc.getPages().slice(3)) {
      expect(contentOf(doc, page).match(/ l\n/g)).toHaveLength(8)
      expect(contentOf(doc, page)).not.toMatch(/Do\n/)
    }
  })

  it('prints max(book pages, profile minimum) pages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 1, max: 24 }),
        async (spreads, min) => {
          const { result, doc } = await paint(
            bookOf(spreads),
            withMin(pagesProfile, min),
            bytes,
          )
          const pages = Math.max(pagesOf(spreads), min)
          expect(result.sheets).toBe(pages)
          expect(doc.getPageCount()).toBe(pages)
        },
      ),
      { seed: gates.pbt.seed, numRuns: 30 },
    )
  })
})
